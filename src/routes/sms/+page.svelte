<script lang="ts">
	import { onMount } from 'svelte';
	import {
		MessageSquare,
		Plus,
		RefreshCw,
		Trash2,
		Smartphone,
		Wifi,
		WifiOff,
		AlertCircle,
		X,
		Sparkles,
		Activity
	} from 'lucide-svelte';
	import { timeAgo } from '$lib/utils/time';

	interface Device {
		id: string;
		name: string;
		apiUrl: string;
		lastCheck: number;
		lastStatus: string;
		ownerUsername: string;
		createdAt: number;
	}

	const ADJECTIVES = ['Crystal', 'Analyst', 'Regular', 'Collect', 'Velvet', 'Quantum', 'Atlas', 'Luna', 'Nova', 'Orbit'];
	const NOUNS = ['Mango', 'Tuna', 'Thought', 'Limb', 'Fawn', 'Glade', 'Echo', 'Mist', 'Falcon', 'Cipher'];

	function autoGenerateName(): string {
		const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
		const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
		return `${adj}${noun}`;
	}

	let devices: Device[] = $state([]);
	let loading = $state(false);
	let selectedId: string | null = $state(null);
	let showAdd = $state(false);
	let newName = $state(autoGenerateName());
	let newUrl = $state('');
	let checking = $state(false);
	let checkResult = $state<string | null>(null);

	async function fetchDevices() {
		loading = true;
		try {
			const res = await fetch('/api/sms/devices');
			if (res.ok) {
				const data = await res.json();
				devices = data.devices;
				if (!selectedId && devices.length > 0) selectedId = devices[0].id;
			}
		} finally {
			loading = false;
		}
	}

	onMount(fetchDevices);

	async function checkUrl() {
		if (!newUrl.trim()) return;
		checking = true;
		checkResult = null;
		try {
			const url = newUrl.replace(/\/$/, '') + '/health';
			const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
			checkResult = res.ok ? 'reachable' : `http-${res.status}`;
		} catch (err: any) {
			checkResult = err?.name === 'TimeoutError' ? 'timeout' : 'unreachable';
		} finally {
			checking = false;
		}
	}

	async function addDevice() {
		if (!newName.trim() || !newUrl.trim()) return;
		const res = await fetch('/api/sms/devices', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newName.trim(), apiUrl: newUrl.trim() })
		});
		if (res.ok) {
			showAdd = false;
			newName = autoGenerateName();
			newUrl = '';
			checkResult = null;
			await fetchDevices();
		}
	}

	async function refreshAllStatuses() {
		const list = devices.slice();
		for (const d of list) {
			await fetch(`/api/sms/devices/${d.id}/check-status`, { method: 'POST' });
		}
		await fetchDevices();
	}

	async function checkDevice(d: Device) {
		await fetch(`/api/sms/devices/${d.id}/check-status`, { method: 'POST' });
		await fetchDevices();
	}

	async function removeDevice(d: Device) {
		if (!confirm(`Remove device ${d.name}?`)) return;
		await fetch(`/api/sms/devices/${d.id}`, { method: 'DELETE' });
		if (selectedId === d.id) selectedId = null;
		await fetchDevices();
	}

	function statusClass(s: string): string {
		if (s === 'online') return 'border-[var(--status-live)]/30 bg-[var(--status-live)]/10 text-[var(--status-live)]';
		if (s === 'offline') return 'border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-[var(--destructive)]';
		if (s === 'timeout') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
		if (s.startsWith('error') || s.startsWith('http-')) return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
		return 'border-[var(--border)] bg-[var(--accent)]/30 text-[var(--muted-foreground)]';
	}

	let selected = $derived(devices.find((d) => d.id === selectedId) ?? null);
</script>

