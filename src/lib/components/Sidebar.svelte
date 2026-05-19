<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		LayoutDashboard,
		GitGraph,
		UsersRound,
		Mail,
		Settings,
		LogOut,
		Globe,
		Users,
		Inbox,
		ChevronDown,
		User,
		Wrench,
		MessageCircle,
		Eye,
		ListTodo,
		FileCode,
		MessageSquare,
		AtSign,
		Database,
		Vault,
		Wifi,
		KeyRound,
		PanelLeftClose,
		PanelLeftOpen
	} from 'lucide-svelte';
	import { connected } from '$lib/stores/websocket';
	import ChatPanel from './ChatPanel.svelte';

	const COLLAPSE_KEY = 'sidebar-collapsed';
	/**
	 * Below this viewport width the panel auto-collapses regardless of the
	 * user's saved preference, so the main content area has more than a
	 * sliver of room. The saved preference still controls behaviour above
	 * this breakpoint.
	 */
	const AUTO_COLLAPSE_BREAKPOINT = 1024;

	let chatOpen = $state(false);
	let collapsed = $state(false);

	const panelItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/sessions', label: 'Sessions', icon: ListTodo },
		{ href: '/users', label: 'Users', icon: Users },
		{ href: '/domains', label: 'Domains', icon: Globe },
		{ href: '/flows', label: 'Flows', icon: GitGraph },
		{ href: '/cases', label: 'Cases', icon: KeyRound },
		{ href: '/control', label: 'Control', icon: UsersRound }
	];

	const utilsItems = [
		{ href: '/mailer', label: 'Mailer', icon: Mail },
		{ href: '/templates', label: 'Templates', icon: FileCode },
		{ href: '/sms', label: 'SMS', icon: MessageSquare },
		{ href: '/gmail', label: 'Gmail', icon: AtSign },
		{ href: '/seeds', label: 'Seeds', icon: Database },
		{ href: '/vault', label: 'Vault', icon: Vault },
		{ href: '/livechat', label: 'Live Chat', icon: Wifi, showLiveDot: true },
		{ href: '/inbox-filter', label: 'Inbox Filter', icon: Inbox },
		{ href: '/preview', label: 'Page Preview', icon: Eye }
	];

	let utilsOpen = $state(true);
	let userMenuOpen = $state(false);
	let userMenuEl: HTMLDivElement | undefined = $state();

	let username = $derived($page.data.user?.username ?? 'admin');
	let role = $derived($page.data.user?.role ?? 'admin');
	let initials = $derived(
		(username || 'AD')
			.split(/[\s_-]/)
			.map((p: string) => p[0] || '')
			.join('')
			.slice(0, 2)
			.toUpperCase()
	);

	let savedPreference = $state<boolean | null>(null);

	function applyViewportRules() {
		if (typeof window === 'undefined') return;
		if (window.innerWidth < AUTO_COLLAPSE_BREAKPOINT) {
			collapsed = true;
		} else if (savedPreference !== null) {
			collapsed = savedPreference;
		}
	}

	onMount(() => {
		try {
			savedPreference = localStorage.getItem(COLLAPSE_KEY) === '1';
		} catch {
			savedPreference = false;
		}
		applyViewportRules();
		const onResize = () => applyViewportRules();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	function toggleCollapsed() {
		collapsed = !collapsed;
		savedPreference = collapsed;
		userMenuOpen = false;
		try {
			localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
		} catch {}
	}

	function isActive(pathname: string, href: string): boolean {
		return pathname === href || pathname.startsWith(href + '/');
	}

	async function logout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
		} catch {}
		await goto('/login', { invalidateAll: true });
	}

	function handleDocClick(e: MouseEvent) {
		if (!userMenuOpen) return;
		const target = e.target as Node;
		if (userMenuEl && !userMenuEl.contains(target)) {
			userMenuOpen = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (userMenuOpen) userMenuOpen = false;
			if (chatOpen) chatOpen = false;
		}
	}
</script>

<svelte:window onclick={handleDocClick} onkeydown={handleKeydown} />

<aside
	class="flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] transition-[width] duration-200 ease-out {collapsed
		? 'w-[68px]'
		: 'w-[260px]'}"
	style="box-shadow: 8px 0 32px rgba(0, 0, 0, 0.5);"
	aria-label="Primary navigation"
