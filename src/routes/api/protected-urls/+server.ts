import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetProtectedUrls, dbInsertProtectedUrl } from '$lib/server/database.js';
import crypto from 'node:crypto';

function makeShortCode(): string {
	return crypto.randomBytes(4).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const all = url.searchParams.get('all') === 'true' && locals.user.role === 'admin';
	const list = dbGetProtectedUrls(all ? undefined : locals.user.username);
	const stats = {
		total: list.length,
		clicks: list.reduce((s, u) => s + u.clicks, 0),
		active: list.filter((u) => u.status === 'active').length
	};
	return json({ urls: list, stats });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json()) as {
		originalUrl?: string;
		domain?: string;
		expiresInSeconds?: number;
	};
	const originalUrl = (body.originalUrl || '').trim();
	if (!originalUrl) throw error(400, 'originalUrl is required');

	const expiresAt =
		body.expiresInSeconds && body.expiresInSeconds > 0
			? Date.now() + body.expiresInSeconds * 1000
			: 0;

	const created = dbInsertProtectedUrl({
		shortCode: makeShortCode(),
		originalUrl,
		domain: body.domain || '',
		clicks: 0,
		status: 'active',
		ownerUsername: locals.user.username,
		createdAt: Date.now(),
		expiresAt
	});
	return json({ ok: true, url: created });
};
