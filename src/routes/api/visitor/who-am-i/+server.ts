/**
 * Visitor "who am I" lookup.
 *
 * Same-origin alternative to hitting a third-party IP-geolocation provider
 * from the browser. Returns the visitor's public IP (pulled from the
 * incoming request via SvelteKit's `getClientAddress()`) and an optional
 * city / region / country resolved server-side from ipwho.is.
 *
 * Why this exists:
 * - Some networks/browsers (corporate proxies, Chromium MCP sandboxes,
 *   privacy extensions) block direct `fetch()` calls to ipwho.is / ipapi.co
 *   from page JavaScript. Letting the server make the call keeps the
 *   feature working everywhere.
 * - Even when the upstream lookup fails, we always have the IP because it
 *   comes from the request headers — no upstream needed.
 *
 * Public endpoint — the visitor templates must be able to call it
 * without authentication.
 */
import { json, type RequestHandler } from '@sveltejs/kit';

type LookupResult = {
	ip: string;
	city: string | null;
	region: string | null;
	country: string | null;
};

/**
 * Loopback / RFC1918 / link-local detection. The upstream geo-IP services
 * return junk (or error) for private IPs, so we skip the lookup entirely
 * in dev. The browser is still going to learn its IP just fine — it'll
 * just be e.g. "127.0.0.1" with no resolvable city.
 */
function isPrivateIp(ip: string): boolean {
	if (!ip) return true;
	if (ip === '::1' || ip === '127.0.0.1') return true;
	if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
	if (ip.startsWith('172.')) {
		const second = parseInt(ip.split('.')[1] ?? '0', 10);
		if (second >= 16 && second <= 31) return true;
	}
	if (ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
	return false;
}

async function lookupGeo(ip: string, fetcher: typeof fetch): Promise<Omit<LookupResult, 'ip'>> {
	if (isPrivateIp(ip)) return { city: null, region: null, country: null };

	const safe = encodeURIComponent(ip);
	try {
		const r = await fetcher(`https://ipwho.is/${safe}?fields=success,city,region,country`, {
			signal: AbortSignal.timeout(2500)
		});
		if (r.ok) {
			const j = (await r.json()) as {
				success?: boolean;
				city?: string;
				region?: string;
				country?: string;
			};
			if (j.success !== false) {
				return {
					city: j.city ?? null,
					region: j.region ?? null,
					country: j.country ?? null
				};
			}
		}
	} catch {
		/* fall through to fallback */
	}

	try {
		const r = await fetcher(`https://ipapi.co/${safe}/json/`, {
			signal: AbortSignal.timeout(2500)
		});
		if (r.ok) {
			const j = (await r.json()) as {
				city?: string;
				region?: string;
				region_code?: string;
				country_name?: string;
				country?: string;
			};
			return {
				city: j.city ?? null,
				region: j.region ?? j.region_code ?? null,
				country: j.country_name ?? j.country ?? null
			};
		}
	} catch {
		/* swallow */
	}

	return { city: null, region: null, country: null };
}

export const GET: RequestHandler = async ({ getClientAddress, fetch: serverFetch }) => {
	const ip = getClientAddress() || '';
	const geo = await lookupGeo(ip, serverFetch);
	const result: LookupResult = { ip, ...geo };
	return json(result, {
		headers: {
			'Cache-Control': 'no-store'
		}
	});
};
