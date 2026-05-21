import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { dbDeleteUser } from '$lib/server/database.js';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (locals.user.role !== 'admin') throw error(403, 'Forbidden');

	const id = params.id;
	if (!id) throw error(400, 'Missing user id');

	if (String(locals.user.id) === id) {
		throw error(400, 'Cannot delete your own account');
	}

	dbDeleteUser(id);
	return json({ ok: true });
};
