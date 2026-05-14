export interface Theme {
	id: string;
	name: string;
	description: string;
	swatches: { background: string; surface: string; primary: string; success: string; warning: string; danger: string };
	tokens: Record<string, string>;
}

const t = (
	id: string,
	name: string,
	description: string,
	background: string,
	surface: string,
	primary: string,
	success: string,
	warning: string,
	danger: string,
	foreground: string,
	muted: string,
	border: string,
	accent: string,
	textAccent: string
): Theme => ({
	id,
	name,
	description,
	swatches: { background, surface, primary, success, warning, danger },
	tokens: {
		'--background': background,
		'--card': surface,
		'--input': surface,
		'--accent': accent,
		'--accent-primary': primary,
		'--accent-glow': primary + '33',
		'--text-accent': textAccent,
		'--text-tertiary': muted + 'cc',
		'--foreground': foreground,
		'--muted-foreground': muted,
		'--border': border,
		'--border-subtle': border + '88',
		'--border-hover': primary + '66',
		'--status-live': success,
		'--status-test': warning,
		'--destructive': danger,
		'--shadow-sm': '0 4px 16px -4px rgba(0,0,0,0.4)'
	}
});

export const THEMES: Theme[] = [
	t('vercel', 'Vercel', 'Minimal monochrome with subtle elevation', '#0a0a0a', '#161618', '#ffffff', '#3eea91', '#f5d65b', '#fb6675', '#fafafa', '#9aa0a6', '#27272a', '#1a1a1d', '#fafafa'),
	t('obsidian', 'Obsidian', 'Default dark theme with deep blacks', '#0b0d10', '#14171c', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#f4f4f5', '#8a8f99', '#2a2d35', '#1a1d24', '#c4b5fd'),
	t('carbon', 'Carbon', 'Modern carbon black theme', '#0c0c0c', '#1a1a1a', '#3ddc97', '#3ddc97', '#fbbf24', '#ef4444', '#f4f4f4', '#888', '#262626', '#1a1a1a', '#3ddc97'),
	t('nord', 'Nord', 'Arctic inspired color palette', '#2e3440', '#3b4252', '#88c0d0', '#a3be8c', '#ebcb8b', '#bf616a', '#eceff4', '#d8dee9', '#4c566a', '#434c5e', '#88c0d0'),
	t('aurora', 'Aurora', 'Northern lights inspired gradient theme', '#0d1421', '#1a2332', '#5eead4', '#22c55e', '#facc15', '#f43f5e', '#f0fdfa', '#94a3b8', '#1e293b', '#172033', '#5eead4'),
	t('neon', 'Neon Dreams', 'Cyberpunk neon with electric colors', '#0a0014', '#1a0030', '#ff00ff', '#00ff9f', '#ffd700', '#ff3366', '#ffffff', '#aa88ff', '#330066', '#1f0040', '#ff00ff'),
	t('void', 'Void', 'Pure black with sharp white contrast', '#000000', '#0a0a0a', '#ffffff', '#22c55e', '#facc15', '#ef4444', '#ffffff', '#888888', '#1a1a1a', '#0e0e0e', '#ffffff'),
	t('abyss', 'Abyss', 'Deep black with crimson accents', '#050505', '#0f0a0a', '#dc2626', '#22c55e', '#fbbf24', '#ef4444', '#fff5f5', '#a78b8b', '#3b1f1f', '#1a0a0a', '#fb7185'),
	t('monolith', 'Monolith', 'Concrete gray with electric blue', '#1f1f23', '#2a2a2f', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#f5f5f7', '#9ca3af', '#3a3a40', '#2a2a2f', '#60a5fa'),
	t('phantom', 'Phantom', 'Ghost gray with violet highlights', '#1c1b22', '#26252e', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#f5f3ff', '#a3a3a3', '#3a3845', '#26252e', '#c4b5fd'),
	t('onyx', 'Onyx', 'Jet black with emerald accents', '#0c0c0c', '#161616', '#10b981', '#10b981', '#facc15', '#ef4444', '#ecfdf5', '#9ca3af', '#262626', '#1a1a1a', '#34d399'),
	t('inferno', 'Inferno', 'Dark fire with molten orange and gold', '#140804', '#22110a', '#f97316', '#22c55e', '#fbbf24', '#ef4444', '#fff7ed', '#a8907a', '#3a1d10', '#22110a', '#fb923c'),
	t('glacier', 'Glacier', 'Frozen depths with icy cyan', '#0a1422', '#13243d', '#22d3ee', '#22c55e', '#fcd34d', '#fb7185', '#ecfeff', '#94a3b8', '#1e3a5f', '#13243d', '#67e8f9'),
	t('velvet', 'Velvet', 'Luxurious deep purple with gold', '#1a0d2e', '#26143d', '#facc15', '#22c55e', '#facc15', '#fb7185', '#fdf6e3', '#a89bb8', '#3d2050', '#26143d', '#fde047'),
	t('greeny', 'Greeny', 'Fresh green theme with modern aesthetics', '#0d1f14', '#142b1f', '#22c55e', '#22c55e', '#fbbf24', '#ef4444', '#ecfdf5', '#86b89e', '#1f3d2c', '#142b1f', '#4ade80'),
	t('twitter', 'Twitter', "Twitter's iconic blue with pure black background", '#000000', '#16181c', '#1d9bf0', '#22c55e', '#facc15', '#f43f5e', '#ffffff', '#71767b', '#2f3336', '#16181c', '#1d9bf0'),
	t('lofi', 'Lofi', 'Warm cozy aesthetic with earthy tones', '#1f1810', '#2a2014', '#d97706', '#16a34a', '#fbbf24', '#dc2626', '#fef3c7', '#a89578', '#3a2b1c', '#2a2014', '#fbbf24'),
	t('violet', 'Violet Bloom', 'Elegant purple theme with smooth curves', '#150c2a', '#1f1240', '#a855f7', '#22c55e', '#facc15', '#ef4444', '#faf5ff', '#a895c8', '#321c5e', '#1f1240', '#c084fc'),
	t('amber', 'Amber Minimal', 'Clean minimal design with warm amber accents', '#0a0a0a', '#161616', '#fbbf24', '#22c55e', '#fbbf24', '#ef4444', '#fef3c7', '#a8a29e', '#262626', '#1a1a1a', '#fcd34d')
];

export function getTheme(id: string): Theme | undefined {
	return THEMES.find((t) => t.id === id);
}
