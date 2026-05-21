<script lang="ts">
	import '../../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Eye, EyeOff, Loader2, ShieldCheck, AlertCircle } from 'lucide-svelte';

	let username = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let submitting = $state(false);
	let errorMsg = $state('');

	let canSubmit = $derived(username.trim().length > 0 && password.length > 0 && !submitting);

	async function submit(e: Event) {
		e.preventDefault();
		if (!canSubmit) return;

		submitting = true;
		errorMsg = '';

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: username.trim(), password })
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				errorMsg = body.message || (res.status === 401 ? 'Invalid username or password' : 'Login failed');
				return;
			}

			const params = $page.url.searchParams;
			const raw = params.get('redirect') || '/dashboard';
			const safe = /^\/[^/]/.test(raw) ? raw : '/dashboard';
			await goto(safe, { invalidateAll: true });
		} catch (err: any) {
			errorMsg = err?.message || 'Network error';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in</title>
</svelte:head>

<div class="login-shell">
	<div class="login-card">
		<div class="login-badge">
			<ShieldCheck size={14} />
			SECURE ACCESS
		</div>
		<h1 class="login-title">Welcome back</h1>
		<p class="login-subtitle">Sign in to continue</p>

		<form onsubmit={submit} class="login-form">
			<div class="login-field">
				<label for="username" class="login-label">Username</label>
				<input
					id="username"
					type="text"
					autocomplete="username"
					required
					bind:value={username}
					class="login-input"
					placeholder="Enter your username"
				/>
			</div>

			<div class="login-field">
				<label for="password" class="login-label">Password</label>
				<div class="login-password-wrap">
					<input
						id="password"
						type={showPassword ? 'text' : 'password'}
						autocomplete="current-password"
						required
						bind:value={password}
						class="login-input"
						placeholder="Enter your password"
					/>
					<button
						type="button"
						class="login-eye-btn"
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						onclick={() => (showPassword = !showPassword)}
					>
						{#if showPassword}
							<EyeOff size={16} />
						{:else}
							<Eye size={16} />
						{/if}
					</button>
				</div>
			</div>

			{#if errorMsg}
				<div class="login-error">
					<AlertCircle size={14} />
					{errorMsg}
				</div>
			{/if}

			<button type="submit" disabled={!canSubmit} class="login-submit">
				{#if submitting}
					<Loader2 size={16} class="login-spin" />
					Signing in…
				{:else}
					Sign In
				{/if}
			</button>
			<a href="/signup" class="auth-link">Need an account? Sign up</a>
		</form>
	</div>
</div>

<style>
	.login-shell {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background:
			radial-gradient(circle at 10% 10%, rgba(139, 92, 246, 0.18), transparent 35%),
			radial-gradient(circle at 90% 90%, rgba(34, 197, 94, 0.12), transparent 40%),
			var(--background, #0b0d10);
		padding: 24px;
		font-family: var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif);
		color: var(--foreground, #f4f4f5);
	}
	.login-card {
		width: 100%;
		max-width: 400px;
		padding: 36px;
		border-radius: 16px;
		background: var(--card, rgba(20, 22, 27, 0.85));
		border: 1px solid var(--border, #2a2d35);
		backdrop-filter: blur(12px);
		box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.6);
	}
	.login-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 999px;
		background: rgba(139, 92, 246, 0.12);
		color: rgb(196, 181, 253);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.login-title {
		margin: 16px 0 4px;
		font-size: 26px;
		font-weight: 700;
		color: var(--foreground, #f4f4f5);
	}
	.login-subtitle {
		margin: 0 0 24px;
		font-size: 14px;
		color: var(--muted-foreground, #8a8f99);
	}
	.login-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.login-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.login-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--muted-foreground, #8a8f99);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.login-input {
		width: 100%;
		padding: 12px 14px;
		border-radius: 10px;
		border: 1px solid var(--border, #2a2d35);
		background: var(--input, rgba(15, 17, 21, 0.7));
		color: var(--foreground, #f4f4f5);
		font-size: 14px;
		outline: none;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
		box-sizing: border-box;
	}
	.login-input:focus {
		border-color: rgb(139, 92, 246);
		box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18);
	}
	.login-password-wrap {
		position: relative;
	}
	.login-password-wrap .login-input {
		padding-right: 44px;
	}
	.login-eye-btn {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		background: transparent;
		border: 0;
		color: var(--muted-foreground, #8a8f99);
		cursor: pointer;
		padding: 6px;
		border-radius: 6px;
		display: flex;
		align-items: center;
	}
	.login-eye-btn:hover {
		color: var(--foreground, #f4f4f5);
		background: rgba(139, 92, 246, 0.08);
	}
	.login-error {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 10px;
		background: rgba(239, 68, 68, 0.12);
		color: rgb(252, 165, 165);
		font-size: 13px;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}
	.login-submit {
		margin-top: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 13px 14px;
		border-radius: 10px;
		border: 0;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		background: linear-gradient(135deg, rgb(139, 92, 246), rgb(124, 58, 237));
		color: #fff;
		transition: transform 0.08s ease, box-shadow 0.15s ease, opacity 0.15s ease;
		box-shadow: 0 8px 24px -8px rgba(139, 92, 246, 0.6);
	}
	.login-submit:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 12px 28px -8px rgba(139, 92, 246, 0.7);
	}
	.login-submit:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.auth-link {
		text-align: center;
		font-size: 13px;
		color: var(--muted-foreground, #8a8f99);
		text-decoration: none;
	}
	.auth-link:hover {
		color: var(--foreground, #f4f4f5);
		text-decoration: underline;
	}
	:global(.login-spin) {
		animation: login-spin 0.9s linear infinite;
	}
	@keyframes login-spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>
