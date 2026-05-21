import { json, error, type RequestHandler } from '@sveltejs/kit';
import { broadcast } from '$lib/server/websocket';
import {
	addSmtpConfig,
	getAllPublicSmtpConfigs,
	getSmtpConfig,
	removeSmtpConfig,
	toPublicSmtpConfig
} from '$lib/server/mailer.js';
import { serverState } from '$lib/server/state';

function broadcastSmtpSync(): void {
	broadcast({ type: 'mailer:smtp:sync', payload: { servers: getAllPublicSmtpConfigs() } });
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	return json({ servers: getAllPublicSmtpConfigs() });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	let body: {
		id?: string;
		label?: string;
		host?: string;
		port?: number;
		user?: string;
		password?: string;
		useSSL?: boolean;
		spoofable?: boolean;
	} = {};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const host = (body.host || '').trim();
	const user = (body.user || '').trim();
	if (!host || !user) throw error(400, 'SMTP host and username are required');

	const id = (body.id || crypto.randomUUID()).trim();
	const existing = getSmtpConfig(id);
	const password = (body.password || '').trim();

	if (!password && !existing) {
		throw error(400, 'SMTP password is required for new servers');
	}

	addSmtpConfig({
		id,
		label: (body.label || '').trim() || host,
		host,
		port: Number(body.port) || 587,
		user,
		password: password || existing?.password || '',
		useSSL: !!body.useSSL,
		spoofable: !!body.spoofable,
		createdBy: existing?.createdBy || locals.user.username,
		createdAt: existing?.createdAt || Date.now()
	});

	const entry = serverState.addLogEntry(
		`${locals.user.username} saved shared SMTP ${host} (${user})`,
		'action'
	);
	broadcast({ type: 'log:new', payload: entry });
	broadcastSmtpSync();

	const saved = getSmtpConfig(id);
	return json({ ok: true, server: saved ? toPublicSmtpConfig(saved) : null });
};
