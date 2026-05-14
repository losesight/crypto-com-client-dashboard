import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbQueryVisitors } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10)));
	const search = url.searchParams.get('search') || undefined;
	const moduleFilter = url.searchParams.get('module') || undefined;
	const onlineOnly = url.searchParams.get('onlineOnly') === 'true';
	const sort = (url.searchParams.get('sort') as 'last_active' | 'email' | 'module') || 'last_active';
	const dir = (url.searchParams.get('dir') as 'asc' | 'desc') || 'desc';

	try {
		const { rows, total } = dbQueryVisitors({
			page,
			limit,
			search,
			module: moduleFilter,
			onlineOnly,
			sort,
			dir
		});
		return json({ rows, total, page, limit });
	} catch (err: any) {
		return json({ rows: [], total: 0, page, limit, error: err?.message || 'Query failed' });
	}
};
