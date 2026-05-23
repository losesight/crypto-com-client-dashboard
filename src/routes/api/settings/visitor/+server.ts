import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetSetting, dbSetSetting } from '$lib/server/database.js';
import { requireAdmin } from '$lib/server/auth.js';

const BOOL_KEYS = [
	'visitor.site_enabled',
	'visitor.golden_flow_enabled',
	'visitor.landing_enabled',
	'visitor.use_phishkey_on_custom_domains',
	'visitor.disable_devtools',
	'visitor.enable_flow_auto_redirect',
	'visitor.audio_toast',
	'visitor.page_toast'
] as const;

const STRING_KEYS = [
	'visitor.default_landing_template',
	'visitor.display_font'
] as const;

const DEFAULTS: Record<string, string> = {
	'visitor.site_enabled': '1',
	'visitor.golden_flow_enabled': '1',
	'visitor.landing_enabled': '1',
	'visitor.use_phishkey_on_custom_domains': '0',
	'visitor.disable_devtools': '0',
	'visitor.enable_flow_auto_redirect': '0',
	'visitor.audio_toast': '0',
	'visitor.page_toast': '1',
	'visitor.default_landing_template': '',
	'visitor.display_font': 'sans'
};

const ALL_KEYS: ReadonlyArray<string> = [...BOOL_KEYS, ...STRING_KEYS];

const FONT_VALUES = new Set(['sans', 'mono', 'serif']);

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const out: Record<string, string> = {};
	for (const k of ALL_KEYS) out[k] = dbGetSetting(k) ?? DEFAULTS[k] ?? '';
	return json({ settings: out });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	requireAdmin(locals);
	const body = (await request.json()) as Record<string, boolean | string>;
	for (const [k, v] of Object.entries(body)) {
		if (!ALL_KEYS.includes(k)) continue;
		if ((BOOL_KEYS as ReadonlyArray<string>).includes(k)) {
			let truthy: boolean;
			if (typeof v === 'boolean') truthy = v;
			else if (typeof v === 'string') truthy = v === '1' || v.toLowerCase() === 'true';
			else truthy = !!v;
			dbSetSetting(k, truthy ? '1' : '0');
		} else if (k === 'visitor.display_font') {
			const val = String(v || 'sans');
			dbSetSetting(k, FONT_VALUES.has(val) ? val : 'sans');
		} else {
			dbSetSetting(k, String(v ?? ''));
		}
	}
	return json({ ok: true });
};
