import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, getSessionUser, maybeCleanupSessions } from '$lib/server/auth.js';

const PUBLIC_ROUTES = ['/login'];
const PUBLIC_PREFIXES = [
	'/api/auth/',
	'/api/visitor/',
	'/api/data/',
	'/api/host/',
	'/api/gmail/callback',
	'/preview/',
	'/templates/preview/',
	'/u/',
	'/images/',
	'/_next/',
	'/_app/',
	'/favicon'
];

export const handle: Handle = async ({ event, resolve }) => {
	maybeCleanupSessions();

	const token = event.cookies.get(SESSION_COOKIE);
	const user = getSessionUser(token);
	event.locals.user = user;
	event.locals.sessionToken = token;

	const path = event.url.pathname;
	const isPublic =
		PUBLIC_ROUTES.includes(path) ||
		PUBLIC_PREFIXES.some((p) => path.startsWith(p)) ||
		path === '/';

	if (!user && !isPublic) {
		const redirectTo = encodeURIComponent(path + event.url.search);
		throw redirect(303, `/login?redirect=${redirectTo}`);
	}

	if (user && path === '/login') {
		throw redirect(303, '/dashboard');
	}

	return resolve(event);
};
