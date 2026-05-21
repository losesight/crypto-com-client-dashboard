<script lang="ts">
	import { onMount } from 'svelte';
	import {
		FileText,
		Plus,
		Upload,
		Search,
		RefreshCw,
		Download,
		Copy,
		Trash2,
		Eye,
		Monitor,
		Smartphone,
		Code as CodeIcon,
		Save,
		Lock,
		X,
		Check
	} from 'lucide-svelte';
	import { page } from '$app/stores';
	import { toast } from '$lib/stores/toast';

	interface Template {
		id: string;
		slug: string;
		name: string;
		subject: string;
		html: string;
		variables: string[];
		ownerUsername: string;
		shared: boolean;
		createdAt: number;
		updatedAt: number;
	}

	let templates: Template[] = $state([]);
	let loading = $state(false);
	let selectedId: string | null = $state(null);
	let search = $state('');
	let filter = $state<'all' | 'mine' | 'shared'>('all');
	let previewMode = $state<'desktop' | 'mobile'>('desktop');
	let showCreate = $state(false);
	let showImport = $state(false);
	let saving = $state(false);
	let saved = $state(false);

	let username = $derived($page.data.user?.username ?? '');

	let selected = $derived(templates.find((t) => t.id === selectedId) ?? null);
	let canEdit = $derived(
		!!selected && (!selected.ownerUsername || selected.ownerUsername === username)
	);

	let filtered = $derived(
		templates.filter((t) => {
			if (filter === 'mine' && t.ownerUsername !== username) return false;
			if (filter === 'shared' && !t.shared) return false;
			if (search.trim()) {
				const q = search.toLowerCase();
				return (
					t.name.toLowerCase().includes(q) ||
					t.subject.toLowerCase().includes(q) ||
					t.ownerUsername.toLowerCase().includes(q)
				);
			}
			return true;
		})
	);

	// Editor draft state (only synced to DB on Save)
	let draftName = $state('');
	let draftSubject = $state('');
	let draftHtml = $state('');

	$effect(() => {
		if (selected) {
			draftName = selected.name;
			draftSubject = selected.subject;
			draftHtml = selected.html;
		}
	});

	let dirty = $derived(
		!!selected &&
			canEdit &&
			(draftName !== selected.name || draftSubject !== selected.subject || draftHtml !== selected.html)
	);

	async function fetchTemplates() {
		loading = true;
		try {
			const res = await fetch('/api/templates');
			if (res.ok) {
				const data = await res.json();
				templates = data.templates;
				if (!selectedId && templates.length > 0) selectedId = templates[0].id;
			}
		} finally {
			loading = false;
		}
	}

	onMount(fetchTemplates);

	// Create modal state
	let newName = $state('');
	let newHtml = $state('');
	let newShared = $state(false);

	async function createTemplate() {
		if (!newName.trim()) return;
		const res = await fetch('/api/templates', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newName, html: newHtml, shared: newShared })
		});
		if (res.ok) {
			const data = await res.json();
			templates = [data.template, ...templates];
			selectedId = data.template.id;
			showCreate = false;
			newName = '';
			newHtml = '';
			newShared = false;
			toast.success('Template created');
		} else {
			toast.error('Failed to create template');
		}
	}

	async function importTemplate() {
		if (!importHtml.trim()) return;
		const res = await fetch('/api/templates/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: importName, html: importHtml })
		});
		if (res.ok) {
			const data = await res.json();
			templates = [data.template, ...templates];
			selectedId = data.template.id;
			showImport = false;
			importName = '';
			importHtml = '';
			toast.success('Template imported');
		} else {
			toast.error('Failed to import template');
		}
	}

	let importName = $state('');
	let importHtml = $state('');

	function onImportFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			importHtml = String(reader.result || '');
			if (!importName) importName = file.name.replace(/\.html?$/i, '');
		};
		reader.readAsText(file);
	}

	async function saveCurrent() {
		if (!selected || !canEdit || saving) return;
		saving = true;
		try {
			const res = await fetch(`/api/templates/${selected.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: draftName, subject: draftSubject, html: draftHtml })
			});
			if (res.ok) {
				const data = await res.json();
				templates = templates.map((t) => (t.id === selected!.id ? data.template : t));
				saved = true;
				setTimeout(() => (saved = false), 1200);
			} else {
				toast.error('Failed to save template');
			}
		} finally {
			saving = false;
		}
	}

	async function deleteTemplate(t: Template) {
		if (!confirm(`Delete template "${t.name}"?`)) return;
		const res = await fetch(`/api/templates/${t.id}`, { method: 'DELETE' });
		if (res.ok) {
			templates = templates.filter((x) => x.id !== t.id);
			if (selectedId === t.id) selectedId = templates[0]?.id ?? null;
			toast.success(`Deleted template "${t.name}"`);
		} else {
			toast.error('Cannot delete (you may not own this template).');
		}
	}

	async function copyTemplate(t: Template) {
		const res = await fetch(`/api/templates/${t.id}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'copy' })
		});
		if (res.ok) {
			const data = await res.json();
			templates = [data.template, ...templates];
			selectedId = data.template.id;
		}
	}

	function downloadTemplate(t: Template) {
		window.open(`/api/templates/${t.id}/download`, '_blank');
	}

	function fmtDate(ts: number): string {
		if (!ts) return '—';
		try {
			return new Date(ts).toLocaleDateString();
		} catch {
			return '—';
		}
	}
