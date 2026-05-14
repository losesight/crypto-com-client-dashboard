import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetMailerPresets, dbInsertMailerPreset } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	return json({ presets: dbGetMailerPresets(locals.user.username) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json()) as {
		name?: string;
		smtpId?: string;
		templateSlug?: string;
		senderName?: string;
		senderEmail?: string;
		replyTo?: string;
		subject?: string;
		sendMode?: 'smtp' | 'mail-server';
	};
	const name = (body.name || '').trim();
	if (!name) throw error(400, 'Preset name required');

	const created = dbInsertMailerPreset({
		name,
		smtpId: body.smtpId || '',
		templateSlug: body.templateSlug || '',
		senderName: body.senderName || '',
		senderEmail: body.senderEmail || '',
		replyTo: body.replyTo || '',
		subject: body.subject || '',
		sendMode: body.sendMode === 'mail-server' ? 'mail-server' : 'smtp',
		ownerUsername: locals.user.username,
		createdAt: Date.now()
	});
	return json({ ok: true, preset: created });
};
