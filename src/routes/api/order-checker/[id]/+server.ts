import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { dbDeleteOrderBatch, dbGetOrderBatch } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const batch = dbGetOrderBatch(String(params.id));
	if (!batch) throw error(404, 'batch not found');
	return json({ batch });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	dbDeleteOrderBatch(String(params.id));
	return json({ ok: true });
};
