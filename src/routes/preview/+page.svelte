<script lang="ts">
	import { Eye, ExternalLink, Copy, Check, Search, LayoutGrid, Rows3 } from 'lucide-svelte';
	import { toast } from '$lib/stores/toast';
	import { VISITOR_TEMPLATES, templatesByModule, thumbUrl, previewUrl as buildPreviewUrl } from '$lib/visitorTemplates';

	let selectedKey = $state('');
	let copied = $state(false);
	let search = $state('');
	let view = $state<'grid' | 'list'>('grid');

	const grouped = templatesByModule();

	const decorated = VISITOR_TEMPLATES.map((t) => ({
		...t,
		key: `${t.module}/${t.page}`,
		thumb: thumbUrl(t.slug)
	}));

	let filtered = $derived(
		search.trim()
			? decorated.filter((e) =>
					e.module.toLowerCase().includes(search.toLowerCase()) ||
					e.page.toLowerCase().includes(search.toLowerCase()) ||
					e.slug.toLowerCase().includes(search.toLowerCase())
				)
			: decorated
	);

	let selected = $derived(decorated.find((e) => e.key === selectedKey));

	let previewHref = $derived.by(() => {
		if (!selected) return '';
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		return buildPreviewUrl(selected.module, selected.page, origin);
	});

	function copyLink() {
		if (!previewHref) return;
		navigator.clipboard.writeText(previewHref);
		copied = true;
		toast.success('Preview link copied to clipboard');
		setTimeout(() => (copied = false), 2000);
	}

	function openInNewTab() {
		if (!previewHref) return;
		window.open(previewHref, '_blank');
	}

	let countLabel = $derived(
		filtered.length === decorated.length
			? `${decorated.length} templates`
			: `${filtered.length} of ${decorated.length}`
	);
</script>

<svelte:head>
	<title>Page Preview · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Page Preview</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">
				Browse and preview every visitor template — {countLabel} ready to serve at <code class="rounded bg-[var(--accent)]/30 px-1 font-mono text-[11px]">/templates/preview/{`{Brand}/{Page}`}</code>
			</p>
		</div>

		<div class="flex items-center gap-2">
			<div class="relative">
				<Search size={13} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
				<input
					bind:value={search}
					type="search"
					placeholder="Filter…"
					class="w-56 rounded-lg border border-[var(--border)] bg-[var(--input)] py-2 pl-7 pr-3 text-xs text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
				/>
			</div>
			<div class="flex items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-0.5">
				<button
					onclick={() => (view = 'grid')}
					title="Grid"
					aria-label="Grid view"
					class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-soft {view === 'grid' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}"
				>
					<LayoutGrid size={11} />
				</button>
				<button
					onclick={() => (view = 'list')}
					title="List"
					aria-label="List view"
					class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-soft {view === 'list' ? 'bg-[var(--accent-primary)]/15 text-[var(--text-accent)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}"
				>
					<Rows3 size={11} />
				</button>
			</div>
		</div>
	</div>

	<div class="grid gap-5 xl:grid-cols-12">
		<div class="xl:col-span-5">
			{#if view === 'grid'}
				<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
					{#each filtered as e (e.key)}
						{@const active = selectedKey === e.key}
						<button
							type="button"
							onclick={() => (selectedKey = e.key)}
							class="group flex flex-col overflow-hidden rounded-lg border-2 text-left transition-all {active ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-hover)]'}"
						>
							<div class="aspect-video overflow-hidden bg-black/30">
								<img src={e.thumb} alt={e.key} loading="lazy" class="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.02]" />
							</div>
							<div class="p-2.5">
								<p class="truncate text-[11px] font-semibold text-[var(--foreground)]">{e.module}</p>
								<p class="truncate text-[10px] text-[var(--muted-foreground)]">{e.page}</p>
							</div>
						</button>
					{/each}
					{#if filtered.length === 0}
						<p class="col-span-full py-10 text-center text-xs text-[var(--text-tertiary)]">No templates match "{search}"</p>
					{/if}
				</div>
			{:else}
				<div class="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
					{#each Object.entries(grouped) as [moduleName, items]}
						{@const visible = items.filter(
							(t) => !search.trim() || moduleName.toLowerCase().includes(search.toLowerCase()) || t.page.toLowerCase().includes(search.toLowerCase())
						)}
						{#if visible.length}
							<div class="border-b border-[var(--border)] last:border-b-0">
								<p class="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{moduleName}</p>
								<div>
									{#each visible as t}
										{@const key = `${t.module}/${t.page}`}
										{@const active = selectedKey === key}
										<button
											type="button"
											onclick={() => (selectedKey = key)}
											class="flex w-full items-center justify-between px-4 py-2 text-xs transition-soft {active ? 'bg-[var(--accent-primary)]/10 text-[var(--text-accent)]' : 'text-[var(--foreground)] hover:bg-[var(--accent)]'}"
										>
											<span class="truncate">{t.page}</span>
											{#if active}<Check size={11} />{/if}
										</button>
									{/each}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<div class="xl:col-span-7">
			{#if previewHref}
				<div class="animate-fade-slide-up overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]" style="box-shadow: var(--shadow-sm);">
					<div class="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
						<div class="flex min-w-0 items-center gap-2.5">
							<Eye size={14} class="shrink-0 text-[var(--text-accent)]" />
							<p class="truncate text-sm font-semibold text-[var(--foreground)]">{selectedKey}</p>
							<span class="hidden truncate font-mono text-[10px] text-[var(--text-tertiary)] md:inline">{previewHref}</span>
						</div>
						<div class="flex shrink-0 items-center gap-1.5">
							<button onclick={copyLink} title="Copy preview URL" class="flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
								{#if copied}<Check size={11} class="text-[var(--status-live)]" />Copied{:else}<Copy size={11} />Copy{/if}
							</button>
							<button onclick={openInNewTab} title="Open in new tab" class="flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--foreground)]">
								<ExternalLink size={11} />Open
							</button>
						</div>
					</div>
					<div class="h-[78vh] bg-white">
						<iframe src={previewHref} title="Page preview" class="h-full w-full border-0"></iframe>
					</div>
				</div>
			{:else}
				<div class="flex h-[60vh] items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/50">
					<div class="text-center">
						<Eye size={42} class="mx-auto mb-3 text-[var(--text-tertiary)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Pick a template to preview</p>
						<p class="mt-1 text-xs text-[var(--muted-foreground)]">All 32 captured visitor pages render with full styling and assets</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
