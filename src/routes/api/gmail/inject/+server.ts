import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import {
	dbGetGmailAccountById,
	dbUpdateGmailTokens
} from '$lib/server/database.js';
import { injectMessage, isConfigured, refreshAccessToken } from '$lib/server/gmail.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!isConfigured()) {
		return json({
			ok: false,
			error:
				'Gmail OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to enable injection.'
		});
	}

	let body: {
		accountId?: string;
		from?: { name: string; email: string };
		replyTo?: string;
		subject?: string;
		html?: string;
		backdate?: number;
		priority?: 'high' | 'normal';
		important?: boolean;
	};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	if (!body.accountId) throw error(400, 'accountId required');
	const account = dbGetGmailAccountById(body.accountId);
	if (!account) throw error(404, 'Account not found');

	let accessToken = account.accessToken;
	if (!accessToken || account.expiresAt < Date.now() + 60_000) {
		const refreshed = await refreshAccessToken(account.refreshToken);
		if (!refreshed) {
			return json({ ok: false, error: 'Could not refresh OAuth access token' });
		}
		accessToken = refreshed.accessToken;
		dbUpdateGmailTokens(body.accountId, refreshed.accessToken, refreshed.expiresAt);
	}

	const result = await injectMessage({
		accessToken,
		to: account.email,
		from: body.from || { name: 'Sender', email: 'sender@example.com' },
		replyTo: body.replyTo,
		subject: body.subject || '',
		html: body.html || '',
		backdate: body.backdate,
		priority: body.priority || 'normal',
		important: !!body.important
	});

	return json(result);
};
