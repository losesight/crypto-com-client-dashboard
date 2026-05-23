import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetSettings, dbSetSetting, ORDER_CHECKER_DEFAULTS } from '$lib/server/database.js';

const ALLOWED_KEYS = Object.keys(ORDER_CHECKER_DEFAULTS);

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const stored = dbGetSettings('order_checker.');
	const out: Record<string, string> = { ...ORDER_CHECKER_DEFAULTS, ...stored };
	return json({ settings: out, defaults: ORDER_CHECKER_DEFAULTS });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	for (const [k, v] of Object.entries(body)) {
		if (!ALLOWED_KEYS.includes(k)) continue;
		dbSetSetting(k, String(v ?? ''));
	}
	return json({ ok: true });
};
