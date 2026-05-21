import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { dbGetUsers, dbInsertUserWithPassword, hashPassword } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (locals.user.role !== 'admin') throw error(403, 'Forbidden');
	return json({ users: dbGetUsers() });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (locals.user.role !== 'admin') throw error(403, 'Forbidden');

	let body: { username?: string; password?: string; role?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const username = (body.username || '').trim();
	const password = body.password || '';
	const role = body.role === 'admin' ? 'admin' : 'user';

	if (!username || username.length < 3) throw error(400, 'Username must be at least 3 characters');
	if (password.length < 8) throw error(400, 'Password must be at least 8 characters');

	try {
		const id = dbInsertUserWithPassword(username, hashPassword(password), role, true);
		return json({ ok: true, id });
	} catch (e: any) {
		if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE' || e?.message?.includes('UNIQUE')) {
			throw error(409, 'Username already exists');
		}
		throw error(500, 'Failed to create user');
	}
};
