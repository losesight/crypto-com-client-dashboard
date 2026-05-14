import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetSmsDevices, dbInsertSmsDevice } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	return json({ devices: dbGetSmsDevices(locals.user.username) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json()) as { name?: string; apiUrl?: string };
	const name = (body.name || '').trim();
	const apiUrl = (body.apiUrl || '').trim();
	if (!name || !apiUrl) throw error(400, 'name and apiUrl required');
	if (!/^https?:\/\//i.test(apiUrl)) throw error(400, 'apiUrl must start with http:// or https://');

	const created = dbInsertSmsDevice({
		name,
		apiUrl,
		lastCheck: 0,
		lastStatus: 'unknown',
		ownerUsername: locals.user.username,
		createdAt: Date.now()
	});
	return json({ ok: true, device: created });
};
