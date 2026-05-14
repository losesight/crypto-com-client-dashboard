import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import {
	dbGetSmsDevices,
	dbUpdateSmsDeviceStatus
} from '$lib/server/database.js';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const target = dbGetSmsDevices().find((d) => d.id === params.id);
	if (!target) throw error(404, 'Not found');
	if (target.ownerUsername !== locals.user.username && locals.user.role !== 'admin') {
		throw error(403, 'Cannot check device owned by another user');
	}

	let status = 'offline';
	try {
		const url = target.apiUrl.replace(/\/$/, '') + '/health';
		const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
		if (res.ok) status = 'online';
		else status = `error-${res.status}`;
	} catch (err: any) {
		status = err?.name === 'TimeoutError' ? 'timeout' : 'offline';
	}
	dbUpdateSmsDeviceStatus(target.id, status);

	const updated = dbGetSmsDevices().find((d) => d.id === target.id);
	return json({ ok: true, device: updated });
};
