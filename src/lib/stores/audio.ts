let connectSound: HTMLAudioElement | null = null;
let disconnectSound: HTMLAudioElement | null = null;
let alertSound: HTMLAudioElement | null = null;
let enabled = true;

export function initAudio(): void {
	if (typeof window === 'undefined') return;
	connectSound = new Audio('/assets/sounds/connect.mp3');
	disconnectSound = new Audio('/assets/sounds/disconnect.mp3');
	alertSound = new Audio('/assets/sounds/alert.mp3');
	connectSound.preload = 'auto';
	disconnectSound.preload = 'auto';
	alertSound.preload = 'auto';
}

export function setAudioEnabled(value: boolean): void {
	enabled = value;
}

function play(audio: HTMLAudioElement | null): void {
	if (!enabled || !audio) return;
	audio.currentTime = 0;
	audio.play().catch(() => {
		// Browser may block autoplay until user interaction
	});
}

export function playConnect(): void {
	play(connectSound);
}

export function playDisconnect(): void {
	play(disconnectSound);
}

export function playAlert(): void {
	play(alertSound);
}
