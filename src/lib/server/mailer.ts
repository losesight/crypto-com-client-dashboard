import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
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

export interface SendResult {
	success: boolean;
	recipient: string;
	messageId?: string;
	error?: string;
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
}): Promise<SendResult> {
	const config = smtpConfigs.get(opts.smtpId);
	if (!config) {
		return { success: false, recipient: opts.to, error: 'SMTP server not found' };
	}

	const transporter = createTransporter(config);
	const from = opts.fromEmail
		? opts.fromName ? `"${opts.fromName}" <${opts.fromEmail}>` : opts.fromEmail
		: config.user;

	try {
		const info = await transporter.sendMail({
			from,
			to: opts.to,
			subject: opts.subject,
			html: opts.html,
			replyTo: opts.replyTo || undefined,
			cc: opts.cc || undefined,
			bcc: opts.bcc || undefined
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
