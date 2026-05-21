import { VISITOR_COIN_CATALOG, formatChangePct, formatUsdPrice, type CoinCatalogEntry } from '../coinCatalog.js';

export interface LiveCoinQuote {
	symbol: string;
	name: string;
	img: string;
	coingeckoId: string;
	priceUsd: number;
	priceDisplay: string;
	change24hPct: number;
	changeDisplay: string;
	changeNegative: boolean;
}

export interface MarketSnapshot {
	assets: LiveCoinQuote[];
	updatedAt: number;
	stale: boolean;
}

const CACHE_MS = 45_000;
let cache: { at: number; quotes: Record<string, { usd: number; usd_24h_change: number }> } | null =
	null;

async function fetchCoingeckoPrices(
	ids: string[]
): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
	if (!ids.length) return {};
	const qs = new URLSearchParams({
		ids: ids.join(','),
		vs_currencies: 'usd',
		include_24hr_change: 'true'
	});
	const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?${qs}`, {
		headers: { accept: 'application/json' },
		signal: AbortSignal.timeout(8000)
	});
	if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
	const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
	const out: Record<string, { usd: number; usd_24h_change: number }> = {};
	for (const [id, row] of Object.entries(data)) {
		out[id] = {
			usd: Number(row.usd) || 0,
			usd_24h_change: Number(row.usd_24h_change) || 0
		};
	}
	return out;
}

function buildQuotes(
	catalog: CoinCatalogEntry[],
	prices: Record<string, { usd: number; usd_24h_change: number }>
): LiveCoinQuote[] {
	return catalog.map((c) => {
		const live = prices[c.coingeckoId];
		const priceUsd = live?.usd ?? 0;
		const change24hPct = live?.usd_24h_change ?? 0;
		const ch = formatChangePct(change24hPct);
		return {
			symbol: c.symbol,
			name: c.name,
			img: c.img,
			coingeckoId: c.coingeckoId,
			priceUsd,
			priceDisplay: formatUsdPrice(priceUsd),
			change24hPct,
			changeDisplay: ch.text,
			changeNegative: ch.negative
		};
	});
}

export async function getLiveMarketSnapshot(): Promise<MarketSnapshot> {
	const catalog = VISITOR_COIN_CATALOG;
	const ids = [...new Set(catalog.map((c) => c.coingeckoId))];
	const now = Date.now();

	if (cache && now - cache.at < CACHE_MS) {
		return {
			assets: buildQuotes(catalog, cache.quotes),
			updatedAt: cache.at,
			stale: false
		};
	}

	try {
		const quotes = await fetchCoingeckoPrices(ids);
		cache = { at: now, quotes };
		return {
			assets: buildQuotes(catalog, quotes),
			updatedAt: now,
			stale: false
		};
	} catch {
		if (cache) {
			return {
				assets: buildQuotes(catalog, cache.quotes),
				updatedAt: cache.at,
				stale: true
			};
		}
		return {
			assets: buildQuotes(catalog, {}),
			updatedAt: now,
			stale: true
		};
	}
}
