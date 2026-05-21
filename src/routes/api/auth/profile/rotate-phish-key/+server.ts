import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { dbRotateAllDomainPhishKeys, dbGetDomains } from '$lib/server/database.js';
import { serverState } from '$lib/server/state.js';
import { broadcast } from '$lib/server/websocket.js';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	dbRotateAllDomainPhishKeys();
	serverState.domains = dbGetDomains();
	broadcast({ type: 'domains:updated', payload: serverState.domains });

	const logEntry = serverState.addLogEntry(
		`${locals.user.username} rotated all domain phish keys`,
		'action'
	);
	broadcast({ type: 'log:new', payload: logEntry });

	return json({ ok: true, count: serverState.domains.length });
};
