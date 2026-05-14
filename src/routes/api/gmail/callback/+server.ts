import type { RequestHandler } from './$types';
import { redirect, error } from '@sveltejs/kit';
import {
	dbGetGmailLinkByState,
	dbInsertGmailAccount,
	dbMarkGmailLinkUsed
} from '$lib/server/database.js';
import { exchangeCode, isConfigured } from '$lib/server/gmail.js';

export const GET: RequestHandler = async ({ url }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state) throw error(400, 'Missing code or state');

	const link = dbGetGmailLinkByState(state);
	if (!link) throw error(400, 'Unknown OAuth state');

	if (!isConfigured()) {
		throw error(503, 'Gmail OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.');
	}

	const tokens = await exchangeCode(code, url.origin);
	if (!tokens) throw error(500, 'Failed to exchange OAuth code');

	const account = dbInsertGmailAccount(link.label, tokens.email, tokens.refreshToken, link.ownerUsername);
	dbMarkGmailLinkUsed(state, account.id);

	throw redirect(303, '/gmail');
};
