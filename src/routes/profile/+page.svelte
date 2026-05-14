<script lang="ts">
	import { User, Save, RefreshCw, Key } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { sendMessage } from '$lib/stores/websocket';
	import { toast } from '$lib/stores/toast';

	let username = $derived($page.data.user?.username ?? '');
	let role = $derived($page.data.user?.role ?? '');
	let roleLabel = $derived(role ? role.charAt(0).toUpperCase() + role.slice(1) : '');
	let initial = $derived((username || '?').charAt(0).toUpperCase());
	let password = $state('');
	let saving = $state(false);
	let rotatingKey = $state(false);

	function saveProfile() {
		if (!password.trim()) return;
		saving = true;
		sendMessage('profile:update', { password: password.trim() });
		setTimeout(() => {
			saving = false;
			password = '';
			toast.success('Password updated');
		}, 1000);
	}

	function rotatePhishKey() {
		rotatingKey = true;
		sendMessage('profile:rotate-key', {});
		setTimeout(() => {
			rotatingKey = false;
			toast.success('Phish key rotated');
		}, 1000);
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
						<p class="text-base font-semibold text-[var(--foreground)]">{username || '—'}</p>
						<p class="text-sm text-[var(--muted-foreground)]">{roleLabel || '—'}</p>
					</div>
				</div>

				<div class="space-y-5">
					<div>
						<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Username</label>
						<input
							type="text"
							value={username}
							disabled
							class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)]/50 px-4 py-2.5 text-sm text-[var(--muted-foreground)] opacity-60"
						/>
					</div>

					<div>
						<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Password</label>
						<input
							bind:value={password}
							type="password"
							placeholder="New password"
							class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
						/>
					</div>

					<button
						onclick={saveProfile}
						disabled={!password.trim() || saving}
						title={!password.trim() ? 'Enter a new password to enable saving' : 'Save profile'}
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
