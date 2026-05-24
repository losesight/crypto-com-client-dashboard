import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth.js';
import { dbGetSettings, dbSetSetting, ORDER_CHECKER_DEFAULTS } from '$lib/server/database.js';

const ALLOWED_KEYS = Object.keys(ORDER_CHECKER_DEFAULTS);

export const GET: RequestHandler = async ({ locals }) => {
	requireAdmin(locals);
	const stored = dbGetSettings('order_checker.');
	const out: Record<string, string> = { ...ORDER_CHECKER_DEFAULTS, ...stored };
	return json({ settings: out, defaults: ORDER_CHECKER_DEFAULTS });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	requireAdmin(locals);
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	for (const [k, v] of Object.entries(body)) {
		if (!ALLOWED_KEYS.includes(k)) continue;
		dbSetSetting(k, String(v ?? ''));
	}
	return json({ ok: true });
};
