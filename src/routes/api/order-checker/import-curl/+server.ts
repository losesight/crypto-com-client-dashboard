/**
 * Parse a cURL command copied from browser DevTools and return the canonical
 * probe settings the operator can paste into the Order Checker / Settings.
 *
 * Operators copy the request from DevTools after solving Cloudflare's challenge
 * in their real browser; we extract URL / method / headers / body and turn the
 * captured email + order ref into {{email}} / {{orderRef}} placeholders so the
 * body becomes a reusable template.
 */
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { bodyToTemplate, parseCurlCommand } from '$lib/server/orderChecker.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json().catch(() => ({}))) as {
		curl?: string;
		sampleEmail?: string;
		sampleOrderRef?: string;
	};
	const parsed = parseCurlCommand(String(body.curl || ''));
	const sampleEmail = String(body.sampleEmail || '').trim();
	const sampleOrderRef = String(body.sampleOrderRef || '').trim();
	const bodyTemplate = parsed.body ? bodyToTemplate(parsed.body, sampleEmail, sampleOrderRef) : '';
	return json({
		ok: !!parsed.url,
		probeUrl: parsed.url || '',
		method: parsed.method || 'POST',
		headers: parsed.headers || {},
		bodyTemplate
	});
};
