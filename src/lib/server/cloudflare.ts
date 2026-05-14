// Minimal Cloudflare API wrapper. Reads CLOUDFLARE_API_TOKEN from env.
// All operations gracefully fall back to a "not configured" state when
// the env var isn't set, so the UI still renders without a real CF account.

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const CF_API = 'https://api.cloudflare.com/client/v4';

export interface CloudflareStatus {
	configured: boolean;
	zoneId?: string;
	status?: string;
	nameservers: string[];
	underAttack?: boolean;
	message?: string;
}

interface CfResponse<T> {
	success: boolean;
	errors: Array<{ code: number; message: string }>;
	result: T;
}

async function cfFetch<T>(path: string, init: RequestInit = {}): Promise<CfResponse<T> | null> {
	if (!CF_TOKEN) return null;
	try {
		const res = await fetch(`${CF_API}${path}`, {
			...init,
			headers: {
				...(init.headers || {}),
				Authorization: `Bearer ${CF_TOKEN}`,
				'Content-Type': 'application/json'
			},
			signal: AbortSignal.timeout(10000)
		});
		const data = (await res.json()) as CfResponse<T>;
		return data;
	} catch (err) {
		console.warn('[cloudflare] request failed:', (err as Error).message);
		return null;
	}
}

export async function getZoneStatus(domain: string): Promise<CloudflareStatus> {
	if (!CF_TOKEN) {
		return {
			configured: false,
			nameservers: [],
			message: 'Set CLOUDFLARE_API_TOKEN to enable Cloudflare integration'
		};
	}

	const apex = domain.split('.').slice(-2).join('.');
	const list = await cfFetch<Array<{ id: string; status: string; name_servers?: string[] }>>(
		`/zones?name=${encodeURIComponent(apex)}`
	);
	if (!list || !list.success || !list.result.length) {
		return {
			configured: true,
			nameservers: [],
			status: 'not-found',
			message: 'Zone not found in Cloudflare'
		};
	}

	const zone = list.result[0];
	const settings = await cfFetch<{ value: string }>(`/zones/${zone.id}/settings/security_level`);
	const underAttack = settings?.success && settings.result?.value === 'under_attack';

	return {
		configured: true,
		zoneId: zone.id,
		status: zone.status,
		nameservers: zone.name_servers || [],
		underAttack: !!underAttack
	};
}

export async function setUnderAttackMode(domain: string, enabled: boolean): Promise<boolean> {
	if (!CF_TOKEN) return false;
	const apex = domain.split('.').slice(-2).join('.');
	const list = await cfFetch<Array<{ id: string }>>(`/zones?name=${encodeURIComponent(apex)}`);
	if (!list || !list.success || !list.result.length) return false;

	const zone = list.result[0];
	const res = await cfFetch<unknown>(`/zones/${zone.id}/settings/security_level`, {
		method: 'PATCH',
		body: JSON.stringify({ value: enabled ? 'under_attack' : 'medium' })
	});
	return !!(res && res.success);
}

export async function syncDnsRecords(domain: string, targetIp: string): Promise<boolean> {
	if (!CF_TOKEN) return false;
	const apex = domain.split('.').slice(-2).join('.');
	const list = await cfFetch<Array<{ id: string }>>(`/zones?name=${encodeURIComponent(apex)}`);
	if (!list || !list.success || !list.result.length) return false;

	const zone = list.result[0];
	const res = await cfFetch<unknown>(`/zones/${zone.id}/dns_records`, {
		method: 'POST',
		body: JSON.stringify({
			type: 'A',
			name: domain === apex ? '@' : domain.replace(`.${apex}`, ''),
			content: targetIp,
			ttl: 1,
			proxied: true
		})
	});
	return !!(res && res.success);
}
