import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth.js';
import { dbDeleteOrderBatch, dbGetOrderBatch } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	requireAdmin(locals);
	const batch = dbGetOrderBatch(String(params.id));
	if (!batch) throw error(404, 'batch not found');
	return json({ batch });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	requireAdmin(locals);
	dbDeleteOrderBatch(String(params.id));
	return json({ ok: true });
};
