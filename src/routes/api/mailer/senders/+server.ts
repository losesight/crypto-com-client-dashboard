import { json, error, type RequestHandler } from '@sveltejs/kit';
import { broadcast } from '$lib/server/websocket';
import {
	dbDeleteMailerSenderIdentity,
	dbGetMailerSenderIdentities,
	dbInsertMailerSenderIdentity
} from '$lib/server/database.js';
import { serverState } from '$lib/server/state';

function broadcastSenderSync(): void {
	broadcast({ type: 'mailer:senders:sync', payload: { senders: dbGetMailerSenderIdentities() } });
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	return json({ senders: dbGetMailerSenderIdentities() });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	let body: {
		label?: string;
		domain?: string;
		fromEmail?: string;
		fromName?: string;
		smtpId?: string;
		notes?: string;
	} = {};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const domain = (body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
	const fromEmail = (body.fromEmail || '').trim();
	if (!domain) throw error(400, 'Domain is required');
	if (!fromEmail || !fromEmail.includes('@')) throw error(400, 'Valid from email is required');

	const created = dbInsertMailerSenderIdentity({
		label: (body.label || '').trim() || fromEmail,
		domain,
		fromEmail,
		fromName: (body.fromName || '').trim(),
		smtpId: (body.smtpId || '').trim(),
		notes: (body.notes || '').trim(),
		createdBy: locals.user.username,
		createdAt: Date.now()
	});

	const entry = serverState.addLogEntry(
		`${locals.user.username} added mailer sender ${fromEmail} (${domain})`,
		'action'
	);
	broadcast({ type: 'log:new', payload: entry });
	broadcastSenderSync();

	return json({ ok: true, sender: created });
};
