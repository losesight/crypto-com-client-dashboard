<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		PackageSearch,
		Play,
		Square,
		Sparkles,
		FileUp,
		Filter,
		Download,
		Copy,
		Trash2,
		History,
		AlertTriangle,
		CheckCircle2,
		CircleSlash,
		Loader2,
		RefreshCw
	} from 'lucide-svelte';
	import { toast } from '$lib/stores/toast';

	interface ProbeResult {
		email: string;
		orderRef: string;
		httpStatus: number;
		elapsedMs: number;
		runs: number[];
		samples: { elapsedMs: number; httpStatus: number; error?: string }[];
		inferredValid: boolean;
		threshold: number;
		notes: string[];
		error?: string;
	}

	interface BatchSummary {
		total: number;
		valid: number;
		invalid: number;
		errored: number;
		threshold: number;
		concurrency: number;
		runs: number;
		durationMs: number;
	}

	interface BatchHistoryEntry {
		id: string;
		createdAt: number;
		createdBy: string;
		summary: BatchSummary;
	}

	type Mode = 'pair' | 'email' | 'orderRef';
	let mode = $state<Mode>('pair');
	let pairsText = $state(
		'# Paste email,orderRef per line (comma, space, or tab separated)\n# ooyeleye0@gmail.com, LDG3530088\n'
	);
	let threshold = $state(800);
	let concurrency = $state(3);
	let runs = $state(2);
	let saveBatch = $state(true);

	// Per-batch probe overrides (left blank = use Settings)
	let curlInput = $state('');
	let overrideProbeUrl = $state('');
	let overrideMethod = $state('');
	let overrideBody = $state('');
	let overrideHeadersJson = $state('');
	let showAdvanced = $state(false);
	let importingCurl = $state(false);

	const DIAGNOSTIC = { email: 'ooyeleye0@gmail.com', orderRef: 'LDG3530088' };

	let results: ProbeResult[] = $state([]);
	let summary: BatchSummary | null = $state(null);
	let running = $state(false);
	let progress = $state<{ completed: number; total: number } | null>(null);
	let abortController: AbortController | null = null;
	let validOnly = $state(false);
	let config = $state<{
		probeUrl: string;
		method: string;
		threshold: number;
		concurrency: number;
		runs: number;
		timeoutMs: number;
		jitterMs: number;
	} | null>(null);
	let batches: BatchHistoryEntry[] = $state([]);
	let loadingHistory = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();


	let visibleResults = $derived(
		validOnly ? results.filter((r) => r.inferredValid) : results
	);
	let validCount = $derived(results.filter((r) => r.inferredValid).length);
	let erroredCount = $derived(results.filter((r) => !!r.error).length);

	onMount(() => {
		void refreshHistory();
	});

	onDestroy(() => {
		abortController?.abort();
	});

	async function refreshHistory() {
		loadingHistory = true;
		try {
			const res = await fetch('/api/order-checker?limit=10');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as {
				batches: BatchHistoryEntry[];
				config: typeof config;
			};
			batches = data.batches || [];
			config = data.config;
			if (config) {
				if (!hasOverriddenThreshold) threshold = config.threshold;
				if (!hasOverriddenConcurrency) concurrency = config.concurrency;
				if (!hasOverriddenRuns) runs = config.runs;
			}
		} catch (err: any) {
			toast.error(err?.message || 'Failed to load history');
		} finally {
			loadingHistory = false;
		}
	}

	let hasOverriddenThreshold = $state(false);
	let hasOverriddenConcurrency = $state(false);
	let hasOverriddenRuns = $state(false);

	function parsePairs(raw: string, m: Mode): { email: string; orderRef: string }[] {
		const out: { email: string; orderRef: string }[] = [];
		for (const line of raw.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			if (m === 'pair') {
				const match = /^([^\s,;\t]+)[\s,;\t]+(\S+)$/.exec(trimmed);
				if (!match) continue;
				out.push({
					email: match[1].replace(/^"|"$/g, ''),
					orderRef: match[2].replace(/^"|"$/g, '')
				});
			} else {
				const token = trimmed.replace(/^"|"$/g, '');
				if (!token) continue;
				if (m === 'email') out.push({ email: token, orderRef: 'PROBE00000' });
				else out.push({ email: 'probe-placeholder@example.com', orderRef: token });
			}
		}
		return out;
	}

	function parseHeadersOverride(): unknown {
		const raw = overrideHeadersJson.trim();
		if (!raw) return undefined;
		try {
			return JSON.parse(raw);
		} catch {
			toast.error('Headers JSON is not valid');
			throw new Error('bad headers json');
		}
	}

	async function importCurl() {
		const text = curlInput.trim();
		if (!text) {
			toast.error('Paste a cURL command first');
			return;
		}
		importingCurl = true;
		try {
			const res = await fetch('/api/order-checker/import-curl', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					curl: text,
					sampleEmail: DIAGNOSTIC.email,
					sampleOrderRef: DIAGNOSTIC.orderRef
				})
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as {
				ok: boolean;
				probeUrl: string;
				method: string;
				headers: Record<string, string>;
				bodyTemplate: string;
			};
			if (!data.ok && !data.probeUrl) {
				toast.error('Could not parse URL from cURL command');
				return;
			}
			overrideProbeUrl = data.probeUrl || '';
			overrideMethod = data.method || 'POST';
			overrideBody = data.bodyTemplate || '';
			overrideHeadersJson = JSON.stringify(data.headers || {}, null, 2);
			showAdvanced = true;
			toast.success('Imported cURL — override fields populated');
		} catch (err: any) {
			toast.error(err?.message || 'Import failed');
		} finally {
			importingCurl = false;
		}
	}

	function clearOverrides() {
		overrideProbeUrl = '';
		overrideMethod = '';
		overrideBody = '';
		overrideHeadersJson = '';
	}

	async function runCheck(pairsArg?: { email: string; orderRef: string }[], modeArg?: Mode) {
		if (running) return;
		const activeMode: Mode = modeArg ?? mode;
		const pairs = pairsArg ?? parsePairs(pairsText, activeMode);
		if (pairs.length === 0) {
			toast.error(
				activeMode === 'pair'
					? 'Add at least one email,orderRef pair'
					: activeMode === 'email'
						? 'Add at least one email'
						: 'Add at least one order ref'
			);
			return;
		}
		let headersOverride: unknown;
		try {
			headersOverride = parseHeadersOverride();
		} catch {
			return;
		}
		results = [];
		summary = null;
		progress = { completed: 0, total: pairs.length };
		running = true;
		abortController = new AbortController();

		try {
			const res = await fetch('/api/order-checker', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pairs,
					threshold,
					concurrency,
					runs,
					mode: activeMode,
					probeUrl: overrideProbeUrl.trim() || undefined,
					method: overrideMethod.trim() || undefined,
					bodyTemplate: overrideBody || undefined,
					headers: headersOverride,
					save: saveBatch
				}),
				signal: abortController.signal
			});

			if (!res.ok || !res.body) {
				const txt = await res.text().catch(() => '');
				throw new Error(txt || `HTTP ${res.status}`);
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let nl: number;
				while ((nl = buffer.indexOf('\n')) !== -1) {
					const line = buffer.slice(0, nl).trim();
					buffer = buffer.slice(nl + 1);
					if (!line) continue;
					try {
						const event = JSON.parse(line);
						handleEvent(event);
					} catch {
						/* skip bad line */
					}
				}
			}
		} catch (err: any) {
			if (err?.name !== 'AbortError') {
				toast.error(err?.message || 'Probe failed');
			}
		} finally {
			running = false;
			progress = null;
			abortController = null;
			if (saveBatch) void refreshHistory();
		}
	}

	function handleEvent(event: { type: string; [k: string]: any }) {
		if (event.type === 'result' && event.result) {
			results = [...results, event.result as ProbeResult];
			if (progress) progress = { ...progress, completed: results.length };
		} else if (event.type === 'summary') {
			summary = event.summary as BatchSummary;
			if (event.batchId) toast.success(`Saved batch #${event.batchId}`);
		} else if (event.type === 'error') {
			toast.error(event.message || 'Batch failed');
		} else if (event.type === 'warn') {
			toast.error(event.message || 'Warning');
		}
	}

	function cancelRun() {
		abortController?.abort();
		running = false;
	}

	function runDiagnostic() {
		if (mode === 'email') {
			pairsText = DIAGNOSTIC.email;
			void runCheck([{ email: DIAGNOSTIC.email, orderRef: 'PROBE00000' }], 'email');
		} else if (mode === 'orderRef') {
			pairsText = DIAGNOSTIC.orderRef;
			void runCheck([{ email: 'probe-placeholder@example.com', orderRef: DIAGNOSTIC.orderRef }], 'orderRef');
		} else {
			pairsText = `${DIAGNOSTIC.email}, ${DIAGNOSTIC.orderRef}`;
			void runCheck([{ email: DIAGNOSTIC.email, orderRef: DIAGNOSTIC.orderRef }], 'pair');
		}
	}

	function onFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			pairsText = String(reader.result || '');
		};
		reader.readAsText(file);
	}

	function exportCsv() {
		if (results.length === 0) {
			toast.error('No results to export');
			return;
		}
		const lines = [['email', 'orderRef', 'elapsedMs', 'httpStatus', 'inferredValid', 'notes'].join(',')];
		for (const r of results) {
			lines.push(
				[
					csvCell(r.email),
					csvCell(r.orderRef),
					String(r.elapsedMs),
					String(r.httpStatus || ''),
					r.inferredValid ? 'yes' : 'no',
					csvCell(r.notes.join('; '))
				].join(',')
			);
		}
		const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `order-check-${Date.now()}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function csvCell(s: string): string {
		const str = String(s ?? '');
		if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
		return str;
	}

	function copyRow(r: ProbeResult) {
		const text = `${r.email}\t${r.orderRef}\t${r.elapsedMs}ms\t${r.inferredValid ? 'VALID' : 'invalid'}`;
		navigator.clipboard?.writeText(text);
		toast.success('Row copied');
	}

	function copyValid() {
		const valid = results.filter((r) => r.inferredValid);
		if (valid.length === 0) {
			toast.error('No valid pairs');
			return;
		}
		const text = valid.map((r) => `${r.email}, ${r.orderRef}`).join('\n');
		navigator.clipboard?.writeText(text);
		toast.success(`Copied ${valid.length} valid pair(s)`);
	}

	async function loadBatch(id: string) {
		try {
			const res = await fetch(`/api/order-checker/${id}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			const batch = data.batch as { results: ProbeResult[]; summary: BatchSummary };
			results = batch.results || [];
			summary = batch.summary || null;
			toast.success(`Loaded batch #${id}`);
		} catch (err: any) {
			toast.error(err?.message || 'Failed to load batch');
		}
	}

	async function deleteBatch(id: string) {
		try {
			const res = await fetch(`/api/order-checker/${id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			batches = batches.filter((b) => b.id !== id);
			toast.success(`Deleted batch #${id}`);
		} catch (err: any) {
			toast.error(err?.message || 'Failed to delete batch');
		}
	}

	function fmtDate(ts: number): string {
		if (!ts) return '—';
		try {
			return new Date(ts).toLocaleString();
		} catch {
			return '—';
		}
	}
</script>

<svelte:head>
	<title>Order Checker · Panel</title>
</svelte:head>

<div class="p-8 pt-5 space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-bold text-[var(--foreground)]">
				<PackageSearch size={22} />
				Order Checker
			</h1>
			<p class="mt-1 text-xs text-[var(--muted-foreground)]">
				Validate Ledger <code class="rounded bg-[var(--accent)]/40 px-1 font-mono">email + order ref</code>
				pairs via response-time oracle. Configure probe at
				<a href="/settings" class="underline">Settings</a>.
			</p>
		</div>
		{#if config}
			<div class="flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
				<span class="rounded-md border border-[var(--border)] px-2 py-1">
					Probe: <span class="font-mono text-[var(--foreground)]">{config.method} {config.probeUrl}</span>
				</span>
				<span class="rounded-md border border-[var(--border)] px-2 py-1">
					Default threshold: <span class="font-mono text-[var(--foreground)]">{config.threshold}ms</span>
				</span>
			</div>
		{/if}
	</div>

	<div class="grid gap-5 xl:grid-cols-3">
		<div class="xl:col-span-2 space-y-4">
			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
				<div class="mb-3 flex flex-wrap items-center gap-2">
					<span class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Mode</span>
					<div class="inline-flex overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--input)]/40 text-[11px]">
						{#each [['pair', 'Email + Order Ref'], ['email', 'Email only'], ['orderRef', 'Order ref only']] as [val, label]}
							<button
								type="button"
								onclick={() => (mode = val as Mode)}
								class="px-3 py-1.5 transition-soft {mode === val ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'}"
							>
								{label}
							</button>
						{/each}
					</div>
					<span class="ml-auto text-[10px] text-[var(--muted-foreground)]">
						{#if mode === 'pair'}One <code class="font-mono">email, orderRef</code> per line{/if}
						{#if mode === 'email'}One email per line — order ref filled with placeholder{/if}
						{#if mode === 'orderRef'}One order ref per line — email filled with placeholder{/if}
					</span>
				</div>
				<div class="flex items-center justify-between gap-2">
					<label for="pairs-input" class="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
						{#if mode === 'pair'}Pairs{:else if mode === 'email'}Emails{:else}Order refs{/if}
					</label>
					<div class="flex items-center gap-2">
						<input
							bind:this={fileInput}
							type="file"
							accept=".csv,.txt"
							class="hidden"
							onchange={onFile}
						/>
						<button
							type="button"
							class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
							onclick={() => fileInput?.click()}
						>
							<FileUp size={12} /> Upload CSV
						</button>
						<button
							type="button"
							class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
							onclick={runDiagnostic}
							disabled={running}
							title="Submit the known-valid pair to calibrate the threshold"
						>
							<Sparkles size={12} /> Run diagnostic
						</button>
					</div>
				</div>
				<textarea
					id="pairs-input"
					bind:value={pairsText}
					rows="9"
					spellcheck="false"
					class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 font-mono text-[12px] text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
					placeholder={mode === 'pair'
						? 'ooyeleye0@gmail.com, LDG3530088'
						: mode === 'email'
							? 'ooyeleye0@gmail.com'
							: 'LDG3530088'}
				></textarea>

				<details class="mt-4 rounded-lg border border-[var(--border)] bg-[var(--input)]/20" bind:open={showAdvanced}>
					<summary class="cursor-pointer select-none px-3 py-2 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
						Advanced — per-batch probe overrides (URL / body / headers / cURL import)
					</summary>
					<div class="space-y-3 border-t border-[var(--border)] p-3">
						<div>
							<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
								Paste cURL from DevTools
							</label>
							<textarea
								bind:value={curlInput}
								rows="3"
								spellcheck="false"
								placeholder={'curl \'https://my-order.ledger.com/api/...\' \\\n  -H \'cookie: ...\' \\\n  --data-raw \'{"email":"...","orderReference":"..."}\''}
								class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
							></textarea>
							<div class="mt-2 flex flex-wrap items-center gap-2">
								<button
									type="button"
									onclick={importCurl}
									disabled={importingCurl}
									class="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
								>
									{#if importingCurl}<Loader2 size={11} class="animate-spin" />{:else}<FileUp size={11} />{/if}
									Parse cURL
								</button>
								<button
									type="button"
									onclick={clearOverrides}
									class="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
								>
									<Square size={10} /> Clear overrides
								</button>
								<span class="text-[10px] text-[var(--muted-foreground)]">
									In Chrome DevTools → Network → right-click the login request → Copy → Copy as cURL.
								</span>
							</div>
						</div>

						<div class="grid gap-2 sm:grid-cols-4">
							<label class="block sm:col-span-3">
								<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Probe URL (override)</span>
								<input
									bind:value={overrideProbeUrl}
									placeholder="(leave blank = use Settings default)"
									class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
								/>
							</label>
							<label class="block">
								<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Method</span>
								<input
									bind:value={overrideMethod}
									placeholder="POST"
									class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
								/>
							</label>
						</div>

						<label class="block">
							<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Body template (override)</span>
							<textarea
								bind:value={overrideBody}
								rows="3"
								spellcheck="false"
								placeholder={'{"email":"{{email}}","orderReference":"{{orderRef}}"}'}
								class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
							></textarea>
						</label>

						<label class="block">
							<span class="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Headers JSON (override)</span>
							<textarea
								bind:value={overrideHeadersJson}
								rows="5"
								spellcheck="false"
								placeholder="(leave blank = use Settings default)"
								class="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
							></textarea>
						</label>
					</div>
				</details>

				<div class="mt-4 grid gap-3 sm:grid-cols-4">
					<label class="block">
						<span class="block text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
							Threshold (ms)
						</span>
						<input
							type="number"
							min="0"
							bind:value={threshold}
							oninput={() => (hasOverriddenThreshold = true)}
							class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
						/>
					</label>
					<label class="block">
						<span class="block text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
							Runs / pair
						</span>
						<input
							type="number"
							min="1"
							max="8"
							bind:value={runs}
							oninput={() => (hasOverriddenRuns = true)}
							class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
						/>
					</label>
					<label class="block">
						<span class="block text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
							Concurrency
						</span>
						<input
							type="number"
							min="1"
							max="10"
							bind:value={concurrency}
							oninput={() => (hasOverriddenConcurrency = true)}
							class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
						/>
					</label>
					<label class="flex cursor-pointer items-end gap-2 text-xs text-[var(--muted-foreground)]">
						<input type="checkbox" bind:checked={saveBatch} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
						Save batch to history
					</label>
				</div>

				<div class="mt-4 flex flex-wrap items-center gap-2">
					{#if running}
						<button
							type="button"
							onclick={cancelRun}
							class="flex items-center gap-1.5 rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-xs font-medium text-[var(--destructive)] transition-soft hover:bg-[var(--destructive)]/15"
						>
							<Square size={13} /> Stop
						</button>
					{:else}
						<button
							type="button"
							onclick={() => runCheck()}
							class="btn-accent flex items-center gap-2 px-4 py-2 text-xs"
						>
							<Play size={13} /> Run check
						</button>
					{/if}
					{#if progress}
						<span class="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
							<Loader2 size={12} class="animate-spin" />
							{progress.completed} / {progress.total}
						</span>
					{/if}
					{#if summary}
						<span class="text-xs text-[var(--muted-foreground)]">
							Last batch: <span class="text-[var(--foreground)]">{summary.valid}</span> valid,
							<span class="text-[var(--foreground)]">{summary.invalid}</span> invalid,
							<span class="text-[var(--foreground)]">{summary.errored}</span> errored in
							{(summary.durationMs / 1000).toFixed(1)}s
						</span>
					{/if}
				</div>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)]">
				<div class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
					<div class="flex items-center gap-3">
						<h2 class="text-sm font-semibold text-[var(--foreground)]">Results</h2>
						<span class="text-xs text-[var(--muted-foreground)]">
							{results.length} total · {validCount} valid · {erroredCount} errored
						</span>
					</div>
					<div class="flex items-center gap-2">
						<label class="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
							<input type="checkbox" bind:checked={validOnly} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
							<Filter size={11} /> Valid only
						</label>
						<button
							type="button"
							onclick={copyValid}
							class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
						>
							<Copy size={11} /> Copy valid
						</button>
						<button
							type="button"
							onclick={exportCsv}
							class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
						>
							<Download size={11} /> Export CSV
						</button>
					</div>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="bg-[var(--input)]/40 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
							<tr>
								<th class="px-3 py-2">Email</th>
								<th class="px-3 py-2">Order ref</th>
								<th class="px-3 py-2 text-right">Elapsed</th>
								<th class="px-3 py-2 text-right">HTTP</th>
								<th class="px-3 py-2">Verdict</th>
								<th class="px-3 py-2">Notes</th>
								<th class="px-3 py-2"></th>
							</tr>
						</thead>
						<tbody>
							{#each visibleResults as r}
								<tr class="border-t border-[var(--border-subtle)]">
									<td class="px-3 py-2 font-mono text-[var(--foreground)]">{r.email}</td>
									<td class="px-3 py-2 font-mono text-[var(--foreground)]">{r.orderRef}</td>
									<td class="px-3 py-2 text-right font-mono {r.inferredValid ? 'text-emerald-300' : 'text-[var(--muted-foreground)]'}">
										{r.elapsedMs}ms
									</td>
									<td class="px-3 py-2 text-right font-mono text-[var(--muted-foreground)]">
										{r.httpStatus || '—'}
									</td>
									<td class="px-3 py-2">
										{#if r.error}
											<span class="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
												<AlertTriangle size={10} /> Error
											</span>
										{:else if r.inferredValid}
											<span class="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
												<CheckCircle2 size={10} /> Valid
											</span>
										{:else}
											<span class="inline-flex items-center gap-1 rounded-md bg-[var(--accent)]/40 px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">
												<CircleSlash size={10} /> Invalid
											</span>
										{/if}
									</td>
									<td class="px-3 py-2 text-[var(--muted-foreground)]">
										{r.notes.join(', ') || '—'}
									</td>
									<td class="px-3 py-2 text-right">
										<button
											type="button"
											onclick={() => copyRow(r)}
											class="rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
											title="Copy row"
											aria-label="Copy row"
										>
											<Copy size={12} />
										</button>
									</td>
								</tr>
							{/each}
							{#if visibleResults.length === 0}
								<tr>
									<td colspan="7" class="px-3 py-10 text-center text-[var(--muted-foreground)]">
										{running ? 'Running probes…' : 'No results yet.'}
									</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<div class="space-y-4">
			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
				<div class="flex items-center justify-between gap-2">
					<h2 class="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
						<History size={14} /> Recent batches
					</h2>
					<button
						type="button"
						onclick={refreshHistory}
						class="rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
						aria-label="Refresh"
						disabled={loadingHistory}
					>
						<RefreshCw size={12} class={loadingHistory ? 'animate-spin' : ''} />
					</button>
				</div>
				<div class="mt-3 space-y-2">
					{#each batches as b}
						<div class="rounded-lg border border-[var(--border)] bg-[var(--input)]/30 p-3 text-xs">
							<div class="flex items-center justify-between gap-2">
								<span class="font-mono text-[var(--foreground)]">#{b.id}</span>
								<span class="text-[10px] text-[var(--muted-foreground)]">{fmtDate(b.createdAt)}</span>
							</div>
							<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted-foreground)]">
								<span>{b.summary?.total ?? 0} pairs</span>
								<span class="text-emerald-300">{b.summary?.valid ?? 0} valid</span>
								<span>{b.summary?.invalid ?? 0} invalid</span>
								{#if b.summary?.errored}
									<span class="text-amber-300">{b.summary.errored} errored</span>
								{/if}
							</div>
							<div class="mt-2 flex items-center justify-between">
								<span class="text-[10px] text-[var(--muted-foreground)]">by {b.createdBy || 'unknown'}</span>
								<div class="flex items-center gap-1">
									<button
										type="button"
										onclick={() => loadBatch(b.id)}
										class="rounded-md border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
									>
										Load
									</button>
									<button
										type="button"
										onclick={() => deleteBatch(b.id)}
										class="rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
										aria-label="Delete batch"
									>
										<Trash2 size={11} />
									</button>
								</div>
							</div>
						</div>
					{/each}
					{#if batches.length === 0 && !loadingHistory}
						<p class="text-center text-xs text-[var(--muted-foreground)]">No batches saved yet.</p>
					{/if}
				</div>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-xs text-[var(--muted-foreground)]">
				<h2 class="text-sm font-semibold text-[var(--foreground)]">How it works</h2>
				<p class="mt-2 leading-relaxed">
					Each pair is POSTed to the configured probe URL. We measure response time across N runs
					(default {config?.runs ?? 2}) and use the median. A row is marked
					<span class="font-medium text-emerald-300">valid</span> when the response succeeds and the
					median latency is greater than or equal to the threshold.
				</p>
				<p class="mt-3 leading-relaxed">
					If you see <span class="font-medium text-amber-300">Error</span> rows (timeouts, 403/Cloudflare,
					5xx) the timing classification can't be trusted — adjust headers in Settings.
				</p>
				<div class="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200">
					<strong class="block">Ledger note:</strong>
					<code class="font-mono">my-order.ledger.com</code> is behind Cloudflare Managed Challenge.
					GET requests get blocked, but POSTs with the right Origin/Referer pass through to the
					real Symfony backend. The exact API path isn't published — open the login page in your
					browser, submit a real pair with DevTools open, then <strong>Copy as cURL</strong> from
					the Network tab and paste it into the Advanced panel. The panel auto-fills the URL,
					method, headers, and body template.
				</div>
			</div>
		</div>
	</div>
</div>
