import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbInsertTemplate } from '$lib/server/database.js';
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

function inferTitle(html: string): string {
	const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
	if (t) return t;
	const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
	return h1 || 'Imported template';
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json()) as { name?: string; html?: string };
	const html = body.html || '';
	if (!html) throw error(400, 'HTML content required');

	const name = (body.name || inferTitle(html)).slice(0, 120);
	const slug =
		name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') +
		'-' +
		crypto.randomBytes(3).toString('hex');

	const created = dbInsertTemplate({
		slug,
		name,
		subject: '',
		html,
		variables: extractVariables(html),
		ownerUsername: locals.user.username,
		shared: false,
		createdAt: Date.now(),
		updatedAt: Date.now()
	});

	return json({ ok: true, template: created });
};
