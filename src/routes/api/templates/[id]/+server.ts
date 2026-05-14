import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetTemplateById, dbUpdateTemplate, dbDeleteTemplate, dbInsertTemplate } from '$lib/server/database.js';
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

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const t = dbGetTemplateById(params.id || '');
	if (!t) throw error(404, 'Not found');
	return json({ template: t });
};

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const t = dbGetTemplateById(params.id || '');
	if (!t) throw error(404, 'Not found');
	if (t.ownerUsername && t.ownerUsername !== locals.user.username) {
		throw error(403, 'Read-only template (owned by another user)');
	}

	const body = (await request.json()) as {
		name?: string;
		subject?: string;
		html?: string;
		shared?: boolean;
	};
	const patch: Parameters<typeof dbUpdateTemplate>[1] = {};
	if (body.name !== undefined) patch.name = body.name;
	if (body.subject !== undefined) patch.subject = body.subject;
	if (body.html !== undefined) {
		patch.html = body.html;
		patch.variables = extractVariables(body.html);
	}
	if (body.shared !== undefined) patch.shared = body.shared;
	dbUpdateTemplate(t.id, patch);
	const updated = dbGetTemplateById(t.id);
	return json({ ok: true, template: updated });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const t = dbGetTemplateById(params.id || '');
	if (!t) throw error(404, 'Not found');
	if (t.ownerUsername && t.ownerUsername !== locals.user.username) {
		throw error(403, 'Cannot delete a template you do not own');
	}
	dbDeleteTemplate(t.id);
	return json({ ok: true });
};

// POST /api/templates/:id  with action=copy in JSON body — clones into current user
export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const t = dbGetTemplateById(params.id || '');
	if (!t) throw error(404, 'Not found');

	const body = await request.json().catch(() => ({}));
	if (body?.action !== 'copy') throw error(400, 'Unsupported action');

	const slug =
		t.slug.replace(/-[a-f0-9]{6}$/, '') + '-' + crypto.randomBytes(3).toString('hex');
	const cloned = dbInsertTemplate({
		slug,
		name: `${t.name} (copy)`,
		subject: t.subject,
		html: t.html,
		variables: t.variables,
		ownerUsername: locals.user.username,
		shared: false,
		createdAt: Date.now(),
		updatedAt: Date.now()
	});
	return json({ ok: true, template: cloned });
};
