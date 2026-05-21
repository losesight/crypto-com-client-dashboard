<script lang="ts">
	import { User, Save, RefreshCw } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { sendMessage } from '$lib/stores/websocket';
	import { toast } from '$lib/stores/toast';

	let editUsername = $state('');
	let role = $derived($page.data.user?.role ?? '');
	let roleLabel = $derived(role ? role.charAt(0).toUpperCase() + role.slice(1) : '');
	let initial = $derived((editUsername || '?').charAt(0).toUpperCase());
	let password = $state('');
	let saving = $state(false);
	let rotatingKey = $state(false);

	const savedUsername = $derived($page.data.user?.username ?? '');
	const usernameDirty = $derived(editUsername.trim() !== savedUsername);
	const passwordValid = $derived(password.trim().length === 0 || password.trim().length >= 8);
	const canSave = $derived((usernameDirty || password.trim().length >= 8) && passwordValid && !saving);

	$effect(() => {
		editUsername = savedUsername;
	});

	async function saveProfile() {
		if (!canSave) return;
		saving = true;
		try {
			const body: { username?: string; password?: string } = {};
			if (usernameDirty) body.username = editUsername.trim();
			if (password.trim()) body.password = password.trim();

			const res = await fetch('/api/auth/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				toast.error(data.message || 'Failed to update profile');
				return;
			}

			if (password.trim()) {
				sendMessage('profile:update', { password: password.trim() });
			}
			if (usernameDirty) {
				sendMessage('profile:update', { username: editUsername.trim() });
			}

			password = '';
			await invalidateAll();
			toast.success('Profile updated');
		} catch {
			toast.error('Failed to update profile');
		} finally {
			saving = false;
		}
	}

	async function rotatePhishKey() {
		rotatingKey = true;
		try {
			const res = await fetch('/api/auth/profile/rotate-phish-key', { method: 'POST' });
			if (res.ok) {
				toast.success('All domain phish keys rotated');
			} else {
				const data = await res.json().catch(() => ({}));
				toast.error(data.message || 'Failed to rotate keys');
			}
		} catch {
			toast.error('Network error');
		} finally {
			rotatingKey = false;
		}
	}
</script>

<svelte:head>
	<title>Profile · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-[var(--foreground)]">Profile</h1>
		<p class="mt-1 text-sm text-[var(--muted-foreground)]">Manage your account settings</p>
	</div>

	<div class="mx-auto max-w-lg">
		<div class="animate-fade-slide-up transition-panel rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
			<div class="border-b border-[var(--border)] px-5 py-3.5 bg-[var(--card)]">
				<div class="flex items-center gap-2.5">
					<User size={15} class="text-[var(--text-accent)]" />
					<p class="text-sm font-semibold text-[var(--foreground)]">Account</p>
				</div>
			</div>

			<div class="p-6">
				<div class="flex items-center gap-5 mb-8">
					<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/15 text-xl font-bold text-[var(--text-accent)]">
						{initial}
					</div>
					<div>
						<p class="text-base font-semibold text-[var(--foreground)]">{editUsername || '—'}</p>
						<p class="text-sm text-[var(--muted-foreground)]">{roleLabel || '—'}</p>
					</div>
				</div>

				<div class="space-y-5">
					<div>
						<label for="profile-username" class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Username</label>
						<input
							id="profile-username"
							type="text"
							bind:value={editUsername}
							autocomplete="username"
							class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
						/>
					</div>

					<div>
						<label for="profile-password" class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Password</label>
						<input
							id="profile-password"
							bind:value={password}
							type="password"
							placeholder="New password (optional)"
							autocomplete="new-password"
							class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
						/>
						{#if password.trim().length > 0 && password.trim().length < 8}
							<p class="mt-1 text-[11px] text-[var(--destructive)]">Password must be at least 8 characters</p>
						{/if}
					</div>

					<button
						onclick={saveProfile}
						disabled={!canSave}
						title={!canSave ? 'Change your username or enter a new password to save' : 'Save profile'}
						aria-label="Save profile"
						class="btn-accent flex w-full items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<Save size={15} aria-hidden="true" />
						{saving ? 'Saving...' : 'Save profile'}
					</button>

					<button
						onclick={rotatePhishKey}
						disabled={rotatingKey}
						class="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-3 text-sm text-[var(--foreground)] transition-soft hover:bg-[var(--accent)] disabled:opacity-50"
					>
						<RefreshCw size={15} class="{rotatingKey ? 'animate-spin' : ''}" />
						Rotate phish key
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
