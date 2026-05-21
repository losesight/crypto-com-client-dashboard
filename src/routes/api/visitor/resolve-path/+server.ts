/**
 * Resolve a template label to a visitor URL path (for admin redirect validation).
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { templateLabelToVisitorPath } from '$lib/server/visitorRouter';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		return json({ path: null }, { status: 401 });
	}

	const label = url.searchParams.get('label')?.trim() || '';
	const module = url.searchParams.get('module')?.trim() || '';
	const path = templateLabelToVisitorPath(label, module || undefined);

	return json({ path, ok: !!path });
};
