import { error, type RequestHandler } from '@sveltejs/kit';
import { broadcast } from '$lib/server/websocket';
import { getAllPublicSmtpConfigs, removeSmtpConfig } from '$lib/server/mailer.js';
import { serverState } from '$lib/server/state';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const id = (params.id || '').trim();
	if (!id) throw error(400, 'SMTP id required');

	removeSmtpConfig(id);

	const entry = serverState.addLogEntry(
		`${locals.user.username} removed shared SMTP ${id}`,
		'action'
	);
	broadcast({ type: 'log:new', payload: entry });
	broadcast({ type: 'mailer:smtp:sync', payload: { servers: getAllPublicSmtpConfigs() } });

	return new Response(null, { status: 204 });
};
