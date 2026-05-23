import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { dbGetVaultCases, dbGetVaultOverview } from '$lib/server/database.js';
import { requireAdmin } from '$lib/server/auth.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	requireAdmin(locals);
	const search = url.searchParams.get('search') || undefined;
	const moduleFilter = url.searchParams.get('module') || undefined;
	const activity = url.searchParams.get('activity') || undefined;

	const cases = dbGetVaultCases({ search, module: moduleFilter, activity });
	const overview = dbGetVaultOverview();
	return json({ cases, overview });
};
