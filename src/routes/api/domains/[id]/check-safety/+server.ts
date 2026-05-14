import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetDomains, dbUpdateDomain } from '$lib/server/database.js';
import { serverState } from '$lib/server/state.js';
import { checkGoogleSafety, checkMetamaskSafety } from '$lib/server/safety.js';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const domain = serverState.domains.find((d) => d.id === params.id);
	if (!domain) throw error(404, 'Domain not found');

	const [google, metamask] = await Promise.all([
		checkGoogleSafety(domain.domain),
		checkMetamaskSafety(domain.domain)
	]);
	dbUpdateDomain(domain.id, {
		googleSafety: google,
		metamaskSafety: metamask,
		lastChecked: Date.now()
	});
	serverState.domains = dbGetDomains();
	const updated = serverState.domains.find((d) => d.id === domain.id);
	return json({ ok: true, domain: updated, google, metamask });
};
