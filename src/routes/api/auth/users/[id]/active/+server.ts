import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { dbSetUserActive } from '$lib/server/database.js';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const id = Number(params.id);
	if (!Number.isFinite(id) || id <= 0) {
		throw error(400, 'Invalid user id');
	}

	let body: { active?: boolean };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	if (typeof body.active !== 'boolean') {
		throw error(400, '`active` must be a boolean');
	}

	dbSetUserActive(id, body.active);
	return json({ ok: true });
};
