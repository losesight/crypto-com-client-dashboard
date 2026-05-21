<script lang="ts">
	import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		page: number;
		total: number;
		limit: number;
		onchange: (page: number) => void;
		label?: string;
	}

	let { page, total, limit, onchange, label = 'items' }: Props = $props();

	let totalPages = $derived(Math.max(1, Math.ceil(total / limit)));
	let startIdx = $derived(total === 0 ? 0 : (page - 1) * limit + 1);
	let endIdx = $derived(Math.min(page * limit, total));

	function go(target: number) {
		const clamped = Math.max(1, Math.min(totalPages, target));
		if (clamped !== page) onchange(clamped);
	}

	function onInput(e: Event) {
		const v = parseInt((e.target as HTMLInputElement).value, 10);
		if (Number.isFinite(v)) go(v);
	}
</script>

<div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-[var(--muted-foreground)]">
	<div class="flex items-center gap-2">
		{#if total === 0}
			<span class="font-semibold text-[var(--foreground)]">0</span>
			<span>total {label}</span>
		{:else}
			<span>
				Page <span class="font-semibold text-[var(--foreground)]">{page}</span> of
				<span class="font-semibold text-[var(--foreground)]">{totalPages}</span>
			</span>
			<span class="text-[var(--text-tertiary)]">·</span>
			<span class="font-semibold text-[var(--foreground)]">{total}</span>
			<span>total {label}</span>
			<span class="text-[var(--text-tertiary)]">·</span>
			<span>Showing {startIdx}–{endIdx}</span>
		{/if}
	</div>

	{#if total > 0}
		<nav class="flex items-center gap-1" aria-label="Pagination navigation">
			<button
				onclick={() => go(1)}
				disabled={page <= 1}
				class="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
				aria-label="Go to first page"
				title="First page"
			>
				<ChevronFirst size={14} />
			</button>
			<button
				onclick={() => go(page - 1)}
				disabled={page <= 1}
				class="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
				aria-label="Go to previous page"
				title="Previous page"
			>
				<ChevronLeft size={14} />
			</button>

			<span class="flex items-center gap-1 px-2">
				<span class="text-[11px]">Go to page:</span>
				<input
					type="number"
					min="1"
					max={totalPages}
					value={page}
					onchange={onInput}
					aria-label="Enter page number"
					class="w-14 rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
				/>
			</span>

			<button
				onclick={() => go(page + 1)}
				disabled={page >= totalPages}
				class="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
				aria-label="Go to next page"
				title="Next page"
			>
				<ChevronRight size={14} />
			</button>
			<button
				onclick={() => go(totalPages)}
				disabled={page >= totalPages}
				class="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
				aria-label="Go to last page"
				title="Last page"
			>
				<ChevronLast size={14} />
			</button>
		</nav>
	{/if}
</div>
