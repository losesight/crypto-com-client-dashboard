import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadTemplateHtml } from '$lib/server/visitorTemplates';

export const GET: RequestHandler = async ({ params, url }) => {
	const brand = decodeURIComponent(params.brand);
	const page = decodeURIComponent(params.page);
	const visitorIp = url.searchParams.get('ip')?.trim() || undefined;

	const html = loadTemplateHtml(brand, page, {
		visitorIp,
		lastTwoDigits: url.searchParams.get('last2') || undefined,
		emailFrom: url.searchParams.get('emailFrom') || undefined,
		emailTo: url.searchParams.get('emailTo') || undefined
	});
	if (!html) {
		throw error(404, `Unknown visitor template: ${brand}/${page}`);
	}

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-store'
		}
	});
};
