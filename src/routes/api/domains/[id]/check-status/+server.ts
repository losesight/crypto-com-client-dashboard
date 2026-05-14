import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetDomains, dbUpdateDomain } from '$lib/server/database.js';
import { serverState } from '$lib/server/state.js';
import { getZoneStatus } from '$lib/server/cloudflare.js';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const domain = serverState.domains.find((d) => d.id === params.id);
	if (!domain) throw error(404, 'Domain not found');

	const cf = await getZoneStatus(domain.domain);
	dbUpdateDomain(domain.id, {
		cfStatus: cf.configured ? (cf.status as any) || 'unknown' : 'unknown',
		cfNsPrimary: cf.nameservers[0] || '',
		cfNsSecondary: cf.nameservers[1] || '',
		underAttack: cf.underAttack ?? domain.underAttack,
		lastChecked: Date.now()
	});
	serverState.domains = dbGetDomains();
	const updated = serverState.domains.find((d) => d.id === domain.id);
	return json({ ok: true, domain: updated, cf });
};
