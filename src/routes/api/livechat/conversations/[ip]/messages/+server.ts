import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import {
	dbGetConversationByIp,
	dbUpsertConversation,
	dbInsertMessage,
	dbGetMessages,
	dbMarkMessagesRead
} from '$lib/server/database.js';
import { serverState } from '$lib/server/state.js';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const ip = decodeURIComponent(params.ip || '');
	const conv = dbGetConversationByIp(ip);
	if (!conv) return json({ messages: [], conversation: null });

	const messages = dbGetMessages(conv.id);
	if (url.searchParams.get('markRead') === 'true') {
		dbMarkMessagesRead(conv.id);
	}
	return json({ messages, conversation: conv });
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const ip = decodeURIComponent(params.ip || '');
	const body = (await request.json()) as { body?: string };
	const text = (body.body || '').trim();
	if (!text) throw error(400, 'Message body required');

	let conv = dbGetConversationByIp(ip);
	if (!conv) {
		const visitor = serverState.visitors.get(ip);
		conv = dbUpsertConversation(ip, visitor?.module || '');
	}

	const msg = dbInsertMessage({
		conversationId: conv.id,
		sender: 'operator',
		authorName: locals.user.username,
		body: text,
		seen: true,
		createdAt: Date.now()
	});
	return json({ ok: true, message: msg });
};
