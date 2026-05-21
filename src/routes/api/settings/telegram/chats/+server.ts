import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { discoverTelegramChats, getTelegramConfig } from '$lib/server/telegram.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	let body: { botToken?: string } = {};
	try {
		body = await request.json();
	} catch {
		/* use saved token */
	}

	const botToken = (body.botToken ?? getTelegramConfig().botToken).trim();
	if (!botToken) throw error(400, 'Enter a bot token first');

	const result = await discoverTelegramChats(botToken);
	if (!result.ok) return json({ ok: false, error: result.error }, { status: 400 });
	return json({ ok: true, chats: result.chats });
};
