/**
 * Visitor-facing coin catalog — single source for presets, pickers, and live market data.
 */
export interface CoinCatalogEntry {
	symbol: string;
	name: string;
	img: string;
	coingeckoId: string;
}

export const VISITOR_COIN_CATALOG: CoinCatalogEntry[] = [
	{
		symbol: 'BTC',
		name: 'Bitcoin',
		img: '/_next/static/media/bitcoin.44da609b.png',
		coingeckoId: 'bitcoin'
	},
	{
		symbol: 'ETH',
		name: 'Ethereum',
		img: '/_next/static/media/ethereum.0a38a4d0.png',
		coingeckoId: 'ethereum'
	},
	{
		symbol: 'USDT',
		name: 'Tether',
		img: '/_next/static/media/tether.84db185b.png',
		coingeckoId: 'tether'
	},
	{
		symbol: 'BNB',
		name: 'BNB',
		img: '/_next/static/media/bnb.b1d88c4b.png',
		coingeckoId: 'binancecoin'
	},
	{
		symbol: 'XRP',
		name: 'XRP',
		img: '/_next/static/media/xrp.cebc03fb.png',
		coingeckoId: 'ripple'
	},
	{
		symbol: 'SOL',
		name: 'Solana',
		img: '/_next/static/media/solana.0c81d69c.png',
		coingeckoId: 'solana'
	},
	{
		symbol: 'USDC',
		name: 'USD Coin',
		img: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
		coingeckoId: 'usd-coin'
	},
	{
		symbol: 'ADA',
		name: 'Cardano',
		img: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
		coingeckoId: 'cardano'
	},
	{
		symbol: 'DOGE',
		name: 'Dogecoin',
		img: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
		coingeckoId: 'dogecoin'
	},
	{
		symbol: 'AVAX',
		name: 'Avalanche',
		img: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
		coingeckoId: 'avalanche-2'
	},
	{
		symbol: 'LINK',
		name: 'Chainlink',
		img: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
		coingeckoId: 'chainlink'
	},
	{
		symbol: 'DOT',
		name: 'Polkadot',
		img: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
		coingeckoId: 'polkadot'
	},
	{
		symbol: 'MATIC',
		name: 'Polygon',
		img: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
		coingeckoId: 'matic-network'
	},
	{
		symbol: 'LTC',
		name: 'Litecoin',
		img: 'https://assets.coingecko.com/coins/images/2/small/litecoin.png',
		coingeckoId: 'litecoin'
	},
	{
		symbol: 'SHIB',
		name: 'Shiba Inu',
		img: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
		coingeckoId: 'shiba-inu'
	},
	{
		symbol: 'TRX',
		name: 'TRON',
		img: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',
		coingeckoId: 'tron'
	}
];

export function catalogBySymbol(): Record<string, CoinCatalogEntry> {
	return Object.fromEntries(VISITOR_COIN_CATALOG.map((c) => [c.symbol, c]));
}

export function formatUsdPrice(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return '—';
	if (value >= 1000) {
		return (
			'$' +
			value.toLocaleString('en-US', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			})
		);
	}
	if (value >= 1) {
		return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
	return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

export function formatChangePct(pct: number): { text: string; negative: boolean } {
	if (!Number.isFinite(pct)) return { text: '—', negative: false };
	const negative = pct < 0;
	const sign = pct > 0 ? '+' : '';
	return { text: `${sign}${pct.toFixed(2)}%`, negative };
}
