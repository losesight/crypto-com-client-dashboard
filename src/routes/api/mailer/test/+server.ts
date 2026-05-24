import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth.js';
import { testSmtpConnection, testImapConnection } from '$lib/server/mailer.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	requireAdmin(locals);
	const body = (await request.json().catch(() => ({}))) as {
		smtpId?: string;
		mode?: 'smtp' | 'imap';
		host?: string;
		port?: number;
		user?: string;
		password?: string;
	};

	if (body.mode === 'imap') {
		const host = (body.host || 'imap.gmail.com').trim();
		const port = body.port || 993;
		const user = (body.user || '').trim();
		const password = (body.password || '').trim();
		if (!user || !password) return json({ ok: false, error: 'Email and password required' });
		const result = await testImapConnection(host, port, user, password);
		return json(result);
	}

	const smtpId = (body.smtpId || '').trim();
	if (!smtpId) return json({ ok: false, error: 'SMTP server ID required' });
	const result = await testSmtpConnection(smtpId);
	return json(result);
};
