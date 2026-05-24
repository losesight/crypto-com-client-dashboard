import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth.js';
import { dbQueryEmailLog, dbClearEmailLog } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	requireAdmin(locals);
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '25', 10)));
	const search = url.searchParams.get('search') || undefined;
	const status = url.searchParams.get('status') || undefined;

	const { rows, total } = dbQueryEmailLog({ page, limit, search, status });
	return json({ rows, total, page, limit });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	requireAdmin(locals);
	dbClearEmailLog();
	return json({ ok: true });
};
