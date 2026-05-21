import { json, error, type RequestHandler } from '@sveltejs/kit';
import {
	getPageVarConfig,
	setStoredPageVars,
	resolvePageVars
} from '$lib/server/pageVars.js';
import { getSchema } from '$lib/pageVars.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const brand = decodeURIComponent(url.searchParams.get('brand') || '').trim();
	const page = decodeURIComponent(url.searchParams.get('page') || '').trim();
	if (!brand || !page) throw error(400, 'brand and page required');

	const config = getPageVarConfig(brand, page);
	return json({ ok: true, ...config, hasSchema: config.schema.length > 0 });
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json().catch(() => ({}))) as {
		brand?: string;
		page?: string;
		vars?: Record<string, string>;
	};

	const brand = (body.brand || '').trim();
	const page = (body.page || '').trim();
	if (!brand || !page) throw error(400, 'brand and page required');

	const schema = getSchema(brand, page);
	if (!schema.length) throw error(400, 'page has no configurable variables');

	const allowed = new Set(schema.map((f) => f.key));
	const vars: Record<string, string> = {};
	for (const [k, v] of Object.entries(body.vars ?? {})) {
		if (allowed.has(k)) vars[k] = String(v ?? '').trim();
	}

	setStoredPageVars(brand, page, vars);
	return json({
		ok: true,
		stored: vars,
		resolved: resolvePageVars(brand, page)
	});
};
