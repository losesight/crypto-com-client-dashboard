<script lang="ts">
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Starfield from '$lib/components/Starfield.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import { connectWebSocket, disconnectWebSocket } from '$lib/stores/websocket';
	import { initAudio, setAudioEnabled } from '$lib/stores/audio';
	import {
		loadAppearance,
		applyTheme,
		applyZoom,
		applyFont,
		themeId,
		starfieldEnabled,
		panelZoom,
		displayFont
	} from '$lib/stores/appearance';
	import {
		loadVisitorSettings,
		visitorSettings,
		audioToastEnabled
	} from '$lib/stores/visitorSettings';

	let { children } = $props();

	let isFullscreenRoute = $derived(
		$page.url.pathname.startsWith('/login') || $page.url.pathname.startsWith('/signup')
	);

	onMount(() => {
		loadAppearance();
		applyTheme($themeId);
		applyZoom($panelZoom);
		applyFont($displayFont);
		initAudio();
		loadVisitorSettings();
	});

	$effect(() => {
		if ($page.data.user) {
			connectWebSocket();
		}
	});

	$effect(() => applyTheme($themeId));
	$effect(() => applyZoom($panelZoom));
	$effect(() => applyFont($displayFont));
	$effect(() => setAudioEnabled($audioToastEnabled));

	onDestroy(() => {
		disconnectWebSocket();
	});
</script>

<svelte:head>
	<title>Panel</title>
</svelte:head>

<Starfield enabled={$starfieldEnabled} />

{#if isFullscreenRoute}
	{@render children()}
{:else}
	<div class="relative z-10 flex h-screen w-full bg-[var(--background)]">
		<Sidebar />
		<main class="relative flex-1 overflow-hidden">
			<div class="h-full overflow-auto">
				{@render children()}
			</div>
		</main>
	</div>
{/if}

<ToastContainer />
