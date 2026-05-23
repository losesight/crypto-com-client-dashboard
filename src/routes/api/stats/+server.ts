import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { serverState } from '$lib/server/state.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	return json({ stats: serverState.getStats() });
};
