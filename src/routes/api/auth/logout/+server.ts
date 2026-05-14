import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { logout, SESSION_COOKIE } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) logout(token);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return json({ ok: true });
};
