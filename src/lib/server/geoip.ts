interface GeoResult {
	flag: string;
	city: string;
	region: string;
	country: string;
}

const cache = new Map<string, GeoResult>();

const COUNTRY_FLAGS: Record<string, string> = {
	US: '\u{1F1FA}\u{1F1F8}',
	GB: '\u{1F1EC}\u{1F1E7}',
	DE: '\u{1F1E9}\u{1F1EA}',
	FR: '\u{1F1EB}\u{1F1F7}',
	JP: '\u{1F1EF}\u{1F1F5}',
	CA: '\u{1F1E8}\u{1F1E6}',
	AU: '\u{1F1E6}\u{1F1FA}',
	NL: '\u{1F1F3}\u{1F1F1}',
	BR: '\u{1F1E7}\u{1F1F7}',
	IN: '\u{1F1EE}\u{1F1F3}',
	KR: '\u{1F1F0}\u{1F1F7}',
	RU: '\u{1F1F7}\u{1F1FA}',
	CN: '\u{1F1E8}\u{1F1F3}',
	IT: '\u{1F1EE}\u{1F1F9}',
	ES: '\u{1F1EA}\u{1F1F8}',
	SE: '\u{1F1F8}\u{1F1EA}',
	CH: '\u{1F1E8}\u{1F1ED}',
	SG: '\u{1F1F8}\u{1F1EC}',
	HK: '\u{1F1ED}\u{1F1F0}',
	MX: '\u{1F1F2}\u{1F1FD}'
};

function countryCodeToFlag(code: string): string {
	if (COUNTRY_FLAGS[code]) return COUNTRY_FLAGS[code];
	const upper = code.toUpperCase();
	const first = String.fromCodePoint(0x1f1e6 + upper.charCodeAt(0) - 65);
	const second = String.fromCodePoint(0x1f1e6 + upper.charCodeAt(1) - 65);
	return first + second;
}

const FALLBACK: GeoResult = {
	flag: '\u{1F30D}',
	city: 'Unknown',
	region: '',
	country: 'Unknown'
};

export async function lookupIp(ip: string): Promise<GeoResult> {
	if (cache.has(ip)) return cache.get(ip)!;

	// Private/local IPs can't be geolocated
	if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip === '::1') {
		return FALLBACK;
	}

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3000);

		const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city`, {
			signal: controller.signal
		});
		clearTimeout(timeout);

		if (!res.ok) return FALLBACK;

		const data = await res.json();
		if (data.status !== 'success') return FALLBACK;

		const result: GeoResult = {
			flag: countryCodeToFlag(data.countryCode || ''),
			city: data.city || 'Unknown',
			region: data.regionName || '',
			country: data.country || 'Unknown'
		};

		cache.set(ip, result);
		return result;
	} catch {
		return FALLBACK;
	}
}

export function clearGeoCache(): void {
	cache.clear();
}
