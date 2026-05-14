import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetDomains, dbUpdateDomain } from '$lib/server/database.js';
import { serverState } from '$lib/server/state.js';
import { setUnderAttackMode } from '$lib/server/cloudflare.js';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const domain = serverState.domains.find((d) => d.id === params.id);
	if (!domain) throw error(404, 'Domain not found');

	const body = (await request.json()) as { enabled?: boolean };
	const enabled = body.enabled !== undefined ? !!body.enabled : !domain.underAttack;

	const cfOk = await setUnderAttackMode(domain.domain, enabled);
	dbUpdateDomain(domain.id, { underAttack: enabled });
	serverState.domains = dbGetDomains();
	const updated = serverState.domains.find((d) => d.id === domain.id);
	return json({ ok: true, applied: cfOk, domain: updated });
};
