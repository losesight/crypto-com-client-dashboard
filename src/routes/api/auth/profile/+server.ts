import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import {
	dbGetUserByUsername,
	dbRenameUserUsername,
	dbUpdateUserProfile,
	dbDeleteSessionsByUser,
	hashPassword
} from '$lib/server/database.js';

export const PATCH: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	let body: { username?: string; password?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const userId = locals.user.id;
	const currentUsername = locals.user.username;
	const nextUsername =
		typeof body.username === 'string' ? body.username.trim() : undefined;
	const nextPassword = typeof body.password === 'string' ? body.password : undefined;

	if (nextUsername === undefined && !nextPassword) {
		throw error(400, 'Provide a new username and/or password');
	}

	if (nextUsername !== undefined) {
		if (!nextUsername) throw error(400, 'Username cannot be empty');
		if (nextUsername.length > 64) throw error(400, 'Username is too long');
		if (nextUsername !== currentUsername) {
			const taken = dbGetUserByUsername(nextUsername);
			if (taken && taken.id !== userId) {
				throw error(409, 'Username is already taken');
			}
		}
	}

	const usernameChanged =
		nextUsername !== undefined && nextUsername !== currentUsername;
	const passwordChanged = !!nextPassword;

	if (!usernameChanged && !passwordChanged) {
		return json({ ok: true, user: locals.user });
	}

	if (usernameChanged && nextUsername) {
		dbRenameUserUsername(userId, currentUsername, nextUsername);
	}

	if (passwordChanged && nextPassword) {
		dbUpdateUserProfile(userId, { passwordHash: hashPassword(nextPassword) });
		dbDeleteSessionsByUser(userId);
	}

	const user = {
		id: userId,
		username: nextUsername ?? currentUsername,
		role: locals.user.role
	};

	return json({ ok: true, user });
};
