import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import * as tls from 'node:tls';
import {
	dbDeleteMailerSmtpServer,
	dbGetMailerSmtpServers,
	dbGetSettings,
	dbUpsertMailerSmtpServer,
	dbInsertEmailLog,
	type DbMailerSmtpServer
} from './database.js';

export interface SmtpConfig {
	id: string;
	label: string;
	host: string;
	port: number;
	user: string;
	password: string;
	useSSL: boolean;
	spoofable: boolean;
	createdBy?: string;
	createdAt?: number;
}

export interface SmtpConfigPublic {
	id: string;
	label: string;
	host: string;
	port: number;
	user: string;
	useSSL: boolean;
	spoofable: boolean;
	createdBy: string;
	createdAt: number;
	hasPassword: boolean;
}

const smtpConfigs: Map<string, SmtpConfig> = new Map();

function dbToConfig(row: DbMailerSmtpServer): SmtpConfig {
	return {
		id: row.id,
		label: row.label,
		host: row.host,
		port: row.port,
		user: row.username,
		password: row.password,
		useSSL: row.useSSL,
		spoofable: row.spoofable,
		createdBy: row.createdBy,
		createdAt: row.createdAt
	};
}

function configToDb(config: SmtpConfig): DbMailerSmtpServer {
	return {
		id: config.id,
		label: config.label || '',
		host: config.host,
		port: config.port,
		username: config.user,
		password: config.password,
		useSSL: config.useSSL,
		spoofable: config.spoofable,
		createdBy: config.createdBy || '',
		createdAt: config.createdAt || Date.now()
	};
}

export function toPublicSmtpConfig(config: SmtpConfig): SmtpConfigPublic {
	return {
		id: config.id,
		label: config.label || config.host,
		host: config.host,
		port: config.port,
		user: config.user,
		useSSL: config.useSSL,
		spoofable: config.spoofable,
		createdBy: config.createdBy || '',
		createdAt: config.createdAt || 0,
		hasPassword: !!config.password
	};
}

function syncMapFromDb(): void {
	smtpConfigs.clear();
	for (const row of dbGetMailerSmtpServers()) {
		smtpConfigs.set(row.id, dbToConfig(row));
	}
}

/** One-time import from legacy settings keys (`mailer.smtp.*`). */
function migrateLegacySettingsSmtp(): void {
	if (smtpConfigs.size > 0) return;
	const all = dbGetSettings('mailer.smtp.');
	for (const [, value] of Object.entries(all)) {
		if (!value) continue;
		try {
			const legacy = JSON.parse(value) as SmtpConfig;
			if (!legacy?.id || !legacy.host) continue;
			const config: SmtpConfig = {
				id: legacy.id,
				label: legacy.label || legacy.host,
				host: legacy.host,
				port: legacy.port || 587,
				user: legacy.user,
				password: legacy.password || '',
				useSSL: !!legacy.useSSL,
				spoofable: !!legacy.spoofable,
				createdBy: legacy.createdBy || 'import',
				createdAt: legacy.createdAt || Date.now()
			};
			dbUpsertMailerSmtpServer(configToDb(config));
		} catch {
			/* skip invalid */
		}
	}
	syncMapFromDb();
}

export function loadPersistedSmtpConfigs(): void {
	try {
		syncMapFromDb();
		migrateLegacySettingsSmtp();
	} catch {
		/* db may not be ready during tests */
	}
}

try {
	loadPersistedSmtpConfigs();
} catch {}

export function addSmtpConfig(config: SmtpConfig): void {
	const full: SmtpConfig = {
		...config,
		label: config.label || config.host,
		createdAt: config.createdAt || Date.now()
	};
	smtpConfigs.set(full.id, full);
	dbUpsertMailerSmtpServer(configToDb(full));
}

export function removeSmtpConfig(id: string): void {
	smtpConfigs.delete(id);
	dbDeleteMailerSmtpServer(id);
}

export function getSmtpConfig(id: string): SmtpConfig | undefined {
	return smtpConfigs.get(id);
}

export function getAllSmtpConfigs(): SmtpConfig[] {
	return Array.from(smtpConfigs.values());
}

export function getAllPublicSmtpConfigs(): SmtpConfigPublic[] {
	return getAllSmtpConfigs().map(toPublicSmtpConfig);
}

function createTransporter(config: SmtpConfig): Transporter {
	const isImplicitTLS = config.port === 465;

	return nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: isImplicitTLS,
		auth: {
			user: config.user,
			pass: config.password
		},
		tls: {
			rejectUnauthorized: false
		},
		...(!isImplicitTLS && { requireTLS: config.useSSL })
	});
}

/**
 * Verify SMTP credentials by connecting and authenticating.
 * Returns { ok: true } on success, or { ok: false, error } on failure.
 */
