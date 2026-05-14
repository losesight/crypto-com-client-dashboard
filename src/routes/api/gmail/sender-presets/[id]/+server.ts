import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbDeleteGmailSenderPreset } from '$lib/server/database.js';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	dbDeleteGmailSenderPreset(params.id || '');
	return json({ ok: true });
};
