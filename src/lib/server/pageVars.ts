import { dbGetSetting, dbSetSetting } from './database.js';
import {
	getDefaults,
	pageVarSettingKey,
	resolveDisplayVars,
	getSchema,
	type PageVarField
} from '$lib/pageVars.js';
import { buildLiveDateVars } from '$lib/dateVars.js';
import { serverState } from './state.js';

export function getStoredPageVars(brand: string, page: string): Record<string, string> {
	const raw = dbGetSetting(pageVarSettingKey(brand, page));
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw) as Record<string, string>;
		return typeof parsed === 'object' && parsed ? parsed : {};
	} catch {
		return {};
	}
}

export function setStoredPageVars(brand: string, page: string, vars: Record<string, string>): void {
	dbSetSetting(pageVarSettingKey(brand, page), JSON.stringify(vars));
}

export function resolvePageVars(
	brand: string,
	page: string,
	visitorInputs?: Record<string, string>
): Record<string, string> {
	const merged = {
		...buildLiveDateVars(),
		...getDefaults(brand, page),
		...getStoredPageVars(brand, page),
		...(visitorInputs ?? {})
	};
	return resolveDisplayVars(merged);
}

export function getPageVarConfig(brand: string, page: string): {
	schema: PageVarField[];
	defaults: Record<string, string>;
	stored: Record<string, string>;
	resolved: Record<string, string>;
} {
	const schema = getSchema(brand, page);
	const defaults = getDefaults(brand, page);
	const stored = getStoredPageVars(brand, page);
	const resolved = resolvePageVars(brand, page);
	return { schema, defaults, stored, resolved };
}

export function resolvePageVarsForIp(
	brand: string,
	page: string,
	ip?: string | null
): Record<string, string> {
	if (ip) {
		const visitor = serverState.visitors.get(ip);
		if (visitor?.inputs && Object.keys(visitor.inputs).length > 0) {
			return resolvePageVars(brand, page, visitor.inputs);
		}
	}
	return resolvePageVars(brand, page);
}
