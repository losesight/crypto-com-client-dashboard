import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth.js';
import { imapAppendToInbox } from '$lib/server/mailer.js';
import { dbInsertEmailLog } from '$lib/server/database.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	requireAdmin(locals);
	const body = (await request.json().catch(() => ({}))) as {
		imapHost?: string;
		imapPort?: number;
		targetEmail?: string;
		targetPassword?: string;
		fromName?: string;
		fromEmail?: string;
		subject?: string;
		html?: string;
		textBody?: string;
		replyTo?: string;
		folder?: string;
	};

	const targetEmail = (body.targetEmail || '').trim();
	const targetPassword = (body.targetPassword || '').trim();
	if (!targetEmail || !targetPassword) {
		return json({ ok: false, error: 'Target email and password required' }, { status: 400 });
	}
	if (!body.subject?.trim() && !body.html?.trim()) {
		return json({ ok: false, error: 'Subject or HTML body required' }, { status: 400 });
	}

	const result = await imapAppendToInbox({
		imapHost: (body.imapHost || 'imap.gmail.com').trim(),
		imapPort: body.imapPort || 993,
		targetEmail,
		targetPassword,
		fromName: body.fromName || '',
		fromEmail: body.fromEmail || targetEmail,
		subject: body.subject || '',
		html: body.html || '',
		textBody: body.textBody,
		replyTo: body.replyTo,
		folder: body.folder
	});

	try {
		dbInsertEmailLog({
			smtpId: 'imap-inject',
			smtpLabel: `IMAP ${body.imapHost || 'imap.gmail.com'}`,
			fromEmail: body.fromEmail || targetEmail,
			fromName: body.fromName || '',
			toAddr: targetEmail,
			cc: '', bcc: '',
			replyTo: body.replyTo || '',
			subject: body.subject || '',
			templateSlug: '',
			status: result.success ? 'success' : 'failed',
			messageId: '', error: result.error || '',
			sentBy: locals.user.username,
			createdAt: Date.now()
		});
	} catch { /* non-critical */ }

	return json({ ok: result.success, error: result.error });
};
