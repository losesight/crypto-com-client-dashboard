import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { dbQuerySeeds } from '$lib/server/database.js';
import { requireAdmin } from '$lib/server/auth.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	requireAdmin(locals);
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10)));
	const search = url.searchParams.get('search') || undefined;
	const moduleFilter = url.searchParams.get('module') || undefined;
	const status = url.searchParams.get('status') || undefined;
	const sort = (url.searchParams.get('sort') as 'created_at' | 'visitor_ip') || 'created_at';
	const dir = (url.searchParams.get('dir') as 'asc' | 'desc') || 'desc';

	const { rows, total } = dbQuerySeeds({ page, limit, search, module: moduleFilter, status, sort, dir });
	return json({ rows, total, page, limit });
};
