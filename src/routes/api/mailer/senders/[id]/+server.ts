import { error, type RequestHandler } from '@sveltejs/kit';
import { broadcast } from '$lib/server/websocket';
import { dbDeleteMailerSenderIdentity, dbGetMailerSenderIdentities } from '$lib/server/database.js';
import { serverState } from '$lib/server/state';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const id = (params.id || '').trim();
	if (!id) throw error(400, 'Sender id required');

	dbDeleteMailerSenderIdentity(id);

	const entry = serverState.addLogEntry(
		`${locals.user.username} removed mailer sender #${id}`,
		'action'
	);
	broadcast({ type: 'log:new', payload: entry });
	broadcast({ type: 'mailer:senders:sync', payload: { senders: dbGetMailerSenderIdentities() } });

	return new Response(null, { status: 204 });
};
