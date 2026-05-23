import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { dbGetUserByUsername, dbInsertUserWithPassword, hashPassword } from '$lib/server/database.js';

const USERNAME_MIN = 3;
const USERNAME_MAX = 32;
const PASSWORD_MIN = 8;

function isValidUsername(username: string): boolean {
	return /^[a-zA-Z0-9._-]+$/.test(username);
}

// Naive in-memory rate limit per IP: 5 attempts / 10 minutes. Resets on restart.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const attempts = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
	const now = Date.now();
	const list = (attempts.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
	if (list.length >= RATE_LIMIT_MAX) {
		attempts.set(ip, list);
		return false;
	}
	list.push(now);
	attempts.set(ip, list);
	return true;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (process.env.SIGNUP_ENABLED === '0' || process.env.SIGNUP_ENABLED === 'false') {
		throw error(403, 'Signup is disabled');
	}

	const ip = (() => {
		try {
			return getClientAddress();
		} catch {
			return 'unknown';
		}
	})();

	if (!rateLimit(ip)) {
		throw error(429, 'Too many signup attempts. Try again later.');
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
	if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
		throw error(400, `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters`);
	}
	if (!isValidUsername(username)) {
		throw error(400, 'Username may only contain letters, numbers, dot, underscore, and dash');
	}
	if (password.length < PASSWORD_MIN) {
		throw error(400, `Password must be at least ${PASSWORD_MIN} characters`);
	}

	if (dbGetUserByUsername(username)) {
		throw error(409, 'Username is already taken');
	}

	try {
		// Pending account: role=user, active=false. An admin must approve before login works.
		dbInsertUserWithPassword(username, hashPassword(password), 'user', false);
	} catch {
		throw error(500, 'Failed to create account');
	}

	return json({
		ok: true,
		pending: true,
		message: 'Account created and is pending administrator approval.'
	});
};
