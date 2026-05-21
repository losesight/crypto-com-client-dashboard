<script lang="ts">
	import { Inbox, Plus, RefreshCw, Mail, Trash2, HardDrive } from 'lucide-svelte';
	import { inboxAccounts, sendMessage } from '$lib/stores/websocket';
	import { toast } from '$lib/stores/toast';

	let selectedAccount = $state('');
	let showAddDialog = $state(false);
	let newEmail = $state('');

	let storageLimit = 15 * 1024 * 1024 * 1024;
	let totalStorageUsed = $derived($inboxAccounts.reduce((sum, a) => sum + (a.storageUsed ?? 0), 0));
	let storagePercent = $derived(Math.min((totalStorageUsed / storageLimit) * 100, 100));

	function wsSend(type: string, payload: unknown) {
		if (!sendMessage(type, payload)) {
			toast.error('Not connected to server');
			return false;
		}
		return true;
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function addAccount() {
		if (!newEmail.trim()) return;
		wsSend('inbox:add', { email: newEmail.trim() });
		newEmail = '';
		showAddDialog = false;
	}

	function removeAccount(id: string) {
		wsSend('inbox:remove', { id });
	}

	function refresh() {
		sendMessage('inbox:refresh', {});
	}
</script>

<svelte:head>
	<title>Inbox Filter · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Inbox Filter</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">Manage email accounts and filter incoming messages</p>
		</div>
	</div>

	<div class="grid gap-6 xl:grid-cols-12">
		<div class="xl:col-span-8">
			<div class="animate-fade-slide-up transition-panel rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
				<div class="border-b border-[var(--border)] px-5 py-3.5 bg-[var(--card)] flex items-center justify-between">
					<div class="flex items-center gap-2.5">
						<Inbox size={15} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Email Accounts</p>
					</div>
					<div class="flex items-center gap-2">
					<select
						bind:value={selectedAccount}
						disabled={$inboxAccounts.length === 0}
						aria-label="Select email account"
						class="rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value="">{$inboxAccounts.length === 0 ? 'No accounts' : 'Select account...'}</option>
						{#each $inboxAccounts as account}
							<option value={account.id}>{account.email}</option>
						{/each}
					</select>
						<button onclick={() => (showAddDialog = true)} class="btn-accent flex items-center gap-1.5 px-3 py-2 text-xs">
							<Plus size={13} />
							Add account
						</button>
						<button onclick={refresh} aria-label="Refresh accounts" title="Refresh accounts" class="rounded-lg p-2 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
							<RefreshCw size={14} />
						</button>
					</div>
				</div>

			{#if $inboxAccounts.length === 0}
				<div class="flex flex-col items-center justify-center py-20 text-center">
					<Mail size={40} class="mb-3 text-[var(--text-tertiary)]" />
					<p class="text-sm font-semibold text-[var(--foreground)]">No email accounts</p>
					<p class="mt-1 text-xs text-[var(--muted-foreground)]">Add an email account to start filtering</p>
				</div>
			{:else}
				<div class="max-h-[50vh] overflow-y-auto custom-scrollbar divide-y divide-[var(--border-subtle)]">
					{#each $inboxAccounts as account (account.id)}
							<div class="transition-soft-no-bg p-5 hover:bg-[var(--accent)]/30">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-3">
										<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/15">
											<Mail size={16} class="text-[var(--text-accent)]" />
										</div>
										<div>
											<p class="text-sm font-semibold text-[var(--foreground)]">{account.email}</p>
											<div class="mt-1 flex items-center gap-3 text-[11px] text-[var(--muted-foreground)]">
												<span>{account.provider}</span>
												<span>·</span>
												<span>{account.messageCount} messages</span>
												<span>·</span>
												<span class="{account.connected ? 'text-[var(--status-live)]' : 'text-[var(--destructive)]'}">
													{account.connected ? 'Connected' : 'Disconnected'}
												</span>
											</div>
										</div>
									</div>
									<button onclick={() => removeAccount(account.id)} class="rounded-lg p-2 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]">
										<Trash2 size={14} />
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="xl:col-span-4">
			<div class="animate-fade-slide-up transition-panel rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="animation-delay: 60ms; box-shadow: var(--shadow-sm);">
				<div class="border-b border-[var(--border)] px-5 py-3.5 bg-[var(--card)]">
					<div class="flex items-center gap-2.5">
						<HardDrive size={15} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Storage</p>
					</div>
				</div>
				<div class="p-5">
					<div class="flex flex-col items-center justify-center py-8 text-center">
					<p class="text-sm font-semibold text-[var(--foreground)]">
						{selectedAccount ? $inboxAccounts.find(a => a.id === selectedAccount)?.email : 'No email selected'}
					</p>
						<p class="mt-2 text-xs text-[var(--muted-foreground)]">
							{formatBytes(totalStorageUsed)} / 15 GB
						</p>
						<div class="mt-4 h-2 w-full max-w-[200px] rounded-full bg-[var(--input)]">
							<div
								class="h-full rounded-full bg-[var(--accent-primary)] transition-all"
								style="width: {storagePercent}%"
							></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

{#if showAddDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (showAddDialog = false)}>
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-semibold text-[var(--foreground)]">Add Email Account</h3>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">Add an email account for inbox filtering</p>
			<div class="mt-5 space-y-4">
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Email Address</label>
					<input bind:value={newEmail} type="email" placeholder="you@example.com" class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]" />
				</div>
			</div>
			<div class="mt-6 flex justify-end gap-3">
				<button onclick={() => (showAddDialog = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={addAccount} class="btn-accent px-4 py-2 text-sm">Add Account</button>
			</div>
		</div>
	</div>
{/if}
