import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { login, SESSION_COOKIE, SESSION_TTL_MS } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	let body: { username?: string; password?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const username = (body.username || '').trim();
	const password = body.password || '';
	if (!username || !password) {
		throw error(400, 'Username and password required');
	}

	const result = login(username, password);
	if (!result) {
		throw error(401, 'Invalid credentials');
	}

	cookies.set(SESSION_COOKIE, result.token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: Math.floor(SESSION_TTL_MS / 1000)
	});

	return json({ ok: true, user: result.user });
};
