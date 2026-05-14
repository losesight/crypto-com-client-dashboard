import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbUpdateProtectedUrl, dbDeleteProtectedUrl, dbGetProtectedUrls } from '$lib/server/database.js';

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const list = dbGetProtectedUrls();
	const target = list.find((u) => u.id === params.id);
	if (!target) throw error(404, 'Not found');
	if (target.ownerUsername !== locals.user.username && locals.user.role !== 'admin') {
		throw error(403, 'Cannot modify URL owned by another user');
	}
	const body = (await request.json()) as {
		status?: 'active' | 'inactive';
		originalUrl?: string;
		expiresAt?: number;
	};
	dbUpdateProtectedUrl(target.id, body);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const list = dbGetProtectedUrls();
	const target = list.find((u) => u.id === params.id);
	if (!target) throw error(404, 'Not found');
	if (target.ownerUsername !== locals.user.username && locals.user.role !== 'admin') {
		throw error(403, 'Cannot delete URL owned by another user');
	}
	dbDeleteProtectedUrl(target.id);
	return json({ ok: true });
};
