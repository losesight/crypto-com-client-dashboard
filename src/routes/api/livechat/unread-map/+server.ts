import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetUnreadMap } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	return json({ unread: dbGetUnreadMap() });
};
