import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { sendTelegram, getTelegramConfig } from '$lib/server/telegram.js';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const cfg = getTelegramConfig();
	const result = await sendTelegram(
		`\u{2705} <b>Panel test</b>\nThis is a test message from your panel.\nOperator: ${locals.user.username}`,
		cfg
	);
	return json(result);
};
