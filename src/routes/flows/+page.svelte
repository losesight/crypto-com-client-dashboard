<script lang="ts">
	import { GitGraph, Plus, Trash2, ListPlus, X } from 'lucide-svelte';
	import { flows, sendMessage } from '$lib/stores/websocket';
	import { toast } from '$lib/stores/toast';
	import { templates } from '$lib/templates';

	function wsSend(type: string, payload: unknown) {
		if (!sendMessage(type, payload)) {
			toast.error('Not connected to server');
			return false;
		}
		return true;
	}

	/**
	 * Derive the brand / page catalog from the single source of truth in
	 * `$lib/templates`. Anything added to that registry (including future
	 * visitor templates) automatically becomes selectable here — no
	 * hardcoded copy of the catalog to drift out of sync.
	 */
	const flowPages: Record<string, string[]> = Object.fromEntries(
		Object.entries(templates).map(([brand, def]) => [brand, Object.keys(def.routes)])
	);
	const platforms = Object.keys(flowPages);

	const isValidFlowStep = (step: string) => /^[A-Z][^/]+\/.+/.test(step);

	let editingFlowId = $state<string | null>(null);
	let selectedPlatform = $state(platforms[0] ?? 'Coinbase');
	let selectedPage = $state('');

	let showCreateDialog = $state(false);
	let newFlowName = $state('');
	let newFlowDescription = $state('');

	let confirmDelete = $state<{ id: string; name: string } | null>(null);

	function handleEsc(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (confirmDelete) confirmDelete = null;
		else if (showCreateDialog) showCreateDialog = false;
	}

	function openCreateDialog() {
		newFlowName = '';
		newFlowDescription = '';
		showCreateDialog = true;
	}

	function createFlow() {
		const name = newFlowName.trim();
		if (!name) return;
		if (!wsSend('flow:create', {
			name,
			description: newFlowDescription.trim() || 'New flow',
			steps: [],
			active: true
		})) return;
		showCreateDialog = false;
	}

	function askDelete(id: string, name: string) {
		confirmDelete = { id, name };
	}

	function performDelete() {
		if (!confirmDelete) return;
		if (!wsSend('flow:delete', { id: confirmDelete.id })) return;
		confirmDelete = null;
	}

	function toggleEdit(flowId: string) {
		editingFlowId = editingFlowId === flowId ? null : flowId;
		selectedPage = '';
	}

	function addPageToFlow(flowId: string) {
		if (!selectedPage) return;
		const label = `${selectedPlatform}/${selectedPage}`;
		const flow = $flows.find((f) => f.id === flowId);
		if (flow && !flow.steps.includes(label)) {
			wsSend('flow:update', { ...flow, steps: [...flow.steps, label] });
		}
		selectedPage = '';
	}

	function removeStep(flowId: string, idx: number) {
		const flow = $flows.find((f) => f.id === flowId);
		if (!flow) return;
		const next = flow.steps.filter((_, i) => i !== idx);
		wsSend('flow:update', { ...flow, steps: next });
	}
</script>

<svelte:head>
	<title>Flows · Panel</title>
</svelte:head>

<svelte:window onkeydown={handleEsc} />

