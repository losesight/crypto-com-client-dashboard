// Gmail OAuth + Gmail API helpers. All operations require
// GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET env vars to actually
// hit Google. Without them the helpers return graceful failures so the UI
// continues to render and we keep our auth-link records for future use.

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

export const SCOPES = [
	'https://www.googleapis.com/auth/gmail.modify',
	'https://www.googleapis.com/auth/gmail.insert',
	'https://www.googleapis.com/auth/userinfo.email',
	'openid'
];

export function isConfigured(): boolean {
	return !!CLIENT_ID && !!CLIENT_SECRET;
}

export function getRedirectUri(origin: string): string {
	return `${origin.replace(/\/$/, '')}/api/gmail/callback`;
}

export function buildAuthUrl(state: string, origin: string): string {
	const params = new URLSearchParams({
		client_id: CLIENT_ID || 'NOT_CONFIGURED',
		redirect_uri: getRedirectUri(origin),
		response_type: 'code',
		scope: SCOPES.join(' '),
		access_type: 'offline',
		prompt: 'consent',
		state
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string, origin: string): Promise<{ refreshToken: string; accessToken: string; email: string; expiresAt: number } | null> {
	if (!isConfigured()) return null;
	try {
		const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code,
				client_id: CLIENT_ID,
				client_secret: CLIENT_SECRET,
				redirect_uri: getRedirectUri(origin),
				grant_type: 'authorization_code'
			}),
			signal: AbortSignal.timeout(10000)
		});
		if (!tokenRes.ok) return null;
		const tokens = (await tokenRes.json()) as {
			access_token?: string;
			refresh_token?: string;
			expires_in?: number;
		};
		if (!tokens.access_token) return null;

		const meRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
			headers: { Authorization: `Bearer ${tokens.access_token}` },
			signal: AbortSignal.timeout(8000)
		});
		const me = meRes.ok ? ((await meRes.json()) as { email?: string }) : { email: '' };

		return {
			refreshToken: tokens.refresh_token || '',
			accessToken: tokens.access_token,
			email: me.email || '',
			expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000
		};
	} catch (err) {
		console.warn('[gmail] OAuth exchange failed:', (err as Error).message);
		return null;
	}
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number } | null> {
	if (!isConfigured() || !refreshToken) return null;
	try {
		const res = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				refresh_token: refreshToken,
				client_id: CLIENT_ID,
				client_secret: CLIENT_SECRET,
				grant_type: 'refresh_token'
			}),
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok) return null;
		const t = (await res.json()) as { access_token?: string; expires_in?: number };
		if (!t.access_token) return null;
		return {
			accessToken: t.access_token,
			expiresAt: Date.now() + (t.expires_in || 3600) * 1000
		};
	} catch {
		return null;
	}
}

export interface InjectInput {
	accessToken: string;
	to: string;
	from: { name: string; email: string };
	replyTo?: string;
	subject: string;
	html: string;
	backdate?: number; // unix ms
	priority?: 'high' | 'normal';
	important?: boolean;
}

function encodeRfc2822(input: InjectInput): string {
	const date = new Date(input.backdate || Date.now()).toUTCString();
	const headers: string[] = [
		`From: "${input.from.name}" <${input.from.email}>`,
		`To: ${input.to}`,
		`Date: ${date}`,
		`Subject: ${input.subject}`,
		`MIME-Version: 1.0`,
		`Content-Type: text/html; charset="UTF-8"`
	];
	if (input.replyTo) headers.push(`Reply-To: ${input.replyTo}`);
	if (input.priority === 'high') {
		headers.push(`X-Priority: 1`);
		headers.push(`Importance: High`);
	}
	const raw = headers.join('\r\n') + '\r\n\r\n' + input.html;
	return Buffer.from(raw)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

export async function injectMessage(input: InjectInput & { important?: boolean }): Promise<{ ok: boolean; error?: string; messageId?: string }> {
	if (!isConfigured()) {
		return { ok: false, error: 'Gmail OAuth not configured (set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET)' };
	}
	if (!input.accessToken) return { ok: false, error: 'No access token' };

	const raw = encodeRfc2822(input);
	const labelIds: string[] = ['INBOX'];
	if (input.important) labelIds.push('IMPORTANT');

	try {
		const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/insert?internalDateSource=dateHeader', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${input.accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ raw, labelIds }),
			signal: AbortSignal.timeout(15000)
		});
		const data = (await res.json()) as { id?: string; error?: { message?: string } };
		if (!res.ok) return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
		return { ok: true, messageId: data.id };
	} catch (err: any) {
		return { ok: false, error: err?.message || 'Network error' };
	}
}
