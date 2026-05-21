import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbDeleteCaseCode, dbGetCaseCodeById, dbUpdateCaseCode } from '$lib/server/database.js';

function canMutate(target: { ownerUsername: string }, user: { username: string; role: string }) {
	return target.ownerUsername === user.username || user.role === 'admin';
}

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const existing = dbGetCaseCodeById(params.id!);
	if (!existing) throw error(404, 'Not found');
	if (!canMutate(existing, locals.user)) throw error(403, 'Cannot edit code owned by another user');

	const body = (await request.json().catch(() => ({}))) as {
		label?: string;
		module?: string;
		targetPage?: string;
		active?: boolean;
		expiresAt?: number;
		flowId?: string;
	};

	const patch: Parameters<typeof dbUpdateCaseCode>[1] = {};
	if (typeof body.label === 'string') patch.label = body.label.slice(0, 200);
	if (typeof body.module === 'string') patch.module = body.module.slice(0, 80);
	if (typeof body.targetPage === 'string') patch.targetPage = body.targetPage.slice(0, 200);
	if (typeof body.active === 'boolean') patch.active = body.active;
	if (typeof body.expiresAt === 'number') patch.expiresAt = Math.max(0, body.expiresAt);
	if (typeof body.flowId === 'string') patch.flowId = body.flowId.slice(0, 64);

	dbUpdateCaseCode(existing.id, patch);
	return json({ ok: true, code: dbGetCaseCodeById(existing.id) });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const existing = dbGetCaseCodeById(params.id!);
	if (!existing) throw error(404, 'Not found');
	if (!canMutate(existing, locals.user)) throw error(403, 'Cannot delete code owned by another user');
	dbDeleteCaseCode(existing.id);
	return json({ ok: true });
};
