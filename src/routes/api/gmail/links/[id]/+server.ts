import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbDeleteGmailLink, dbGetGmailLinks } from '$lib/server/database.js';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const list = dbGetGmailLinks();
	const target = list.find((l) => l.id === params.id);
	if (!target) throw error(404, 'Not found');
	if (target.ownerUsername !== locals.user.username && locals.user.role !== 'admin') {
		throw error(403, 'Cannot delete link owned by another user');
	}
	dbDeleteGmailLink(target.id);
	return json({ ok: true });
};
