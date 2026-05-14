import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadTemplateHtml } from '$lib/server/visitorTemplates';

export const GET: RequestHandler = async ({ params }) => {
	const brand = decodeURIComponent(params.brand);
	const page = decodeURIComponent(params.page);

	const html = loadTemplateHtml(brand, page);
	if (!html) {
		throw error(404, `Unknown visitor template: ${brand}/${page}`);
	}

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
