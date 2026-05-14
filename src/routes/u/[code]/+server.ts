import type { RequestHandler } from './$types';
import { error, redirect } from '@sveltejs/kit';
import {
	dbGetProtectedUrlByCode,
	dbIncrementProtectedUrlClicks
} from '$lib/server/database.js';

export const GET: RequestHandler = async ({ params }) => {
	const code = params.code || '';
	const u = dbGetProtectedUrlByCode(code);
	if (!u) throw error(404, 'Link not found');
	if (u.status !== 'active') throw error(410, 'Link has been deactivated');
	if (u.expiresAt && u.expiresAt < Date.now()) throw error(410, 'Link has expired');

	dbIncrementProtectedUrlClicks(code);
	throw redirect(302, u.originalUrl);
};
