import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetGmailLinks, dbInsertGmailLink } from '$lib/server/database.js';
import { buildAuthUrl, isConfigured } from '$lib/server/gmail.js';
import crypto from 'node:crypto';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const links = dbGetGmailLinks(locals.user.username);
	const origin = url.origin;
	return json({
		links: links.map((l) => ({
			...l,
			authUrl: buildAuthUrl(l.oauthState, origin)
		})),
		configured: isConfigured()
	});
};

export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json()) as { label?: string };
	const label = (body.label || '').trim();
	if (!label) throw error(400, 'Label required');

	const state = crypto.randomBytes(16).toString('hex');
	const created = dbInsertGmailLink(label, state, locals.user.username);
	return json({
		ok: true,
		link: { ...created, authUrl: buildAuthUrl(state, url.origin) }
	});
};
