<script lang="ts">
	import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-svelte';
	import { toasts, dismissToast, type ToastVariant } from '$lib/stores/toast';
	import { audioToastEnabled } from '$lib/stores/visitorSettings';
	import { playAlert } from '$lib/stores/audio';
	import { onMount } from 'svelte';

	let lastSeenId = 0;
	onMount(() => {
		const unsub = toasts.subscribe((list) => {
			if (!list.length) return;
			const newest = list[list.length - 1];
			if (newest.id > lastSeenId) {
				lastSeenId = newest.id;
				if ($audioToastEnabled) playAlert();
			}
		});
		return () => unsub();
	});

	function variantClass(v: ToastVariant): string {
		switch (v) {
			case 'success':
				return 'border-[var(--status-live)]/40 bg-[var(--status-live)]/15 text-[var(--status-live)]';
			case 'error':
				return 'border-[var(--destructive)]/40 bg-[var(--destructive)]/15 text-[var(--destructive)]';
			case 'warning':
				return 'border-amber-500/40 bg-amber-500/15 text-amber-300';
			default:
				return 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 text-[var(--text-accent)]';
		}
	}
</script>

<div
	class="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4"
	aria-live="polite"
	aria-atomic="true"
>
	{#each $toasts as t (t.id)}
		<div
			class="pointer-events-auto flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs font-medium shadow-lg backdrop-blur transition-all animate-fade-slide-up {variantClass(t.variant)}"
			role="status"
		>
			<span class="shrink-0">
				{#if t.variant === 'success'}
					<CheckCircle2 size={14} aria-hidden="true" />
				{:else if t.variant === 'error'}
					<XCircle size={14} aria-hidden="true" />
				{:else if t.variant === 'warning'}
					<AlertTriangle size={14} aria-hidden="true" />
				{:else}
					<Info size={14} aria-hidden="true" />
				{/if}
			</span>
			<span class="flex-1">{t.message}</span>
			<button
				type="button"
				onclick={() => dismissToast(t.id)}
				aria-label="Dismiss notification"
				class="shrink-0 rounded-md p-0.5 opacity-70 transition-soft hover:bg-black/20 hover:opacity-100"
			>
				<X size={12} aria-hidden="true" />
			</button>
		</div>
	{/each}
</div>