>
	<div class="flex items-center gap-2.5 px-5 pt-5 pb-2 {collapsed ? 'justify-center px-2' : ''}">
		<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/15 text-[var(--text-accent)]">
			<LayoutDashboard size={16} />
		</div>
		{#if !collapsed}
			<span class="text-sm font-bold tracking-wide text-[var(--foreground)]">Panel</span>
			<button
				type="button"
				onclick={toggleCollapsed}
				aria-label="Collapse sidebar"
				title="Collapse sidebar"
				class="ml-auto rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
			>
				<PanelLeftClose size={14} aria-hidden="true" />
			</button>
		{/if}
	</div>

	{#if collapsed}
		<div class="flex justify-center px-2 pt-2">
			<button
				type="button"
				onclick={toggleCollapsed}
				aria-label="Expand sidebar"
				title="Expand sidebar"
				class="rounded-md p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
			>
				<PanelLeftOpen size={14} aria-hidden="true" />
			</button>
		</div>
	{/if}

	<div class="relative" bind:this={userMenuEl}>
		{#if collapsed}
			<a
				href="/profile"
				class="mx-2 mt-3 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--input)]/60 p-2 transition-soft hover:border-[var(--border-hover)] hover:bg-[var(--accent)]"
				title={`${username} (${role})`}
				aria-label={`Open profile for ${username}`}
			>
				<div class="relative">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)]/15 text-[11px] font-bold text-[var(--text-accent)]"
					>
						{initials}
					</div>
					<div
						class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[var(--card)] {$connected
							? 'bg-[var(--status-live)]'
							: 'bg-[var(--muted-foreground)]'}"
						aria-label={$connected ? 'Connected' : 'Disconnected'}
					></div>
				</div>
			</a>
		{:else}
			<button
				class="mx-3 mt-3 w-[calc(100%-24px)] cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--input)]/60 p-3 text-left transition-soft hover:border-[var(--border-hover)] hover:bg-[var(--accent)]"
				onclick={() => (userMenuOpen = !userMenuOpen)}
				aria-haspopup="menu"
				aria-expanded={userMenuOpen}
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/15 text-[11px] font-bold text-[var(--text-accent)]"
					>
						{initials}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold text-[var(--foreground)]">{username}</p>
						<p class="text-[11px] capitalize text-[var(--muted-foreground)]">{role}</p>
					</div>
					<div class="relative">
						<div
							class="h-2 w-2 shrink-0 rounded-full transition-colors {$connected ? 'bg-[var(--status-live)]' : 'bg-[var(--muted-foreground)]'}"
						></div>
						{#if $connected}
							<div class="absolute inset-0 h-2 w-2 rounded-full bg-[var(--status-live)] animate-pulse-dot"></div>
						{/if}
					</div>
				</div>
			</button>

			{#if userMenuOpen}
				<div
					role="menu"
					class="absolute left-3 right-3 top-full z-[60] mt-1 rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-2xl"
				>
					<a href="/profile" role="menuitem" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]" onclick={() => (userMenuOpen = false)}>
						<User size={14} />
						Profile
					</a>
					<a href="/settings" role="menuitem" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]" onclick={() => (userMenuOpen = false)}>
						<Settings size={14} />
						Settings
					</a>
					<div class="my-1 border-t border-[var(--border-subtle)]"></div>
					<button onclick={logout} role="menuitem" class="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]">
						<LogOut size={14} />
						Log out
					</button>
				</div>
			{/if}
		{/if}
	</div>

	<nav class="mt-5 flex-1 space-y-1 overflow-y-auto {collapsed ? 'px-2' : 'px-3'} pb-4 custom-scrollbar">
		{#if !collapsed}
			<p class="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Panel</p>
		{/if}
		{#each panelItems as item}
			{@const active = isActive($page.url.pathname, item.href)}
			<a
				href={item.href}
				title={collapsed ? item.label : undefined}
				aria-label={collapsed ? item.label : undefined}
				class="relative flex items-center gap-3 rounded-lg {collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'} text-sm transition-soft {active
					? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]'
					: 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'}"
			>
				{#if active}
					<span class="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--accent-primary)]"></span>
				{/if}
				<item.icon size={16} class="shrink-0" />
				{#if !collapsed}{item.label}{/if}
			</a>
		{/each}

		<button
			class="mt-3 flex w-full items-center {collapsed ? 'justify-center' : 'justify-between'} rounded-lg px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] transition-soft hover:text-[var(--muted-foreground)]"
			onclick={() => (utilsOpen = !utilsOpen)}
			aria-expanded={utilsOpen}
			aria-label={utilsOpen ? 'Collapse Utils section' : 'Expand Utils section'}
			title={collapsed ? 'Utils' : undefined}
		>
			{#if collapsed}
				<Wrench size={12} />
			{:else}
				<span class="flex items-center gap-2">
					<Wrench size={12} />
					Utils
				</span>
				<ChevronDown size={12} class="transition-transform {utilsOpen ? '' : '-rotate-90'}" />
			{/if}
		</button>

		{#if utilsOpen}
			{#each utilsItems as item}
				{@const active = isActive($page.url.pathname, item.href)}
				<a
					href={item.href}
					title={collapsed ? item.label : undefined}
					aria-label={collapsed ? item.label : undefined}
					class="relative flex items-center gap-3 rounded-lg {collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'} text-sm transition-soft {active
						? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]'
						: 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'}"
				>
					{#if active}
						<span class="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--accent-primary)]"></span>
					{/if}
					<span class="relative shrink-0">
						<item.icon size={16} />
						{#if item.showLiveDot}
							<span
								class="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-[var(--card)] {$connected
									? 'bg-[var(--status-live)]'
									: 'bg-[var(--muted-foreground)]'}"
								aria-label={$connected ? 'Live Chat: connected' : 'Live Chat: disconnected'}
								title={$connected ? 'Live Chat: real-time updates active' : 'Live Chat: reconnecting…'}
							></span>
						{/if}
					</span>
					{#if !collapsed}
						<span class="flex flex-1 items-center justify-between gap-2">
							{item.label}
							{#if item.showLiveDot}
								<span
									class="h-1.5 w-1.5 rounded-full {$connected
										? 'bg-[var(--status-live)]'
										: 'bg-[var(--muted-foreground)]'}"
									aria-hidden="true"
								></span>
							{/if}
						</span>
					{/if}
				</a>
			{/each}
		{/if}
	</nav>

	<button
		onclick={() => (chatOpen = !chatOpen)}
		aria-label={chatOpen ? 'Close chat' : 'Open chat'}
		title={chatOpen ? 'Close chat' : 'Open chat'}
		class="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl"
		style="box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);"
	>
		<MessageCircle size={20} />
	</button>

	{#if chatOpen}
		<ChatPanel onclose={() => (chatOpen = false)} />
	{/if}
</aside>