export async function testSmtpConnection(smtpId: string): Promise<{ ok: boolean; error?: string }> {
	const config = smtpConfigs.get(smtpId);
	if (!config) return { ok: false, error: 'SMTP server not found' };
	try {
		const transporter = createTransporter(config);
		await transporter.verify();
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
	}
}

/**
 * Test IMAP credentials (Gmail/Outlook app password verification).
 * Connects via TLS to the IMAP server, authenticates, then disconnects.
 */
export async function testImapConnection(host: string, port: number, user: string, password: string): Promise<{ ok: boolean; error?: string }> {
	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			socket.destroy();
			resolve({ ok: false, error: 'IMAP connection timeout' });
		}, 10000);

		const socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
			let buf = '';
			let loginSent = false;
			socket.on('data', (data) => {
				buf += data.toString();
				if (!loginSent && buf.includes('* OK')) {
					loginSent = true;
					socket.write(`A1 LOGIN "${user}" "${password.replace(/\s/g, '')}"\r\n`);
				} else if (loginSent && buf.includes('A1 OK')) {
					clearTimeout(timeout);
					socket.write('A2 LOGOUT\r\n');
					socket.destroy();
					resolve({ ok: true });
				} else if (loginSent && buf.includes('A1 NO')) {
					clearTimeout(timeout);
					socket.destroy();
					resolve({ ok: false, error: 'IMAP authentication failed — check email and app password' });
				}
			});
		});
		socket.on('error', (err) => {
			clearTimeout(timeout);
			resolve({ ok: false, error: err.message });
		});
	});
}

/**
 * Place a crafted email into a target's INBOX via IMAP APPEND.
 * Requires the target's IMAP credentials (email + app password).
 * The email appears in their inbox with whatever From/Subject you set.
 */