<div class="p-8 pt-5">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-[var(--foreground)]">Flows</h1>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">
				Manage page sequences visitors are funneled through
			</p>
		</div>
		<button
			onclick={openCreateDialog}
			class="btn-accent flex items-center gap-2 px-4 py-2.5 text-sm"
		>
			<Plus size={15} />
			New Flow
		</button>
	</div>

	<div class="space-y-3">
		{#if $flows.length === 0}
			<div class="flex flex-col items-center justify-center py-20 text-center">
				<GitGraph size={40} class="mb-3 text-[var(--text-tertiary)]" />
				<p class="text-sm font-semibold text-[var(--foreground)]">No flows yet</p>
				<p class="mt-1 text-xs text-[var(--muted-foreground)]">Create a flow to define page sequences for visitors.</p>
				<button
					onclick={openCreateDialog}
					class="btn-accent mt-4 flex items-center gap-2 px-4 py-2.5 text-sm"
				>
					<Plus size={15} />
					Create Flow
				</button>
			</div>
		{/if}
		{#each $flows as flow (flow.id)}
			<div class="animate-fade-slide-up glass-card glow-card p-5">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2.5">
							<GitGraph size={14} class="text-[var(--text-accent)]" />
						<h2 class="text-sm font-semibold text-[var(--foreground)]">{flow.name}</h2>
						<button
							onclick={() => wsSend('flow:update', { ...flow, active: !flow.active })}
							class="rounded-md border px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-soft {flow.active
								? 'border-[var(--status-live)]/30 bg-[var(--status-live)]/10 text-[var(--status-live)]'
								: 'border-[var(--border)] text-[var(--muted-foreground)]'}"
						>
							{flow.active ? 'Active' : 'Inactive'}
						</button>
						</div>
						<p class="mt-2 text-sm text-[var(--muted-foreground)]">{flow.description}</p>
						<div class="mt-3 flex flex-wrap gap-2">
							{#each flow.steps as step, i}
								<span
									class="group inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium {isValidFlowStep(step)
										? 'border-[var(--border)] bg-[var(--accent)]/30 text-[var(--muted-foreground)]'
										: 'border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-[var(--destructive)]'}"
									title={isValidFlowStep(step) ? undefined : 'Use Brand/Page format (e.g. Coinbase/Case ID)'}
								>
									<span class="text-[var(--text-tertiary)]">{i + 1}.</span>
									{step}
									<button
										onclick={() => removeStep(flow.id, i)}
										class="ml-1 rounded p-0.5 text-[var(--text-tertiary)] transition-soft hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
										aria-label={`Remove step ${step}`}
										title="Remove step"
									>
										<X size={10} />
									</button>
								</span>
							{/each}
						</div>
					</div>
					<div class="flex shrink-0 items-center gap-1">
						<button
							onclick={() => toggleEdit(flow.id)}
							class="rounded-lg p-2 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)] hover:text-[var(--text-accent)]"
							aria-label="Add page to flow"
							title="Add page"
						>
							<ListPlus size={14} />
						</button>
						<button
							onclick={() => askDelete(flow.id, flow.name)}
							class="rounded-lg p-2 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
							aria-label="Delete flow"
							title="Delete flow"
						>
							<Trash2 size={14} />
						</button>
					</div>
				</div>
				{#if editingFlowId === flow.id}
					<div class="mt-4 border-t border-[var(--border-subtle)] pt-4">
						<p class="mb-2.5 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
							Add Page to Flow
						</p>
						<div class="flex items-end gap-3">
							<div class="flex-1">
								<label
									class="mb-1.5 block text-[11px] text-[var(--text-tertiary)]"
									for="platform-{flow.id}">Platform</label
								>
								<select
									id="platform-{flow.id}"
									bind:value={selectedPlatform}
									onchange={() => (selectedPage = '')}
									class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
								>
								{#each platforms as platform}
									<option value={platform}>{platform}</option>
								{/each}
								</select>
							</div>
							<div class="flex-1">
								<label
									class="mb-1.5 block text-[11px] text-[var(--text-tertiary)]"
									for="page-{flow.id}">Page</label
								>
								<select
									id="page-{flow.id}"
									bind:value={selectedPage}
									class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
								>
									<option value="">Select page...</option>
									{#each flowPages[selectedPlatform] as pg}
										<option value={pg}>{pg}</option>
									{/each}
								</select>
							</div>
							<button
								onclick={() => addPageToFlow(flow.id)}
								disabled={!selectedPage}
								class="btn-accent flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
							>
								<Plus size={13} />
								Add
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

{#if showCreateDialog}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="create-flow-title"
		tabindex="-1"
		onclick={() => (showCreateDialog = false)}
		onkeydown={(e) => e.key === 'Escape' && (showCreateDialog = false)}
	>
		<div
			class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<h2 id="create-flow-title" class="text-base font-semibold text-[var(--foreground)]">New Flow</h2>
			<p class="mt-1 text-sm text-[var(--muted-foreground)]">
				Create a new page sequence. You can add pages after creating it.
			</p>
			<div class="mt-5 space-y-4">
				<div>
					<label
						for="new-flow-name"
						class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Name</label
					>
					<input
						id="new-flow-name"
						bind:value={newFlowName}
						type="text"
						placeholder="e.g. crypto/onboarding"
						class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
					/>
				</div>
				<div>
					<label
						for="new-flow-desc"
						class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Description</label
					>
					<input
						id="new-flow-desc"
						bind:value={newFlowDescription}
						type="text"
						placeholder="What does this flow do?"
						class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
					/>
				</div>
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<button
					onclick={() => (showCreateDialog = false)}
					class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]"
				>
					Cancel
				</button>
				<button
					onclick={createFlow}
					disabled={!newFlowName.trim()}
					class="btn-accent px-4 py-2 text-sm disabled:opacity-50"
				>
					Create Flow
				</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmDelete}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-delete-title"
		tabindex="-1"
		onclick={() => (confirmDelete = null)}
		onkeydown={(e) => e.key === 'Escape' && (confirmDelete = null)}
	>
		<div
			class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<h2 id="confirm-delete-title" class="text-base font-semibold text-[var(--foreground)]">
				Delete flow?
			</h2>
			<p class="mt-2 text-sm text-[var(--muted-foreground)]">
				This will permanently delete <span class="font-mono text-[var(--foreground)]">{confirmDelete.name}</span>.
				This cannot be undone.
			</p>
			<div class="mt-6 flex justify-end gap-2">
				<button
					onclick={() => (confirmDelete = null)}
					class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]"
				>
					Cancel
				</button>
				<button
					onclick={performDelete}
					class="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-white transition-soft hover:opacity-90"
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}
