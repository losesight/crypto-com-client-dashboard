import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetSetting, dbSetSetting } from '$lib/server/database.js';

const KEYS = ['general.standard_2fa_window_60s', 'general.authenticator_window_60s'];

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const out: Record<string, string> = {};
	for (const k of KEYS) out[k] = dbGetSetting(k) ?? '1';
	return json({ settings: out });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json()) as Record<string, boolean | string>;
	for (const [k, v] of Object.entries(body)) {
		if (!KEYS.includes(k)) continue;
		dbSetSetting(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
	}
	return json({ ok: true });
};
