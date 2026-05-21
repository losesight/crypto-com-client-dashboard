import { json, type RequestHandler } from '@sveltejs/kit';
import { getLiveMarketSnapshot } from '$lib/server/cryptoPrices.js';

/** Public — visitor coin pickers poll live USD prices. */
export const GET: RequestHandler = async () => {
	const snapshot = await getLiveMarketSnapshot();
	return json(
		{ ok: true, ...snapshot },
		{ headers: { 'Cache-Control': 'public, max-age=30' } }
	);
};
