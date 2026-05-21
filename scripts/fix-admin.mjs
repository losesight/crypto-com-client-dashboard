import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';

const dbPath = process.argv[2] || path.join(process.cwd(), 'data', 'dashboard.db');

function hashPassword(password) {
	const salt = crypto.randomBytes(16).toString('hex');
	const derived = crypto.scryptSync(password, salt, 64).toString('hex');
	return `scrypt$${salt}$${derived}`;
}

const db = new Database(dbPath);
const username = 'apollo';
const password = 'apollo123';
const hash = hashPassword(password);
const created = new Date().toLocaleDateString('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric'
});

db.prepare(
	`INSERT INTO user_accounts (username, password_hash, role, created_at, active)
	 VALUES (?, ?, 'admin', ?, 1)
	 ON CONFLICT(username) DO UPDATE SET
	   password_hash = excluded.password_hash,
	   role = 'admin',
	   active = 1`
).run(username, hash, created);

console.log(`Updated ${dbPath}: login with ${username} / ${password}`);
db.close();
