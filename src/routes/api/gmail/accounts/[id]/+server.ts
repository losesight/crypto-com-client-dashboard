import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbDeleteGmailAccount, dbGetGmailAccounts } from '$lib/server/database.js';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const list = dbGetGmailAccounts();
	const target = list.find((a) => a.id === params.id);
	if (!target) throw error(404, 'Not found');
	if (target.ownerUsername !== locals.user.username && locals.user.role !== 'admin') {
		throw error(403, 'Cannot delete account owned by another user');
	}
	dbDeleteGmailAccount(target.id);
	return json({ ok: true });
};
