import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetTemplates, dbInsertTemplate } from '$lib/server/database.js';
import { extractTemplateVariables } from '$lib/mailVariables.js';
import crypto from 'node:crypto';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	return json({ templates: dbGetTemplates() });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json()) as {
		name?: string;
		subject?: string;
		html?: string;
		shared?: boolean;
	};
	const name = (body.name || '').trim();
	if (!name) throw error(400, 'Name required');

	const html = body.html || '';
	const variables = extractTemplateVariables(html);
	const slug =
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '') +
		'-' +
		crypto.randomBytes(3).toString('hex');

	const created = dbInsertTemplate({
		slug,
		name,
		subject: body.subject || '',
		html,
		variables,
		ownerUsername: locals.user.username,
		shared: !!body.shared,
		createdAt: Date.now(),
		updatedAt: Date.now()
	});
	return json({ ok: true, template: created });
};
