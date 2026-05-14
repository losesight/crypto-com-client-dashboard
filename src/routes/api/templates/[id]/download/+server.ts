import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { dbGetTemplateById } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const t = dbGetTemplateById(params.id || '');
	if (!t) throw error(404, 'Not found');

	const safeName = t.name.replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();
	return new Response(t.html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Disposition': `attachment; filename="${safeName}.html"`
		}
	});
};
