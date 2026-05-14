import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { serverState } from '$lib/server/state.js';
import { syncDnsRecords } from '$lib/server/cloudflare.js';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const domain = serverState.domains.find((d) => d.id === params.id);
	if (!domain) throw error(404, 'Domain not found');

	const body = (await request.json().catch(() => ({}))) as { targetIp?: string };
	const targetIp = body.targetIp || process.env.PROXY_IP || '127.0.0.1';

	const ok = await syncDnsRecords(domain.domain, targetIp);
	return json({ ok, targetIp });
};
