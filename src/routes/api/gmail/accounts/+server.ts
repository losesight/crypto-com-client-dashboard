import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetGmailAccounts, dbDeleteGmailAccount } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	return json({ accounts: dbGetGmailAccounts(locals.user.username) });
};