<svelte:head>
	<title>SMS · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">SMS</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">Manage SMS gateways used to deliver verification codes</p>
		</div>
		<button onclick={() => (showAdd = true)} class="btn-accent flex items-center gap-1.5 px-4 py-2 text-xs">
			<Plus size={13} />
			Add device
		</button>
	</div>

	<div class="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
		<!-- Devices list -->
		<aside class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
			<div class="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Smartphone size={14} class="text-[var(--text-accent)]" />
					<p class="text-sm font-semibold text-[var(--foreground)]">Devices</p>
					<span class="rounded-md bg-[var(--accent-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--text-accent)]">{devices.length}</span>
				</div>
				<div class="flex items-center gap-1">
					<button onclick={refreshAllStatuses} class="rounded-md p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]" title="Refresh device states" aria-label="Refresh device states">
						<RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
					</button>
					<button onclick={() => (showAdd = true)} class="rounded-md p-1.5 text-[var(--text-accent)] hover:bg-[var(--accent-primary)]/15" title="Add device" aria-label="Add device">
						<Plus size={12} />
					</button>
				</div>
			</div>

			<div class="max-h-[72vh] overflow-y-auto custom-scrollbar">
				{#if devices.length === 0}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<Smartphone size={32} class="mb-2 text-[var(--text-tertiary)]" />
						<p class="text-xs font-semibold text-[var(--foreground)]">No devices yet</p>
						<p class="mt-1 text-[11px] text-[var(--muted-foreground)]">Use the “Add device” button to add an SMS gateway</p>
					</div>
				{:else}
					{#each devices as d (d.id)}
						<div
							role="button"
							tabindex="0"
							onclick={() => (selectedId = d.id)}
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedId = d.id; } }}
							class="w-full cursor-pointer border-b border-[var(--border-subtle)] px-4 py-3 text-left transition-soft-no-bg hover:bg-[var(--accent)]/30 last:border-0 {selectedId === d.id ? 'bg-[var(--accent-primary)]/10' : ''}"
						>
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<p class="truncate text-xs font-semibold text-[var(--foreground)]">{d.name}</p>
										<span class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-medium {statusClass(d.lastStatus)}">
											{d.lastStatus}
										</span>
									</div>
									<p class="mt-0.5 truncate font-mono text-[10px] text-[var(--muted-foreground)]">{d.apiUrl}</p>
									<p class="mt-1 text-[10px] text-[var(--text-tertiary)]">
										{d.lastCheck ? `Checked ${timeAgo(d.lastCheck)}` : 'Never checked'}
									</p>
								</div>
								<button
									onclick={(e) => { e.stopPropagation(); removeDevice(d); }}
									class="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
									aria-label="Remove device"
								>
									<Trash2 size={11} />
								</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</aside>

		<!-- Selected device pane -->
		<section class="rounded-xl border border-[var(--border)] bg-[var(--card)]">
			{#if !selected}
				<div class="flex h-[72vh] flex-col items-center justify-center text-center">
					<MessageSquare size={36} class="mb-2 text-[var(--text-tertiary)]" />
					{#if devices.length === 0}
						<p class="text-sm font-semibold text-[var(--foreground)]">No devices yet</p>
						<p class="mt-1 text-xs text-[var(--muted-foreground)]">Add a device to start messaging</p>
					{:else}
						<p class="text-sm font-semibold text-[var(--foreground)]">Select a device</p>
						<p class="mt-1 text-xs text-[var(--muted-foreground)]">Pick one from the list to start messaging</p>
					{/if}
				</div>
			{:else}
				<div class="border-b border-[var(--border)] px-5 py-3">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-semibold text-[var(--foreground)]">{selected.name}</p>
							<p class="mt-0.5 font-mono text-[11px] text-[var(--muted-foreground)]">{selected.apiUrl}</p>
						</div>
						<div class="flex items-center gap-2">
							<span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium {statusClass(selected.lastStatus)}">
								{#if selected.lastStatus === 'online'}<Wifi size={10} />{:else if selected.lastStatus === 'offline'}<WifiOff size={10} />{:else}<Activity size={10} />{/if}
								{selected.lastStatus}
							</span>
							<button onclick={() => checkDevice(selected!)} class="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
								<RefreshCw size={11} />
								Re-check
							</button>
						</div>
					</div>
					<p class="mt-2 text-[11px] text-[var(--text-tertiary)]">
						Last check: {selected.lastCheck ? new Date(selected.lastCheck).toLocaleString() : '—'}
					</p>
				</div>

				<div class="p-5 space-y-4">
					<div class="rounded-md border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 px-4 py-3">
						<p class="text-xs font-semibold text-[var(--text-accent)]">How this device is used</p>
						<p class="mt-1 text-[11px] text-[var(--muted-foreground)]">
							Visitors complete the SMS verification step in their flow; the panel forwards the operator-supplied
							code to <code class="rounded bg-[var(--accent)]/30 px-1 font-mono">{selected.apiUrl}/send</code> so the
							device can send a fake confirmation SMS to the visitor's phone. The device only needs to expose a
							<code class="rounded bg-[var(--accent)]/30 px-1 font-mono">/health</code> endpoint to be considered online.
						</p>
					</div>

					<div class="rounded-md border border-[var(--border)] bg-[var(--input)]/30 p-4">
						<p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Quick send</p>
						<div class="mt-2 grid grid-cols-2 gap-2">
							<input type="text" placeholder="+15551234567" disabled class="rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--muted-foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
							<input type="text" placeholder="Verification code" disabled class="rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--muted-foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
						</div>
						<p class="mt-2 text-[10px] text-[var(--text-tertiary)]">
							Quick-send is wired through the panel WS for active sessions on Sessions → "Update Last 2 Digits".
						</p>
					</div>
				</div>
			{/if}
		</section>
	</div>
</div>

{#if showAdd}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (showAdd = false)}>
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-base font-semibold text-[var(--foreground)]">Add SMS Device</h3>
				<button onclick={() => (showAdd = false)} class="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]" aria-label="Close"><X size={16} /></button>
			</div>
			<div class="space-y-4">
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Device Name</label>
					<div class="flex items-center gap-2">
						<input bind:value={newName} type="text" placeholder="e.g., CrystalMango" class="flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
						<button onclick={() => (newName = autoGenerateName())} class="rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]" title="Generate random name">
							<Sparkles size={12} />
						</button>
					</div>
				</div>
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">API URL <span class="text-red-400">*</span></label>
					<div class="flex items-center gap-2">
						<input bind:value={newUrl} type="text" placeholder="http://192.168.1.100:8080" class="flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
						<button onclick={checkUrl} disabled={!newUrl.trim() || checking} class="rounded-md border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50">
							{#if checking}<RefreshCw size={11} class="animate-spin" />{:else}Check{/if}
						</button>
					</div>
					{#if checkResult}
						<p class="mt-1.5 inline-flex items-center gap-1 text-[11px] {checkResult === 'reachable' ? 'text-[var(--status-live)]' : 'text-amber-400'}">
							{#if checkResult === 'reachable'}<Wifi size={11} />{:else}<AlertCircle size={11} />{/if}
							{checkResult}
						</p>
					{/if}
				</div>
			</div>
			<div class="mt-5 flex justify-end gap-2">
				<button onclick={() => (showAdd = false)} class="rounded-md border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={addDevice} disabled={!newName.trim() || !newUrl.trim()} class="btn-accent px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed">Add Device</button>
			</div>
		</div>
	</div>
{/if}
