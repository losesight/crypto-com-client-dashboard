/**
 * Operator-only Ledger order checker API.
 *
 * POST  — accepts { pairs:[{email,orderRef}], threshold?, concurrency?, runs? },
 *         streams NDJSON events as each pair finishes, then a final summary
 *         line. Saves the batch to history.
 * GET   — lists the last N saved batches (summary only, no full results).
 */
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import {
	dbInsertOrderBatch,
	dbListOrderBatches
} from '$lib/server/database.js';
import {
	loadOrderCheckerConfig,
	parseOrderPairs,
	runOrderCheckBatch,
	type OrderPair,
	type OrderProbeResult
} from '$lib/server/orderChecker.js';

const MAX_PAIRS = 500;

function normalisePairs(input: unknown): OrderPair[] {
	if (typeof input === 'string') {
		return parseOrderPairs(input).pairs;
	}
	if (!Array.isArray(input)) return [];
	const out: OrderPair[] = [];
	for (const raw of input) {
		if (!raw || typeof raw !== 'object') continue;
		const email = String((raw as { email?: unknown }).email || '').trim();
		const orderRef = String((raw as { orderRef?: unknown }).orderRef || '').trim();
		if (email && orderRef) out.push({ email, orderRef });
	}
	return out;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
	const batches = dbListOrderBatches(limit);
	const config = loadOrderCheckerConfig();
	return json({
		batches: batches.map((b) => ({
			id: b.id,
			createdAt: b.createdAt,
			createdBy: b.createdBy,
			summary: b.summary
		})),
		config: {
			probeUrl: config.probeUrl,
			method: config.method,
			threshold: config.threshold,
			concurrency: config.concurrency,
			runs: config.runs,
			timeoutMs: config.timeoutMs,
			jitterMs: config.jitterMs
		}
	});
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const body = (await request.json().catch(() => ({}))) as {
		pairs?: unknown;
		threshold?: number;
		concurrency?: number;
		runs?: number;
		save?: boolean;
	};

	const pairs = normalisePairs(body.pairs).slice(0, MAX_PAIRS);
	if (pairs.length === 0) throw error(400, 'no valid pairs provided');

	const opts = {
		threshold: typeof body.threshold === 'number' ? body.threshold : undefined,
		concurrency: typeof body.concurrency === 'number' ? body.concurrency : undefined,
		runs: typeof body.runs === 'number' ? body.runs : undefined
	};

	const encoder = new TextEncoder();
	const username = locals.user.username;
	const shouldSave = body.save !== false;

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (payload: unknown) => {
				controller.enqueue(encoder.encode(JSON.stringify(payload) + '\n'));
			};

			send({ type: 'start', total: pairs.length, ...opts });

			const collected: OrderProbeResult[] = [];

			try {
				const { summary } = await runOrderCheckBatch(pairs, {
					...opts,
					onResult: (result) => {
						collected.push(result);
						send({ type: 'result', result });
					}
				});

				let batchId: string | undefined;
				if (shouldSave) {
					try {
						const saved = dbInsertOrderBatch({
							createdBy: username,
							summary,
							results: collected
						});
						batchId = saved.id;
					} catch (err) {
						send({
							type: 'warn',
							message: 'failed to save batch: ' + (err instanceof Error ? err.message : 'unknown')
						});
					}
				}

				send({ type: 'summary', summary, batchId });
			} catch (err) {
				send({
					type: 'error',
					message: err instanceof Error ? err.message : 'batch failed'
				});
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'cache-control': 'no-store',
			'x-accel-buffering': 'no'
		}
	});
};
