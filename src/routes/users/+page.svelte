<script lang="ts">
	import { Users, Plus, Search, RefreshCw, Trash2, Shield, ChevronDown } from 'lucide-svelte';
	import { sendMessage } from '$lib/stores/websocket';

	interface UserAccount {
		id: string;
		username: string;
		role: 'admin' | 'user';
		createdAt: string;
		lastLogin: string | null;
		active: boolean;
	}

	let users: UserAccount[] = $state([]);
	let searchQuery = $state('');
	let showCreateDialog = $state(false);
	let newUsername = $state('');
	let newPassword = $state('');
	let newRole = $state<'admin' | 'user'>('user');

	let filteredUsers = $derived(
		users.filter((u) =>
			u.username.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	function createAccount() {
		if (!newUsername.trim() || !newPassword.trim()) return;
		const user: UserAccount = {
			id: crypto.randomUUID(),
			username: newUsername.trim(),
			role: newRole,
			createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
			lastLogin: null,
			active: true
		};
		users = [...users, user];
		sendMessage('users:create', { username: user.username, role: user.role });
		newUsername = '';
		newPassword = '';
		newRole = 'user';
		showCreateDialog = false;
	}

	function deleteUser(id: string) {
		users = users.filter((u) => u.id !== id);
		sendMessage('users:delete', { id });
	}

	function refresh() {
		sendMessage('users:list', {});
	}
</script>

<svelte:head>
	<title>Users · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Users</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">Manage nested user accounts and roles</p>
		</div>
		<button onclick={() => (showCreateDialog = true)} class="btn-accent flex items-center gap-2 px-4 py-2.5 text-sm">
			<Plus size={15} />
			Create account
		</button>
	</div>

	<div class="animate-fade-slide-up transition-panel rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
		<div class="border-b border-[var(--border)] px-5 py-3.5 bg-[var(--card)] flex items-center justify-between">
			<div class="flex items-center gap-2.5">
				<Users size={15} class="text-[var(--text-accent)]" />
				<p class="text-sm font-semibold text-[var(--foreground)]">User Accounts</p>
			</div>
			<div class="flex items-center gap-2">
				<div class="relative">
					<Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
					<input
						bind:value={searchQuery}
						type="text"
						placeholder="Search..."
						class="w-56 rounded-lg border border-[var(--border)] bg-[var(--input)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
					/>
				</div>
				<button onclick={refresh} class="rounded-lg p-2 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
					<RefreshCw size={14} />
				</button>
			</div>
		</div>

		{#if filteredUsers.length === 0}
			<div class="flex flex-col items-center justify-center py-20 text-center">
				<Users size={40} class="mb-3 text-[var(--text-tertiary)]" />
				<p class="text-sm font-semibold text-[var(--foreground)]">No users</p>
				<p class="mt-1 text-xs text-[var(--muted-foreground)]">You have no nested user accounts</p>
			</div>
		{:else}
			<div class="hidden border-b border-[var(--border-subtle)] bg-[var(--input)]/40 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] lg:block">
				<div class="grid grid-cols-[1fr_100px_120px_120px_60px] gap-4">
					<span>Username</span>
					<span>Role</span>
					<span>Created</span>
					<span>Last Login</span>
					<span></span>
				</div>
			</div>
			<div class="max-h-[60vh] overflow-y-auto custom-scrollbar">
				{#each filteredUsers as user (user.id)}
					<div class="transition-soft-no-bg border-b border-[var(--border-subtle)] p-4 px-5 hover:bg-[var(--accent)]/40">
						<div class="grid grid-cols-[1fr_100px_120px_120px_60px] items-center gap-4">
							<div class="flex items-center gap-3">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/15 text-[11px] font-bold text-[var(--text-accent)]">
									{user.username.substring(0, 2).toUpperCase()}
								</div>
								<div>
									<p class="text-sm font-semibold text-[var(--foreground)]">{user.username}</p>
									<span class="text-[11px] {user.active ? 'text-[var(--status-live)]' : 'text-[var(--muted-foreground)]'}">
										{user.active ? 'Active' : 'Inactive'}
									</span>
								</div>
							</div>
							<span class="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
								<Shield size={12} class="text-[var(--text-accent)]" />
								{user.role}
							</span>
							<span class="text-xs text-[var(--muted-foreground)]">{user.createdAt}</span>
							<span class="text-xs text-[var(--muted-foreground)]">{user.lastLogin ?? 'Never'}</span>
							<button onclick={() => deleteUser(user.id)} class="rounded-lg p-2 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]">
								<Trash2 size={14} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if showCreateDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (showCreateDialog = false)}>
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-semibold text-[var(--foreground)]">Create Account</h3>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">Add a new nested user account</p>

			<div class="mt-5 space-y-4">
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Username</label>
					<input bind:value={newUsername} type="text" placeholder="Enter username" class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]" />
				</div>
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Password</label>
					<input bind:value={newPassword} type="password" placeholder="Enter password" class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]" />
				</div>
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Role</label>
					<select bind:value={newRole} class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]">
						<option value="user">User</option>
						<option value="admin">Admin</option>
					</select>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button onclick={() => (showCreateDialog = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">
					Cancel
				</button>
				<button onclick={createAccount} class="btn-accent px-4 py-2 text-sm">Create</button>
			</div>
		</div>
	</div>
{/if}
