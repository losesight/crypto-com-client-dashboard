import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetVaultCases, dbGetVaultOverview } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const search = url.searchParams.get('search') || undefined;
	const moduleFilter = url.searchParams.get('module') || undefined;
	const activity = url.searchParams.get('activity') || undefined;

	const cases = dbGetVaultCases({ search, module: moduleFilter, activity });
	const overview = dbGetVaultOverview();
	return json({ cases, overview });
};
