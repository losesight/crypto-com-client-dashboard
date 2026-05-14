import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SmtpConfig {
	id: string;
	host: string;
	port: number;
	user: string;
	password: string;
	useSSL: boolean;
	spoofable: boolean;
}

const smtpConfigs: Map<string, SmtpConfig> = new Map();

export function addSmtpConfig(config: SmtpConfig): void {
	smtpConfigs.set(config.id, config);
}

export function removeSmtpConfig(id: string): void {
	smtpConfigs.delete(id);
}

export function getSmtpConfig(id: string): SmtpConfig | undefined {
	return smtpConfigs.get(id);
}

export function getAllSmtpConfigs(): SmtpConfig[] {
	return Array.from(smtpConfigs.values());
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
}): Promise<SendResult> {
	const config = smtpConfigs.get(opts.smtpId);
	if (!config) {
		return { success: false, recipient: opts.to, error: 'SMTP server not found' };
	}

	const transporter = createTransporter(config);
	const from = opts.fromEmail
		? (opts.fromName ? `"${opts.fromName}" <${opts.fromEmail}>` : opts.fromEmail)
		: config.user;

	try {
		const info = await transporter.sendMail({
			from,
			to: opts.to,
			subject: opts.subject,
			html: opts.html
		});

		return { success: true, recipient: opts.to, messageId: info.messageId };
	} catch (err: any) {
		return { success: false, recipient: opts.to, error: err.message || 'Unknown error' };
	}
}

export async function sendCampaign(opts: {
	smtpId: string;
	recipients: string[];
	subject: string;
	html: string;
	fromEmail?: string;
	fromName?: string;
}): Promise<SendResult[]> {
	const results: SendResult[] = [];

	for (const to of opts.recipients) {
		const result = await sendEmail({
			smtpId: opts.smtpId,
			to,
			subject: opts.subject,
			html: opts.html,
			fromEmail: opts.fromEmail,
			fromName: opts.fromName
		});
		results.push(result);
	}

	return results;
}
