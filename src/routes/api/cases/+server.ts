import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetCaseCodes, dbInsertCaseCode, dbGetCaseCodeByCode } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const search = url.searchParams.get('search') || undefined;
	const moduleFilter = url.searchParams.get('module') || undefined;
	const activeParam = url.searchParams.get('active');
	const active = activeParam === null || activeParam === '' ? undefined : activeParam === '1' || activeParam === 'true';
	const codes = dbGetCaseCodes({ search, module: moduleFilter, active });
	return json({ codes });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json().catch(() => ({}))) as {
		code?: string;
		label?: string;
		module?: string;
		targetPage?: string;
		expiresAt?: number;
	};

	const rawCode = (body.code || '').toString().trim();
	const code = rawCode.replace(/\D/g, '');
	if (!code) throw error(400, 'code required (digits only)');
	if (code.length !== 6) throw error(400, 'code must be exactly 6 digits');
	if (dbGetCaseCodeByCode(code)) throw error(409, 'code already exists');

	const created = dbInsertCaseCode({
		code,
		label: (body.label || '').toString().slice(0, 200),
		module: (body.module || '').toString().slice(0, 80),
		targetPage: (body.targetPage || '').toString().slice(0, 200),
		active: true,
		ownerUsername: locals.user.username,
		createdAt: Date.now(),
		expiresAt: typeof body.expiresAt === 'number' && body.expiresAt > 0 ? body.expiresAt : 0
	});

	return json({ ok: true, code: created });
};