</script>

<svelte:head>
	<title>Templates · Panel</title>
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { if (showCreate) showCreate = false; else if (showImport) showImport = false; } }} />

<div class="p-8 pt-5">
	<div class="mb-5 flex items-start justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Templates</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">HTML email templates with variable substitution</p>
		</div>
		<div class="flex items-center gap-2">
			<button onclick={() => (showImport = true)} class="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
				<Upload size={12} />
				Import
			</button>
			<button onclick={() => (showCreate = true)} class="btn-accent flex items-center gap-1.5 px-4 py-2 text-xs">
				<Plus size={13} />
				New Template
			</button>
		</div>
	</div>

	<div class="grid gap-4 xl:grid-cols-12">
		<!-- LIST -->
		<aside class="xl:col-span-3">
			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
				<div class="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<FileText size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Templates</p>
						<span class="rounded-md bg-[var(--accent-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--text-accent)]">{filtered.length}</span>
					</div>
					<button onclick={fetchTemplates} class="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]" aria-label="Refresh">
						<RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
					</button>
				</div>
				<div class="p-3 space-y-2 border-b border-[var(--border)]">
					<div class="relative">
						<Search size={11} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
						<input
							type="text"
							bind:value={search}
							placeholder="Search templates..."
							class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] py-1.5 pl-7 pr-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
						/>
					</div>
					<select
						bind:value={filter}
						class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
					>
						<option value="all">All templates</option>
						<option value="mine">My templates</option>
						<option value="shared">Shared</option>
					</select>
				</div>

				<div class="max-h-[68vh] overflow-y-auto custom-scrollbar">
					{#each filtered as t (t.id)}
						<div
							role="button"
							tabindex="0"
							onclick={() => (selectedId = t.id)}
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectedId = t.id; }}
							class="cursor-pointer border-b border-[var(--border-subtle)] px-4 py-3 transition-soft-no-bg hover:bg-[var(--accent)]/30 last:border-0 {selectedId === t.id ? 'bg-[var(--accent-primary)]/10' : ''}"
						>
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<p class="truncate text-xs font-semibold text-[var(--foreground)]">{t.name}</p>
										{#if t.shared}
											<span class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">Shared</span>
										{/if}
									</div>
									<p class="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">
										{t.ownerUsername === username ? 'Your template' : `by ${t.ownerUsername || 'unknown'}`}
									</p>
									<div class="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
										<span>{t.variables.length} variables</span>
										<span>·</span>
										<span>{fmtDate(t.updatedAt || t.createdAt)}</span>
									</div>
								</div>
								<div class="flex shrink-0 items-center gap-0.5">
									<button onclick={(e) => { e.stopPropagation(); downloadTemplate(t); }} class="rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]" aria-label="Download" title="Download">
										<Download size={11} />
									</button>
									<button onclick={(e) => { e.stopPropagation(); copyTemplate(t); }} class="rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]" aria-label="Copy" title="Copy to your account">
										<Copy size={11} />
									</button>
									{#if t.ownerUsername === username}
										<button onclick={(e) => { e.stopPropagation(); deleteTemplate(t); }} class="rounded-md p-1 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]" aria-label="Delete" title="Delete">
											<Trash2 size={11} />
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
					{#if filtered.length === 0}
						<div class="py-8 text-center text-xs text-[var(--muted-foreground)]">No templates match.</div>
					{/if}
				</div>
			</div>
		</aside>

		<!-- EDITOR -->
		<section class="xl:col-span-5">
			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
				<div class="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<CodeIcon size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Template Editor</p>
						{#if selected && !canEdit}
							<span class="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
								<Lock size={10} />
								Read-only
							</span>
						{/if}
					</div>
					<button
						onclick={saveCurrent}
						disabled={!dirty || saving}
						class="btn-accent flex items-center gap-1.5 px-3 py-1.5 text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if saving}
							<RefreshCw size={11} class="animate-spin" />
							Saving...
						{:else if saved}
							<Check size={11} />
							Saved
						{:else}
							<Save size={11} />
							Save
						{/if}
					</button>
				</div>

				{#if !selected}
					<div class="flex h-[60vh] items-center justify-center">
						<p class="text-xs text-[var(--muted-foreground)]">Select a template to edit</p>
					</div>
				{:else}
					<div class="space-y-3 p-4">
						<div>
							<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Name</label>
							<input
								type="text"
								bind:value={draftName}
								disabled={!canEdit}
								class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none disabled:opacity-60"
							/>
						</div>
						<div>
							<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Subject</label>
							<input
								type="text"
								bind:value={draftSubject}
								disabled={!canEdit}
								class="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none disabled:opacity-60"
							/>
						</div>
						<div>
							<label class="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">HTML Body</label>
							<textarea
								bind:value={draftHtml}
								disabled={!canEdit}
								rows={18}
								class="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none disabled:opacity-60"
							></textarea>
							<p class="mt-1 text-[10px] text-[var(--text-tertiary)]">
								Use <code class="rounded bg-[var(--accent)]/30 px-1 font-mono">{'{{variable}}'}</code> syntax. Variables are extracted automatically.
							</p>
						</div>

						{#if selected.variables.length > 0}
							<div class="rounded-md border border-[var(--border)] bg-[var(--input)]/30 p-3">
								<p class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
									Variables ({selected.variables.length})
								</p>
								<div class="flex flex-wrap gap-1">
									{#each selected.variables as v}
										<span class="rounded border border-[var(--border)] bg-[var(--input)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-accent)]">{v}</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</section>

		<!-- PREVIEW -->
		<section class="xl:col-span-4">
			<div class="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden" style="box-shadow: var(--shadow-sm);">
				<div class="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Eye size={14} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Live Preview</p>
					</div>
					<div class="flex items-center gap-1 rounded-md border border-[var(--border)] p-0.5">
						<button
							onclick={() => (previewMode = 'desktop')}
							class="flex items-center gap-1 rounded px-2 py-1 text-[10px] {previewMode === 'desktop' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)]'}"
						>
							<Monitor size={11} />
							Desktop
						</button>
						<button
							onclick={() => (previewMode = 'mobile')}
							class="flex items-center gap-1 rounded px-2 py-1 text-[10px] {previewMode === 'mobile' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)]'}"
						>
							<Smartphone size={11} />
							Mobile
						</button>
					</div>
				</div>
				<div class="bg-white" style="height: 70vh;">
					{#if !selected}
						<div class="flex h-full items-center justify-center text-xs text-zinc-500">
							Select a template to preview
						</div>
					{:else}
						<div class="h-full w-full {previewMode === 'mobile' ? 'flex items-center justify-center bg-zinc-100' : ''}">
							<iframe
								srcdoc={draftHtml || selected.html}
								title="Email preview"
								class="border-0 {previewMode === 'mobile' ? 'h-[640px] w-[375px] shadow-xl' : 'h-full w-full'}"
								sandbox="allow-same-origin"
							></iframe>
						</div>
					{/if}
				</div>
			</div>
		</section>
	</div>
</div>

<!-- Create modal -->
{#if showCreate}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (showCreate = false)}>
		<div class="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-base font-semibold text-[var(--foreground)]">Create New Template</h3>
				<button onclick={() => (showCreate = false)} aria-label="Close" class="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]">
					<X size={16} />
				</button>
			</div>
			<div class="space-y-4">
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Template Name</label>
					<input bind:value={newName} type="text" placeholder="Enter template name" class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div class="rounded-md border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 px-3 py-2 text-[11px] text-[var(--text-accent)]">
					Tip: use <code class="rounded bg-[var(--accent-primary)]/15 px-1 font-mono">{'{{variable}}'}</code> syntax to create dynamic variables.
				</div>
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">HTML Content</label>
					<textarea bind:value={newHtml} rows={10} placeholder={'<p>Hello {{Recipient name}},</p>'} class="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-xs text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"></textarea>
				</div>
				<label class="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
					<input type="checkbox" bind:checked={newShared} class="h-3.5 w-3.5 accent-[var(--accent-primary)]" />
					Share with other operators (read-only for them)
				</label>
			</div>
			<div class="mt-5 flex justify-end gap-2">
				<button onclick={() => (showCreate = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={createTemplate} disabled={!newName.trim()} class="btn-accent px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">Create Template</button>
			</div>
		</div>
	</div>
{/if}

<!-- Import modal -->
{#if showImport}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={() => (showImport = false)}>
		<div class="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl" onclick={(e) => e.stopPropagation()}>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-base font-semibold text-[var(--foreground)]">Import Template</h3>
				<button onclick={() => (showImport = false)} aria-label="Close" class="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]">
					<X size={16} />
				</button>
			</div>
			<div class="space-y-4">
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Upload .html file</label>
					<input type="file" accept=".html,.htm" onchange={onImportFile} class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--accent-primary)]/15 file:px-3 file:py-1 file:text-xs file:text-[var(--text-accent)]" />
				</div>
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Name (optional)</label>
					<input bind:value={importName} type="text" placeholder="Auto-detected from file" class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none" />
				</div>
				<div>
					<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">HTML Preview</label>
					<textarea bind:value={importHtml} rows={6} class="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-[11px] text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"></textarea>
				</div>
			</div>
			<div class="mt-5 flex justify-end gap-2">
				<button onclick={() => (showImport = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)]">Cancel</button>
				<button onclick={importTemplate} disabled={!importHtml.trim()} class="btn-accent px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">Import</button>
			</div>
		</div>
	</div>
{/if}
