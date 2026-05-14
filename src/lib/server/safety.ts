// Lightweight safety-check helpers. Real implementations call out to
// third-party APIs; if no key is configured, we degrade gracefully and
// return 'unknown' (or, for MetaMask, fall back to the cached blocklist).

const GSAFE_KEY = process.env.GSAFE_KEY || '';
const METAMASK_BLOCKLIST_URL =
	process.env.METAMASK_BLOCKLIST_URL ||
	'https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json';

let metamaskBlocklist: Set<string> | null = null;
let metamaskFetchedAt = 0;

async function loadMetamaskBlocklist(): Promise<Set<string>> {
	const now = Date.now();
	if (metamaskBlocklist && now - metamaskFetchedAt < 12 * 60 * 60 * 1000) {
		return metamaskBlocklist;
	}
	try {
		const res = await fetch(METAMASK_BLOCKLIST_URL, {
			signal: AbortSignal.timeout(8000)
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = (await res.json()) as { blacklist?: string[] };
		const set = new Set<string>(data.blacklist || []);
		metamaskBlocklist = set;
		metamaskFetchedAt = now;
		return set;
	} catch (err) {
		console.warn('[safety] Failed to load MetaMask blocklist:', (err as Error).message);
		return metamaskBlocklist ?? new Set();
	}
}

export async function checkMetamaskSafety(domain: string): Promise<'safe' | 'unsafe' | 'unknown'> {
	const list = await loadMetamaskBlocklist();
	if (!list.size) return 'unknown';
	const apex = domain.split('.').slice(-2).join('.');
	return list.has(domain) || list.has(apex) ? 'unsafe' : 'safe';
}

export async function checkGoogleSafety(
	domain: string
): Promise<'safe' | 'unsafe' | 'unknown'> {
	if (!GSAFE_KEY) return 'unknown';

	try {
		const res = await fetch(
			`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(GSAFE_KEY)}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client: { clientId: 'panel-234516', clientVersion: '1.0' },
					threatInfo: {
						threatTypes: [
							'MALWARE',
							'SOCIAL_ENGINEERING',
							'UNWANTED_SOFTWARE',
							'POTENTIALLY_HARMFUL_APPLICATION'
						],
						platformTypes: ['ANY_PLATFORM'],
						threatEntryTypes: ['URL'],
						threatEntries: [
							{ url: `http://${domain}/` },
							{ url: `https://${domain}/` }
						]
					}
				}),
				signal: AbortSignal.timeout(8000)
			}
		);
		if (!res.ok) return 'unknown';
		const data = (await res.json()) as { matches?: unknown[] };
		return data.matches && data.matches.length > 0 ? 'unsafe' : 'safe';
	} catch (err) {
		console.warn('[safety] Google Safe Browsing check failed:', (err as Error).message);
		return 'unknown';
	}
}
