import { writable, derived, get } from 'svelte/store';

export interface VisitorSettings {
	'visitor.site_enabled': string;
	'visitor.landing_enabled': string;
	'visitor.use_phishkey_on_custom_domains': string;
	'visitor.disable_devtools': string;
	'visitor.enable_flow_auto_redirect': string;
	'visitor.audio_toast': string;
	'visitor.page_toast': string;
	'visitor.default_landing_template': string;
	'visitor.display_font': string;
}

const DEFAULTS: VisitorSettings = {
	'visitor.site_enabled': '1',
	'visitor.landing_enabled': '1',
	'visitor.use_phishkey_on_custom_domains': '0',
	'visitor.disable_devtools': '0',
	'visitor.enable_flow_auto_redirect': '0',
	'visitor.audio_toast': '0',
	'visitor.page_toast': '1',
	'visitor.default_landing_template': '',
	'visitor.display_font': 'sans'
};

export const visitorSettings = writable<VisitorSettings>({ ...DEFAULTS });

export const audioToastEnabled = derived(
	visitorSettings,
	($s) => $s['visitor.audio_toast'] === '1'
);
export const pageToastEnabled = derived(
	visitorSettings,
	($s) => $s['visitor.page_toast'] === '1'
);

export async function loadVisitorSettings(): Promise<void> {
	if (typeof window === 'undefined') return;
	try {
		const res = await fetch('/api/settings/visitor');
		if (!res.ok) return;
		const data = (await res.json()) as { settings: Partial<VisitorSettings> };
		visitorSettings.update((s) => ({ ...s, ...data.settings }));
	} catch {
		// ignore – fall back to defaults
	}
}

export async function saveVisitorSettings(
	patch: Partial<VisitorSettings>
): Promise<boolean> {
	try {
		const res = await fetch('/api/settings/visitor', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(patch)
		});
		if (!res.ok) return false;
		visitorSettings.update((s) => ({ ...s, ...patch } as VisitorSettings));
		return true;
	} catch {
		return false;
	}
}

export function getVisitorSetting<K extends keyof VisitorSettings>(key: K): string {
	return get(visitorSettings)[key];
}
