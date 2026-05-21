<script lang="ts">
	import { getRedirectFields } from '$lib/templates';

	let {
		template = '',
		values = $bindable<Record<string, string>>({})
	}: {
		template?: string;
		values?: Record<string, string>;
	} = $props();

	const fields = $derived(getRedirectFields(template));
</script>

{#if fields.length > 0}
	<div class="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--input)]/20 p-3">
		<p class="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
			Page values
		</p>
		<p class="text-[11px] leading-snug text-[var(--muted-foreground)]">
			Set amounts, asset, and labels before redirecting. Values apply when the visitor lands on this page.
		</p>
		{#each fields as field}
			<div>
				<label class="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">{field.label}</label>
				{#if field.type === 'select' && field.options?.length}
					<select
						bind:value={values[field.key]}
						class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-primary)] focus:outline-none"
					>
						{#each field.options as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				{:else}
					<input
						type={field.type === 'number' ? 'number' : 'text'}
						placeholder={field.placeholder}
						bind:value={values[field.key]}
						class="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
					/>
				{/if}
			</div>
		{/each}
	</div>
{/if}
