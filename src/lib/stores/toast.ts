import { writable } from 'svelte/store';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
	id: number;
	message: string;
	variant: ToastVariant;
	duration: number;
}

let nextId = 1;

export const toasts = writable<Toast[]>([]);

export function pushToast(message: string, variant: ToastVariant = 'info', duration = 2200): number {
	const id = nextId++;
	toasts.update((list) => [...list, { id, message, variant, duration }]);
	if (duration > 0) {
		setTimeout(() => dismissToast(id), duration);
	}
	return id;
}

export function dismissToast(id: number): void {
	toasts.update((list) => list.filter((t) => t.id !== id));
}

export const toast = {
	success: (m: string, d?: number) => pushToast(m, 'success', d),
	error: (m: string, d?: number) => pushToast(m, 'error', d ?? 4000),
	info: (m: string, d?: number) => pushToast(m, 'info', d),
	warning: (m: string, d?: number) => pushToast(m, 'warning', d ?? 3500)
};
