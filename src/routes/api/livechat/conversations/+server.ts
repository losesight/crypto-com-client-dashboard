import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetConversations } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const status = url.searchParams.get('status');
	const moduleFilter = url.searchParams.get('module') || undefined;
	const search = url.searchParams.get('search') || undefined;

	const conversations = dbGetConversations({
		activeOnly: status === 'active',
		module: moduleFilter,
		search
	});
	return json({ conversations });
};
