<script lang="ts">
	import { X, Send, Trash2 } from 'lucide-svelte';
	import { chatMessages, sendMessage } from '$lib/stores/websocket';
	import { onMount } from 'svelte';

	let { onclose }: { onclose: () => void } = $props();

	let messageText = $state('');
	let messagesEnd: HTMLDivElement | undefined = $state();

	onMount(() => {
		sendMessage('chat:list', {});
	});

	$effect(() => {
		if ($chatMessages && messagesEnd) {
			messagesEnd.scrollIntoView({ behavior: 'smooth' });
		}
	});

	function send() {
		const text = messageText.trim();
		if (!text) return;
		sendMessage('chat:send', { text });
		messageText = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function clearAll() {
		sendMessage('chat:delete', {});
	}
</script>

<div class="fixed bottom-20 right-5 z-50 w-80 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl" style="box-shadow: 0 8px 40px rgba(0,0,0,0.5);">
	<div class="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
		<p class="text-sm font-semibold text-[var(--foreground)]">Chat</p>
		<div class="flex items-center gap-1">
			<button onclick={clearAll} aria-label="Clear all messages" title="Clear all messages" class="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]">
				<Trash2 size={13} />
			</button>
			<button onclick={onclose} aria-label="Close chat" title="Close chat" class="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">
				<X size={14} />
			</button>
		</div>
	</div>

	<div class="h-64 overflow-y-auto custom-scrollbar p-3 space-y-2">
		{#if $chatMessages.length === 0}
			<div class="flex h-full items-center justify-center">
				<p class="text-xs text-[var(--text-tertiary)]">No messages yet</p>
			</div>
		{:else}
			{#each $chatMessages as msg (msg.id)}
				<div class="rounded-lg bg-[var(--accent)]/30 px-3 py-2">
					<div class="flex items-center justify-between">
						<span class="text-[11px] font-semibold text-[var(--text-accent)]">{msg.user}</span>
						<span class="text-[10px] text-[var(--text-tertiary)]">{msg.time}</span>
					</div>
					<p class="mt-0.5 text-xs text-[var(--foreground)]">{msg.message}</p>
				</div>
			{/each}
			<div bind:this={messagesEnd}></div>
		{/if}
	</div>

	<div class="border-t border-[var(--border)] p-3">
		<div class="flex gap-2">
			<input
				bind:value={messageText}
				onkeydown={handleKeydown}
				type="text"
				placeholder="Type a message..."
				class="flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
			/>
			<button onclick={send} aria-label="Send message" title="Send" class="rounded-lg bg-[var(--accent-primary)] p-2 text-white transition-all hover:scale-105">
				<Send size={14} />
			</button>
		</div>
	</div>
</div>
