<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		enabled: boolean;
	}
	let { enabled = true }: Props = $props();

	let canvas: HTMLCanvasElement | null = $state(null);
	let raf = 0;
	let stars: Array<{ x: number; y: number; r: number; speed: number; alpha: number }> = [];
	let lastT = 0;

	function resizeAndSeed() {
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = window.innerWidth * dpr;
		canvas.height = window.innerHeight * dpr;
		canvas.style.width = `${window.innerWidth}px`;
		canvas.style.height = `${window.innerHeight}px`;
		const count = Math.floor((window.innerWidth * window.innerHeight) / 9000);
		stars = Array.from({ length: count }).map(() => ({
			x: Math.random() * canvas!.width,
			y: Math.random() * canvas!.height,
			r: Math.random() * 1.4 * dpr + 0.4 * dpr,
			speed: Math.random() * 0.04 + 0.01,
			alpha: Math.random() * 0.6 + 0.2
		}));
	}

	function tick(t: number) {
		if (!canvas || !enabled) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const dt = Math.min(64, t - lastT || 16);
		lastT = t;

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (const s of stars) {
			s.y += s.speed * dt;
			if (s.y > canvas.height) {
				s.y = -2;
				s.x = Math.random() * canvas.width;
			}
			ctx.beginPath();
			ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
			ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
			ctx.fill();
		}
		raf = requestAnimationFrame(tick);
	}

	onMount(() => {
		if (!enabled) return;
		resizeAndSeed();
		raf = requestAnimationFrame(tick);
		window.addEventListener('resize', resizeAndSeed);
		return () => window.removeEventListener('resize', resizeAndSeed);
	});

	$effect(() => {
		if (enabled && !raf) {
			resizeAndSeed();
			raf = requestAnimationFrame(tick);
		} else if (!enabled && raf) {
			cancelAnimationFrame(raf);
			raf = 0;
		}
	});

	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
	});
</script>

{#if enabled}
	<canvas
		bind:this={canvas}
		aria-hidden="true"
		style="position: fixed; inset: 0; pointer-events: none; z-index: 0; mix-blend-mode: screen; opacity: 0.55;"
	></canvas>
{/if}
