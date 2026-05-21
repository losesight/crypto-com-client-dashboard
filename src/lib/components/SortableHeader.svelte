<script lang="ts">
	import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-svelte';

	interface Props {
		label: string;
		column: string;
		activeColumn: string;
		direction: 'asc' | 'desc';
		onsort: (column: string) => void;
	}

	let { label, column, activeColumn, direction, onsort }: Props = $props();

	let isActive = $derived(activeColumn === column);
</script>

<button
	onclick={() => onsort(column)}
	class="flex w-full items-center gap-1 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-soft"
	aria-label={isActive ? `Sort by ${label} ${direction === 'asc' ? 'descending' : 'ascending'}` : `Sort by ${label}`}
>
	<span>{label}</span>
	{#if !isActive}
		<ArrowUpDown size={11} class="text-[var(--text-tertiary)]" />
	{:else if direction === 'asc'}
		<ArrowUp size={11} class="text-[var(--text-accent)]" />
	{:else}
		<ArrowDown size={11} class="text-[var(--text-accent)]" />
	{/if}
</button>
