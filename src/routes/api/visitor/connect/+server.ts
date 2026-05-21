/**
 * Public visitor session registration.
 * Called by injected JS on every visitor template page load.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { registerVisitorConnect } from '$lib/server/visitorConnect.js';

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
	let body: { brand?: string; page?: string; path?: string; host?: string } = {};
	try {
		body = await request.json();
	} catch {
		/* empty body is fine */
	}

	const ip = getClientAddress() || '';
	const userAgent = request.headers.get('user-agent') || '';

	await registerVisitorConnect({
		ip,
		userAgent,
		host: body.host || url.hostname,
		path: body.path || url.pathname,
		brand: body.brand,
		page: body.page
	});

	return json({ ok: true });
};
