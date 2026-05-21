<script lang="ts">
	import { onMount } from 'svelte';
	import { Users, Plus, Search, RefreshCw, Trash2, Shield, Check, X, AlertCircle } from 'lucide-svelte';
	import { toast } from '$lib/stores/toast';

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
	let loading = $state(false);
	let creating = $state(false);
	let confirmDelete: { id: string; username: string } | null = $state(null);

	let filteredUsers = $derived(
		users.filter((u) =>
			u.username.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);
	let pendingCount = $derived(users.filter((u) => !u.active).length);
	let canCreate = $derived(newUsername.trim().length >= 3 && newPassword.length >= 8 && !creating);

	function handleEsc(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (confirmDelete) confirmDelete = null;
		else if (showCreateDialog) showCreateDialog = false;
	}

	async function refresh() {
		loading = true;
		try {
			const res = await fetch('/api/auth/users');
			if (!res.ok) {
				toast.error('Failed to load users');
				return;
			}
			const body = await res.json();
			users = body.users ?? [];
		} catch {
			toast.error('Network error loading users');
		} finally {
			loading = false;
		}
	}

	async function setActive(id: string, active: boolean) {
		const res = await fetch(`/api/auth/users/${id}/active`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ active })
		});
		if (res.ok) {
			users = users.map((u) => (u.id === id ? { ...u, active } : u));
			toast.success(active ? 'User approved' : 'User deactivated');
		} else {
			toast.error('Failed to update user status');
		}
	}

	async function createAccount() {
		if (!canCreate) return;
		creating = true;
		try {
			const res = await fetch('/api/auth/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole })
			});
			if (res.ok) {
				toast.success(`User ${newUsername.trim()} created`);
				newUsername = '';
				newPassword = '';
				newRole = 'user';
				showCreateDialog = false;
				await refresh();
			} else {
				const body = await res.json().catch(() => ({}));
				toast.error(body.message || 'Failed to create user');
			}
		} catch {
			toast.error('Network error');
		} finally {
			creating = false;
		}
	}

	async function performDelete() {
		if (!confirmDelete) return;
		const { id, username } = confirmDelete;
		try {
			const res = await fetch(`/api/auth/users/${id}`, { method: 'DELETE' });
			if (res.ok) {
				toast.success(`Deleted user ${username}`);
				confirmDelete = null;
				await refresh();
			} else {
				const body = await res.json().catch(() => ({}));
				toast.error(body.message || 'Failed to delete user');
			}
		} catch {
			toast.error('Network error');
		}
	}

	onMount(() => {
		refresh();
	});
</script>

<svelte:head>
	<title>Users · Panel</title>
</svelte:head>

<svelte:window onkeydown={handleEsc} />

