import { writable, get } from 'svelte/store';
import { THEMES, getTheme } from '$lib/themes';

export type DisplayFont = 'sans' | 'mono' | 'serif';

export const themeId = writable<string>('obsidian');
export const starfieldEnabled = writable<boolean>(false);
export const panelZoom = writable<number>(100);
export const displayFont = writable<DisplayFont>('sans');

const STORAGE_KEY = 'panel.appearance.v1';

const FONT_STACKS: Record<DisplayFont, string> = {
	sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
	mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
	serif: "'Iowan Old Style', 'Charter', 'Georgia', 'Times New Roman', serif"
};

export function loadAppearance(): void {
	if (typeof window === 'undefined') return;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const data = JSON.parse(raw);
		if (data.themeId && getTheme(data.themeId)) themeId.set(data.themeId);
		if (typeof data.starfield === 'boolean') starfieldEnabled.set(data.starfield);
		if (typeof data.zoom === 'number') panelZoom.set(data.zoom);
		if (data.displayFont && FONT_STACKS[data.displayFont as DisplayFont]) {
			displayFont.set(data.displayFont);
		}
	} catch {
		// ignore
	}
}

export function saveAppearance(): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				themeId: get(themeId),
				starfield: get(starfieldEnabled),
				zoom: get(panelZoom),
				displayFont: get(displayFont)
			})
		);
	} catch {
		// ignore
	}
}

export function applyTheme(id: string): void {
	if (typeof document === 'undefined') return;
	const theme = getTheme(id);
	if (!theme) return;
	const root = document.documentElement;
	for (const [k, v] of Object.entries(theme.tokens)) {
		root.style.setProperty(k, v);
	}
	root.setAttribute('data-theme', id);
}

export function applyZoom(percent: number): void {
	if (typeof document === 'undefined') return;
	const clamped = Math.max(50, Math.min(200, percent));
	(document.documentElement.style as any).zoom = `${clamped}%`;
}

export function applyFont(font: DisplayFont): void {
	if (typeof document === 'undefined') return;
	const stack = FONT_STACKS[font] ?? FONT_STACKS.sans;
	document.documentElement.style.setProperty('--display-font', stack);
}
