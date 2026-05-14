<script lang="ts">
	import { Wifi, WifiOff } from 'lucide-svelte';
	import { connected } from '$lib/stores/websocket';
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium {$connected
		? 'border-[var(--status-live)]/30 bg-[var(--status-live)]/10 text-[var(--status-live)]'
		: 'border-[var(--border)] bg-[var(--accent)]/30 text-[var(--muted-foreground)]'}"
	title={$connected ? 'Live updates via WebSocket' : 'Reconnecting…'}
	aria-live="polite"
>
	{#if $connected}
		<Wifi size={11} aria-hidden="true" />
		Live
	{:else}
		<WifiOff size={11} aria-hidden="true" />
		Reconnecting…
	{/if}
</span>
