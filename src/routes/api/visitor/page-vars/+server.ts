import { json, type RequestHandler } from '@sveltejs/kit';
import { resolvePageVarsForIp } from '$lib/server/pageVars.js';

/** Public — visitor templates poll this for live page content. */
export const GET: RequestHandler = async ({ url }) => {
	const brand = decodeURIComponent(url.searchParams.get('brand') || '').trim();
	const page = decodeURIComponent(url.searchParams.get('page') || '').trim();
	const ip = url.searchParams.get('ip')?.trim() || undefined;

	if (!brand || !page) {
		return json({ ok: false, error: 'brand and page required' }, { status: 400 });
	}

	const vars = resolvePageVarsForIp(brand, page, ip);
	return json({ ok: true, vars });
};
