import crypto from 'node:crypto';
import {
	dbGetUserByUsername,
	dbGetUserById,
	verifyPassword,
	dbCreateSession,
	dbGetSession,
	dbDeleteSession,
	dbDeleteSessionsByUser,
	dbUpdateLastLogin,
	dbCleanExpiredSessions
} from './database.js';

export const SESSION_COOKIE = 'panel_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
	id: number;
	username: string;
	role: string;
}

export function login(username: string, password: string): { token: string; user: SessionUser } | null {
	const row = dbGetUserByUsername(username);
	if (!row || !row.active) return null;
	if (!verifyPassword(password, row.password_hash)) return null;

	const token = crypto.randomBytes(32).toString('hex');
	dbCreateSession(token, row.id, row.username, row.role, SESSION_TTL_MS);
	dbUpdateLastLogin(row.id);

	return {
		token,
		user: { id: row.id, username: row.username, role: row.role }
	};
}

export function getSessionUser(token: string | undefined): SessionUser | null {
	if (!token) return null;

	const session = dbGetSession(token);
	if (!session) return null;
	if (session.expires_at < Date.now()) {
		dbDeleteSession(token);
		return null;
	}

	const user = dbGetUserById(session.user_id);
	if (!user || !user.active) {
		dbDeleteSession(token);
		return null;
	}

	return {
		id: user.id,
		username: user.username,
		role: user.role
	};
}

export function logout(token: string): void {
	dbDeleteSession(token);
}

import { error } from '@sveltejs/kit';

export function requireAdmin(
	locals: App.Locals
): asserts locals is App.Locals & { user: SessionUser } {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (locals.user.role !== 'admin') throw error(403, 'Forbidden');
}

let lastCleanup = 0;
export function maybeCleanupSessions(): void {
	const now = Date.now();
	if (now - lastCleanup < 60 * 60 * 1000) return;
	lastCleanup = now;
	try {
		dbCleanExpiredSessions();
	} catch {
		// non-critical
	}
}
