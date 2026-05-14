import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetTemplates, dbInsertTemplate } from '$lib/server/database.js';
import crypto from 'node:crypto';

function extractVariables(html: string): string[] {
	const found = new Set<string>();
	const re = /\{\{\s*([^{}]+?)\s*\}\}/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) !== null) {
		found.add(`{{${m[1].trim()}}}`);
	}
	return [...found];
}

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
	const variables = extractVariables(html);
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
