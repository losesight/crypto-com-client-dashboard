<script lang="ts">
	import '../../app.css';
	import { Eye, EyeOff, Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-svelte';

	let username = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let submitting = $state(false);
	let errorMsg = $state('');
	let successMsg = $state('');

	let canSubmit = $derived(
		username.trim().length >= 3 &&
			password.length >= 8 &&
			confirmPassword.length > 0 &&
			password === confirmPassword &&
			!submitting &&
			!successMsg
	);

	async function submit(e: Event) {
		e.preventDefault();
		if (!canSubmit) return;

		submitting = true;
		errorMsg = '';

		try {
			const res = await fetch('/api/auth/signup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: username.trim(),
					password
				})
			});

			const body = await res.json().catch(() => ({}));

			if (!res.ok) {
				errorMsg = body.message || 'Signup failed';
				submitting = false;
				return;
			}

			successMsg =
				body.message ||
				'Account created. An administrator must approve it before you can sign in.';
			username = '';
			password = '';
			confirmPassword = '';
			submitting = false;
		} catch (err: unknown) {
			errorMsg = err instanceof Error ? err.message : 'Network error';
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Create account</title>
</svelte:head>

<div class="login-shell">
	<div class="login-card">
		<div class="login-badge">
			<ShieldCheck size={14} />
			SECURE ACCESS
		</div>
		<h1 class="login-title">Create account</h1>
		<p class="login-subtitle">Submit a request for an administrator to review.</p>

		{#if successMsg}
			<div class="login-success">
				<CheckCircle2 size={16} />
				<span>{successMsg}</span>
			</div>
			<a href="/login" class="auth-link">Back to sign in</a>
		{:else}
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
						placeholder="Choose a username"
					/>
				</div>

				<div class="login-field">
					<label for="password" class="login-label">Password</label>
					<div class="login-password-wrap">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							autocomplete="new-password"
							required
							bind:value={password}
							class="login-input"
							placeholder="At least 8 characters"
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
					<p class="mt-1 text-xs text-[var(--muted-foreground)]">Must be at least 8 characters</p>
				</div>

				<div class="login-field">
					<label for="confirm-password" class="login-label">Confirm Password</label>
					<div class="login-password-wrap">
						<input
							id="confirm-password"
							type={showConfirmPassword ? 'text' : 'password'}
							autocomplete="new-password"
							required
							bind:value={confirmPassword}
							class="login-input"
							placeholder="Repeat your password"
						/>
						<button
							type="button"
							class="login-eye-btn"
							aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
							onclick={() => (showConfirmPassword = !showConfirmPassword)}
						>
							{#if showConfirmPassword}
								<EyeOff size={16} />
							{:else}
								<Eye size={16} />
							{/if}
						</button>
					</div>
				</div>

				{#if confirmPassword && password !== confirmPassword}
					<div class="login-error">
						<AlertCircle size={14} />
						Passwords do not match
					</div>
				{/if}

				{#if errorMsg}
					<div class="login-error">
						<AlertCircle size={14} />
						{errorMsg}
					</div>
				{/if}

				<button type="submit" disabled={!canSubmit} class="login-submit">
					{#if submitting}
						<Loader2 size={16} class="login-spin" />
						Submitting…
					{:else}
						Request account
					{/if}
				</button>
				<a href="/login" class="auth-link">Already have an account? Sign in</a>
			</form>
		{/if}
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
	.login-success {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 12px 14px;
		border-radius: 10px;
		background: rgba(34, 197, 94, 0.12);
		color: rgb(134, 239, 172);
		font-size: 13px;
		border: 1px solid rgba(34, 197, 94, 0.3);
		margin-bottom: 14px;
		line-height: 1.4;
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
		display: block;
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
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