export async function imapAppendToInbox(opts: {
	imapHost: string;
	imapPort: number;
	targetEmail: string;
	targetPassword: string;
	fromName: string;
	fromEmail: string;
	subject: string;
	html: string;
	textBody?: string;
	replyTo?: string;
	folder?: string;
}): Promise<{ success: boolean; error?: string }> {
	const folder = opts.folder || 'INBOX';
	const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
	const date = new Date().toUTCString();
	const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${opts.fromEmail.split('@')[1] || 'mail'}>`;

	const fromHeader = opts.fromName
		? `"${opts.fromName}" <${opts.fromEmail}>`
		: opts.fromEmail;

	let rawMessage = `From: ${fromHeader}\r\n`;
	rawMessage += `To: ${opts.targetEmail}\r\n`;
	if (opts.replyTo) rawMessage += `Reply-To: ${opts.replyTo}\r\n`;
	rawMessage += `Subject: ${opts.subject}\r\n`;
	rawMessage += `Date: ${date}\r\n`;
	rawMessage += `Message-ID: ${messageId}\r\n`;
	rawMessage += `MIME-Version: 1.0\r\n`;
	rawMessage += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
	rawMessage += `\r\n`;
	rawMessage += `--${boundary}\r\n`;
	rawMessage += `Content-Type: text/plain; charset="utf-8"\r\n\r\n`;
	rawMessage += (opts.textBody || opts.subject) + `\r\n`;
	rawMessage += `--${boundary}\r\n`;
	rawMessage += `Content-Type: text/html; charset="utf-8"\r\n\r\n`;
	rawMessage += opts.html + `\r\n`;
	rawMessage += `--${boundary}--\r\n`;

	const messageBytes = Buffer.from(rawMessage, 'utf-8');

	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			socket.destroy();
			resolve({ success: false, error: 'IMAP timeout' });
		}, 15000);

		const socket = tls.connect({
			host: opts.imapHost,
			port: opts.imapPort,
			rejectUnauthorized: false
		}, () => {
			let buf = '';
			let step: 'greeting' | 'login' | 'select' | 'append' | 'literal' | 'done' = 'greeting';

			socket.on('data', (data) => {
				buf += data.toString();

				if (step === 'greeting' && buf.includes('* OK')) {
					step = 'login';
					buf = '';
					socket.write(`A1 LOGIN "${opts.targetEmail}" "${opts.targetPassword.replace(/\s/g, '')}"\r\n`);
				} else if (step === 'login') {
					if (buf.includes('A1 OK')) {
						step = 'select';
						buf = '';
						socket.write(`A2 SELECT "${folder}"\r\n`);
					} else if (buf.includes('A1 NO') || buf.includes('A1 BAD')) {
						clearTimeout(timeout);
						socket.destroy();
						resolve({ success: false, error: 'IMAP login failed — invalid credentials' });
					}
				} else if (step === 'select') {
					if (buf.includes('A2 OK')) {
						step = 'append';
						buf = '';
						socket.write(`A3 APPEND "${folder}" (\\Seen) {${messageBytes.length}}\r\n`);
					} else if (buf.includes('A2 NO')) {
						clearTimeout(timeout);
						socket.destroy();
						resolve({ success: false, error: `Folder "${folder}" not found` });
					}
				} else if (step === 'append' && buf.includes('+')) {
					step = 'literal';
					buf = '';
					socket.write(messageBytes);
					socket.write(Buffer.from('\r\n'));
				} else if (step === 'literal') {
					if (buf.includes('A3 OK')) {
						step = 'done';
						clearTimeout(timeout);
						socket.write('A4 LOGOUT\r\n');
						socket.destroy();
						resolve({ success: true });
					} else if (buf.includes('A3 NO') || buf.includes('A3 BAD')) {
						clearTimeout(timeout);
						socket.destroy();
						resolve({ success: false, error: 'IMAP APPEND rejected' });
					}
				}
			});
		});

		socket.on('error', (err) => {
			clearTimeout(timeout);
			resolve({ success: false, error: err.message });
		});
	});
}

export interface SendResult {
	success: boolean;
	recipient: string;
	messageId?: string;
	error?: string;
}

const ALLOWED_CUSTOM_HEADERS = new Set([
	'list-unsubscribe', 'list-unsubscribe-post',
	'x-entity-ref-id', 'in-reply-to', 'references',
	'x-priority', 'x-mailer', 'x-custom-header'
]);

function sanitizeCustomHeaders(raw?: Record<string, string>): Record<string, string> | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(raw)) {
		if (ALLOWED_CUSTOM_HEADERS.has(k.toLowerCase()) && typeof v === 'string') {
			out[k] = v;
		}
	}
	return Object.keys(out).length ? out : undefined;
}

export async function sendEmail(opts: {
	smtpId: string;
	to: string;
	subject: string;
	html: string;
	fromEmail?: string;
	fromName?: string;
	replyTo?: string;
	cc?: string;
	bcc?: string;
	templateSlug?: string;
	sentBy?: string;
	customHeaders?: Record<string, string>;
	messageId?: string;
}): Promise<SendResult> {
	const config = smtpConfigs.get(opts.smtpId);
	if (!config) {
		return { success: false, recipient: opts.to, error: 'SMTP server not found' };
	}

	const transporter = createTransporter(config);
	const from = opts.fromEmail
		? opts.fromName ? `"${opts.fromName}" <${opts.fromEmail}>` : opts.fromEmail
		: config.user;

	const headers = sanitizeCustomHeaders(opts.customHeaders);

	try {
		const info = await transporter.sendMail({
			from,
			to: opts.to,
			subject: opts.subject,
			html: opts.html,
			replyTo: opts.replyTo || undefined,
			cc: opts.cc || undefined,
			bcc: opts.bcc || undefined,
			messageId: opts.messageId || undefined,
			headers: headers || undefined
		});

		try {
			dbInsertEmailLog({
				smtpId: opts.smtpId, smtpLabel: config.label || config.host,
				fromEmail: opts.fromEmail || config.user, fromName: opts.fromName || '',
				toAddr: opts.to, cc: opts.cc || '', bcc: opts.bcc || '',
				replyTo: opts.replyTo || '', subject: opts.subject,
				templateSlug: opts.templateSlug || '', status: 'success',
				messageId: info.messageId || '', error: '',
				sentBy: opts.sentBy || '', createdAt: Date.now()
			});
		} catch { /* non-critical */ }

		return { success: true, recipient: opts.to, messageId: info.messageId };
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Unknown error';

		try {
			dbInsertEmailLog({
				smtpId: opts.smtpId, smtpLabel: config.label || config.host,
				fromEmail: opts.fromEmail || config.user, fromName: opts.fromName || '',
				toAddr: opts.to, cc: opts.cc || '', bcc: opts.bcc || '',
				replyTo: opts.replyTo || '', subject: opts.subject,
				templateSlug: opts.templateSlug || '', status: 'failed',
				messageId: '', error: message,
				sentBy: opts.sentBy || '', createdAt: Date.now()
			});
		} catch { /* non-critical */ }

		return { success: false, recipient: opts.to, error: message };
	}
}

export async function sendCampaign(opts: {
	smtpId: string;
	recipients: string[];
	subject: string;
	html: string;
	fromEmail?: string;
	fromName?: string;
	replyTo?: string;
	cc?: string;
	bcc?: string;
	templateSlug?: string;
	sentBy?: string;
}): Promise<SendResult[]> {
	const results: SendResult[] = [];

	for (const to of opts.recipients) {
		const result = await sendEmail({
			smtpId: opts.smtpId,
			to,
			subject: opts.subject,
			html: opts.html,
			fromEmail: opts.fromEmail,
			fromName: opts.fromName,
			replyTo: opts.replyTo,
			cc: opts.cc,
			bcc: opts.bcc,
			templateSlug: opts.templateSlug,
			sentBy: opts.sentBy
		});
		results.push(result);
	}

	return results;
}
