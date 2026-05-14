import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetDomains, dbUpdateDomain, dbDeleteDomain } from '$lib/server/database.js';
import { serverState } from '$lib/server/state.js';
import type { CustomDomain } from '$lib/server/state.js';

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!params.id) throw error(400, 'Missing id');

	const patch = (await request.json()) as Partial<CustomDomain>;
	dbUpdateDomain(params.id, patch);
	serverState.domains = dbGetDomains();
	const updated = serverState.domains.find((d) => d.id === params.id);
	return json({ ok: true, domain: updated });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!params.id) throw error(400, 'Missing id');
	dbDeleteDomain(params.id);
	serverState.domains = dbGetDomains();
	return json({ ok: true });
};