<div class="p-8 pt-5">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Users</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">
				Manage nested user accounts and roles
				{#if pendingCount > 0}
					<span class="ml-2 inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
						{pendingCount} pending
					</span>
				{/if}
			</p>
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
						aria-label="Search users"
						class="w-56 rounded-lg border border-[var(--border)] bg-[var(--input)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
					/>
				</div>
				<button onclick={refresh} class="rounded-lg p-2 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]" title="Refresh">
					<RefreshCw size={14} class={loading ? 'animate-spin' : ''} />
				</button>
			</div>
		</div>

		<div class="overflow-x-auto custom-scrollbar">
			<div class="min-w-[700px]">
		{#if filteredUsers.length === 0}
			<div class="flex flex-col items-center justify-center py-20 text-center">
				<Users size={40} class="mb-3 text-[var(--text-tertiary)]" />
				<p class="text-sm font-semibold text-[var(--foreground)]">{searchQuery ? 'No matching users' : 'No users'}</p>
				<p class="mt-1 text-xs text-[var(--muted-foreground)]">{searchQuery ? 'Try a different search' : 'Create an account to get started'}</p>
			</div>
		{:else}
			<div class="border-b border-[var(--border-subtle)] bg-[var(--input)]/40 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
				<div class="grid grid-cols-[1fr_100px_120px_120px_140px] gap-4">
					<span>Username</span>
					<span>Role</span>
					<span>Created</span>
					<span>Last Login</span>
					<span class="text-right">Actions</span>
				</div>
			</div>
			<div class="max-h-[60vh] overflow-y-auto custom-scrollbar">
				{#each filteredUsers as user (user.id)}
					<div class="transition-soft-no-bg border-b border-[var(--border-subtle)] p-4 px-5 hover:bg-[var(--accent)]/40">
						<div class="grid grid-cols-[1fr_100px_120px_120px_140px] items-center gap-4">
							<div class="flex items-center gap-3">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/15 text-[11px] font-bold text-[var(--text-accent)]">
									{user.username.substring(0, 2).toUpperCase()}
								</div>
								<div>
									<p class="text-sm font-semibold text-[var(--foreground)]">{user.username}</p>
									<span class="text-[11px] {user.active ? 'text-[var(--status-live)]' : 'text-yellow-400'}">
										{user.active ? 'Active' : 'Pending'}
									</span>
								</div>
							</div>
							<span class="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
								<Shield size={12} class="text-[var(--text-accent)]" />
								{user.role}
							</span>
							<span class="text-xs text-[var(--muted-foreground)]">{user.createdAt}</span>
							<span class="text-xs text-[var(--muted-foreground)]">{user.lastLogin ?? 'Never'}</span>
							<div class="flex items-center justify-end gap-1">
								{#if user.active}
									<button
										onclick={() => setActive(user.id, false)}
										title="Deactivate"
										class="rounded-lg p-2 text-[var(--muted-foreground)] transition-soft hover:bg-yellow-500/10 hover:text-yellow-400"
									>
										<X size={14} />
									</button>
								{:else}
									<button
										onclick={() => setActive(user.id, true)}
										title="Approve"
										class="rounded-lg p-2 text-[var(--status-live)] transition-soft hover:bg-[var(--status-live)]/10"
									>
										<Check size={14} />
									</button>
								{/if}
								<button onclick={() => (confirmDelete = { id: user.id, username: user.username })} class="rounded-lg p-2 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]" title="Delete user">
									<Trash2 size={14} />
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
			</div>
		</div>
	</div>
</div>

{#if showCreateDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" onclick={() => (showCreateDialog = false)}>
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-semibold text-[var(--foreground)]">Create Account</h3>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">Add a new nested user account</p>

			<div class="mt-5 space-y-4">
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Username</label>
					<input bind:value={newUsername} type="text" placeholder="Min 3 characters" class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]" />
				</div>
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Password</label>
					<input bind:value={newPassword} type="password" placeholder="Min 8 characters" class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]" />
					{#if newPassword.length > 0 && newPassword.length < 8}
						<p class="mt-1 text-[11px] text-[var(--destructive)]">Password must be at least 8 characters</p>
					{/if}
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
				<button onclick={createAccount} disabled={!canCreate} class="btn-accent px-4 py-2 text-sm disabled:opacity-50">{creating ? 'Creating...' : 'Create'}</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmDelete}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" onclick={() => (confirmDelete = null)}>
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-start gap-3">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--destructive)]/15 text-[var(--destructive)]">
					<AlertCircle size={16} />
				</div>
				<div>
					<h3 class="text-base font-semibold text-[var(--foreground)]">Delete user account?</h3>
					<p class="mt-2 text-sm text-[var(--muted-foreground)]">
						This will permanently delete
						<span class="font-mono text-[var(--foreground)]">{confirmDelete.username}</span>
						and all their sessions. This cannot be undone.
					</p>
				</div>
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<button onclick={() => (confirmDelete = null)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={performDelete} class="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-white transition-soft hover:opacity-90">Delete</button>
			</div>
		</div>
	</div>
{/if}
