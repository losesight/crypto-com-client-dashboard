/**
 * Public visitor disconnect beacon (tab close / navigate away).
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { registerVisitorDisconnect } from '$lib/server/visitorConnect.js';

export const POST: RequestHandler = async ({ getClientAddress }) => {
	registerVisitorDisconnect(getClientAddress() || '');
	return json({ ok: true });
};
