<script lang="ts">
	import { page } from '$app/stores';
	import {
		Users,
		UserPlus,
		Clock3,
		Activity,
		Vault,
		CheckCircle2,
		Database,
		Sprout,
		RefreshCw,
		Server
	} from 'lucide-svelte';
	import { stats, sendMessage, connected } from '$lib/stores/websocket';
	import { getGreeting } from '$lib/utils/time';
	import ConnectionBadge from '$lib/components/ConnectionBadge.svelte';
	import { onMount } from 'svelte';

	let username = $derived($page.data.user?.username ?? 'admin');
	let now = $state(new Date());
	let greeting = $derived(getGreeting(now));
	let refreshing = $state(false);

	let timer: ReturnType<typeof setInterval>;
	$effect(() => {
		timer = setInterval(() => (now = new Date()), 30000);
		return () => clearInterval(timer);
	});

	async function fetchStatsRest() {
		try {
			const res = await fetch('/api/stats');
			if (res.ok) {
				const data = await res.json();
				if (data.stats) stats.set(data.stats);
			}
		} catch { /* non-critical */ }
	}

	onMount(() => { fetchStatsRest(); });

	function refreshStats() {
		refreshing = true;
		if ($connected) {
			sendMessage('stats:request', {});
		} else {
			fetchStatsRest();
		}
		setTimeout(() => (refreshing = false), 600);
	}

	type Card = {
		label: string;
		value: string | number;
		hint: string;
		icon: any;
		accent: string;
		delay: number;
	};

	let cards = $derived<Card[]>([
		{
			label: 'Total Users',
			value: $stats.totalVisitors,
			hint: 'All registered accounts',
			icon: Users,
			accent: 'text-[var(--text-accent)] bg-[var(--accent-primary)]/10',
			delay: 0
		},
		{
			label: 'Online Now',
			value: $stats.onlineVisitors,
			hint: 'Currently active',
			icon: Activity,
			accent: 'text-[var(--status-live)] bg-[var(--status-live)]/10',
			delay: 40
		},
		{
			label: 'Last 24 hours',
			value: $stats.last24h ?? 0,
			hint: 'Recent activity',
			icon: Clock3,
			accent: 'text-cyan-300 bg-cyan-500/10',
			delay: 80
		},
		{
			label: 'Last week',
			value: $stats.lastWeek ?? 0,
			hint: '7-day activity',
			icon: UserPlus,
			accent: 'text-amber-300 bg-amber-500/10',
			delay: 120
		},
		{
			label: 'Vault Setups',
			value: $stats.vaultSetups ?? 0,
			hint: 'Total configurations',
			icon: Vault,
			accent: 'text-purple-300 bg-purple-500/10',
			delay: 160
		},
		{
			label: 'Completed',
			value: `${$stats.completedSetups ?? 0}`,
			hint: 'Finished setups',
			icon: CheckCircle2,
			accent: 'text-emerald-300 bg-emerald-500/10',
			delay: 200
		},
		{
			label: 'Total Assets',
			value: $stats.totalAssets ?? 0,
			hint: 'Managed resources',
			icon: Database,
			accent: 'text-sky-300 bg-sky-500/10',
			delay: 240
		},
		{
			label: 'Active Seeds',
			value: $stats.activeSeeds ?? 0,
			hint: 'Currently monitored',
			icon: Sprout,
			accent: 'text-lime-300 bg-lime-500/10',
			delay: 280
		}
	]);
</script>

<svelte:head>
	<title>Dashboard · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<!-- Top bar -->
	<div class="mb-6 flex items-start justify-between gap-3">
		<div>
			<h1 class="text-3xl font-bold text-[var(--foreground)]">{greeting}</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">
				Welcome back, <span class="font-semibold text-[var(--foreground)]">{username}</span>
			</p>
			<div class="mt-3 flex items-center gap-2">
				<ConnectionBadge />
				<span class="text-[11px] text-[var(--text-tertiary)]">
					Server uptime: <span class="font-mono">{$stats.uptime}</span>
				</span>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<button
				onclick={refreshStats}
				disabled={refreshing}
				aria-label="Refresh dashboard stats"
				class="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-60"
				title="Refresh"
			>
				<RefreshCw size={11} class={refreshing ? 'animate-spin' : ''} />
				Refresh
			</button>
		</div>
	</div>

	<!-- KPI grid -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each cards as card}
			<div
				class="animate-fade-slide-up glass-card glow-card p-6 transition-panel"
				style="animation-delay: {card.delay}ms;"
			>
				<div class="mb-3 flex items-center justify-between">
					<p class="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{card.label}</p>
					{#if card.label === 'Completed'}
						<div class="relative h-9 w-9 shrink-0" aria-label="Completion percentage">
							<svg viewBox="0 0 36 36" class="h-9 w-9 -rotate-90">
								<circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" stroke-width="3" />
								<circle
									cx="18"
									cy="18"
									r="15.9"
									fill="none"
									stroke="rgb(34, 197, 94)"
									stroke-width="3"
									stroke-dasharray="100"
									stroke-dashoffset={100 - ($stats.completedPct ?? 0)}
									stroke-linecap="round"
								/>
							</svg>
							<div class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-emerald-300">
								{$stats.completedPct ?? 0}%
							</div>
						</div>
					{:else}
						<div class="flex h-8 w-8 items-center justify-center rounded-lg {card.accent}">
							<card.icon size={15} />
						</div>
					{/if}
				</div>
				<p class="text-3xl font-bold text-[var(--foreground)]">{card.value}</p>
				<p class="mt-2 text-[11px] text-[var(--muted-foreground)]">{card.hint}</p>
			</div>
		{/each}
	</div>

	<!-- Server card -->
	<div class="mt-6 grid gap-4 lg:grid-cols-3">
		<div class="lg:col-span-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--text-accent)]">
						<Server size={16} />
					</div>
					<div>
						<p class="text-sm font-semibold text-[var(--foreground)]">Server</p>
						<p class="text-[11px] text-[var(--muted-foreground)]">Started {$stats.uptimeStart}</p>
					</div>
				</div>
				<div class="flex items-center gap-6 text-[11px] text-[var(--muted-foreground)]">
					<div>
						<p class="uppercase tracking-wider text-[10px]">Total clients</p>
						<p class="text-sm font-semibold text-[var(--foreground)]">{$stats.totalClients}</p>
					</div>
					<div>
						<p class="uppercase tracking-wider text-[10px]">Active clients</p>
						<p class="text-sm font-semibold text-[var(--foreground)]">{$stats.activeClients}</p>
					</div>
					<div>
						<p class="uppercase tracking-wider text-[10px]">Activity rate</p>
						<p class="text-sm font-semibold text-[var(--foreground)]">{$stats.activityRate}</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
