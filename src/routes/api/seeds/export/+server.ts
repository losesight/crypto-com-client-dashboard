import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { dbQuerySeeds } from '$lib/server/database.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';
	const { rows } = dbQuerySeeds({ page: 1, limit: 100000, sort: 'created_at', dir: 'desc' });

	if (format === 'json') {
		return new Response(JSON.stringify(rows, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': 'attachment; filename="seeds.json"'
			}
		});
	}

	const header = ['id', 'visitor_ip', 'flow', 'phrase', 'captured_by', 'created_at'].join(',');
	const escape = (v: any) => {
		const s = (v ?? '').toString().replace(/"/g, '""');
		return /[",\n]/.test(s) ? `"${s}"` : s;
	};
	const body = rows
		.map((r) =>
			[r.id, r.visitorIp, r.flow, r.phrase, r.capturedBy, new Date(r.createdAt).toISOString()]
				.map(escape)
				.join(',')
		)
		.join('\n');
	return new Response(`${header}\n${body}\n`, {
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': 'attachment; filename="seeds.csv"'
		}
	});
};
