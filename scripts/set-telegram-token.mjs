import Database from 'better-sqlite3';
import path from 'node:path';

const token = process.env.TG_BOT_TOKEN?.trim();
if (!token) {
	console.error('Usage: TG_BOT_TOKEN=your_token node scripts/set-telegram-token.mjs');
	process.exit(1);
}

const db = new Database(path.join(process.cwd(), 'data', 'dashboard.db'));
const upsert = db.prepare(
	`INSERT INTO server_settings (key, value) VALUES (?, ?)
	 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
);
upsert.run('telegram.bot_token', token);
upsert.run('telegram.enabled', '1');
db.close();
console.log('Telegram bot token saved. Set chat ID in Settings → Telegram.');
