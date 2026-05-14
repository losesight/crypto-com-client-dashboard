import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbDeleteSmsDevice, dbGetSmsDevices } from '$lib/server/database.js';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const list = dbGetSmsDevices();
	const target = list.find((d) => d.id === params.id);
	if (!target) throw error(404, 'Not found');
	if (target.ownerUsername !== locals.user.username && locals.user.role !== 'admin') {
		throw error(403, 'Cannot delete device owned by another user');
	}
	dbDeleteSmsDevice(target.id);
	return json({ ok: true });
};
