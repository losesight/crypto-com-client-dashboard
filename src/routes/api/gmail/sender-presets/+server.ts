import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetGmailSenderPresets, dbInsertGmailSenderPreset } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	return json({ presets: dbGetGmailSenderPresets(locals.user.username) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json()) as {
		name?: string;
		senderName?: string;
		senderEmail?: string;
		avatarUrl?: string;
	};
	const name = (body.name || '').trim();
	if (!name) throw error(400, 'Preset name required');

	const created = dbInsertGmailSenderPreset({
		name,
		senderName: body.senderName || '',
		senderEmail: body.senderEmail || '',
		avatarUrl: body.avatarUrl || '',
		ownerUsername: locals.user.username,
		createdAt: Date.now()
	});
	return json({ ok: true, preset: created });
};
