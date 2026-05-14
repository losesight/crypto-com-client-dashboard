<script lang="ts">
	import { UsersRound, Circle, Send, ArrowRight, Eye, MonitorSmartphone } from 'lucide-svelte';
	import { visitors, flows, sendMessage } from '$lib/stores/websocket';

	let selectedVisitor: string | null = $state(null);
	let targetFlow = $state('crypto/loading');

	function pushVisitor() {
		if (!selectedVisitor) return;
		sendMessage('visitor:push', { ip: selectedVisitor, targetFlow });
	}
</script>

<svelte:head>
	<title>Control · Panel</title>
</svelte:head>

<div class="p-8 pt-5">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-[var(--foreground)]">
			Control
		</h1>
		<p class="mt-1 text-sm text-[var(--muted-foreground)]">
			Real-time visitor interaction and flow management
		</p>
	</div>

	<div class="grid gap-6 xl:grid-cols-12">
		<div class="xl:col-span-7">
			<div
				class="animate-fade-slide-up transition-panel rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden"
				style="box-shadow: var(--shadow-sm);"
			>
				<div class="border-b border-[var(--border)] px-5 py-3.5 bg-[var(--card)]">
					<div class="flex items-center gap-2.5">
						<UsersRound size={15} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Active Visitors</p>
						<span class="ml-auto rounded-lg bg-[var(--accent-primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--text-accent)]">
							{$visitors.length}
						</span>
					</div>
				</div>

				<div class="max-h-[600px] overflow-y-auto custom-scrollbar">
					{#each $visitors as visitor (visitor.ip)}
						<button
							class="transition-soft-no-bg w-full text-left border-b border-[var(--border-subtle)] p-4 px-5 hover:bg-[var(--accent)]/40 {selectedVisitor === visitor.ip ? 'bg-[var(--accent-primary)]/8 border-l-[3px] border-l-[var(--accent-primary)]' : ''}"
							onclick={() => (selectedVisitor = visitor.ip)}
						>
							<div class="flex items-start gap-3">
								<div class="text-xl leading-none">{visitor.flag}</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<p class="text-sm font-semibold font-mono text-[var(--foreground)]">{visitor.ip}</p>
										<div class="relative">
											<Circle
												size={8}
												class="shrink-0 {visitor.status === 'online'
													? 'text-[var(--status-live)] fill-[var(--status-live)]'
													: 'text-[var(--muted-foreground)] fill-[var(--muted-foreground)]'}"
											/>
										</div>
									</div>
									<p class="mt-1 text-xs text-[var(--muted-foreground)]">{visitor.city}, {visitor.country}</p>
									<div class="mt-2 flex items-center gap-2">
										<span class="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--accent)]/30 px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">
											{visitor.flow}
										</span>
										<span class="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
											<MonitorSmartphone size={10} />
											{visitor.device}
										</span>
									</div>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<div class="xl:col-span-5">
			<div
				class="animate-fade-slide-up transition-panel rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden"
				style="animation-delay: 60ms; box-shadow: var(--shadow-sm);"
			>
				<div class="border-b border-[var(--border)] px-5 py-3.5 bg-[var(--card)]">
					<div class="flex items-center gap-2.5">
						<Send size={15} class="text-[var(--text-accent)]" />
						<p class="text-sm font-semibold text-[var(--foreground)]">Push to Flow</p>
					</div>
				</div>

				<div class="p-5 space-y-5">
					{#if selectedVisitor}
						<div>
							<label class="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
								Target Visitor
							</label>
							<div class="rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm font-mono text-[var(--foreground)]">
								{selectedVisitor}
							</div>
						</div>

						<div>
							<label class="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
								Target Flow
							</label>
							<select
								bind:value={targetFlow}
								class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
							>
								{#each $flows as flow}
									<option value={flow.name}>{flow.name}</option>
								{/each}
							</select>
						</div>

						<button
							onclick={pushVisitor}
							class="btn-accent flex w-full items-center justify-center gap-2 px-4 py-3 text-sm"
						>
							<ArrowRight size={15} />
							Push Visitor
						</button>
					{:else}
						<div class="flex flex-col items-center justify-center py-14 text-center">
							<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10">
								<Eye size={24} class="text-[var(--text-accent)]/40" />
							</div>
							<p class="text-sm text-[var(--muted-foreground)]">
								Select a visitor to control their flow
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
