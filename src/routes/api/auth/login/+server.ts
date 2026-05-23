import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { login, SESSION_COOKIE, SESSION_TTL_MS } from '$lib/server/auth.js';

const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX = 10;
const loginAttempts = new Map<string, number[]>();

function loginRateLimit(ip: string): boolean {
	const now = Date.now();
	const list = (loginAttempts.get(ip) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
	if (list.length >= LOGIN_MAX) {
		loginAttempts.set(ip, list);
		return false;
	}
	list.push(now);
	loginAttempts.set(ip, list);
	return true;
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = (() => { try { return getClientAddress(); } catch { return 'unknown'; } })();
	if (!loginRateLimit(ip)) {
		throw error(429, 'Too many login attempts. Try again later.');
	}

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
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production',
		maxAge: Math.floor(SESSION_TTL_MS / 1000)
	});

	return json({ ok: true, user: result.user });
};
