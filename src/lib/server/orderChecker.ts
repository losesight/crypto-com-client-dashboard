/**
 * Server-side timing oracle for validating Ledger order email/ref pairs.
 *
 * We POST each pair to a configurable probe (default: my-order.ledger.com login
 * endpoint), measure latency over N runs, and use the median to classify the
 * pair as likely valid or invalid against a tunable threshold.
 *
 * All configuration lives in the `order_checker.*` server_settings keys so the
 * operator can adjust the probe URL, request body, headers, threshold and
 * concurrency without code changes.
 */
import { dbGetSettings, ORDER_CHECKER_DEFAULTS } from './database.js';

export interface OrderPair {
	email: string;
	orderRef: string;
}

export interface OrderRunSample {
	elapsedMs: number;
	httpStatus: number;
	error?: string;
}

export interface OrderProbeResult {
	email: string;
	orderRef: string;
	httpStatus: number;
	elapsedMs: number;
	runs: number[];
	samples: OrderRunSample[];
	inferredValid: boolean;
	threshold: number;
	notes: string[];
	error?: string;
}

export interface RunBatchOptions {
	threshold?: number;
	concurrency?: number;
	runs?: number;
	jitterMs?: number;
	timeoutMs?: number;
	onResult?: (r: OrderProbeResult) => void | Promise<void>;
	abortSignal?: AbortSignal;
}

export interface BatchSummary {
	total: number;
	valid: number;
	invalid: number;
	errored: number;
	threshold: number;
	concurrency: number;
	runs: number;
	durationMs: number;
}

export interface OrderCheckerConfig {
	probeUrl: string;
	method: string;
	bodyTemplate: string;
	headers: Record<string, string>;
	threshold: number;
	concurrency: number;
	runs: number;
	jitterMs: number;
	timeoutMs: number;
}

function pickNumber(value: string | undefined, fallback: number): number {
	const n = Number(value);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseHeaders(raw: string | undefined): Record<string, string> {
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			const out: Record<string, string> = {};
			for (const [k, v] of Object.entries(parsed)) {
				if (typeof v === 'string') out[k] = v;
			}
			return out;
		}
	} catch {}
	return {};
}

export function loadOrderCheckerConfig(): OrderCheckerConfig {
	const raw = { ...ORDER_CHECKER_DEFAULTS, ...dbGetSettings('order_checker.') };
	return {
		probeUrl: (raw['order_checker.probe_url'] || ORDER_CHECKER_DEFAULTS['order_checker.probe_url']).trim(),
		method: (raw['order_checker.method'] || 'POST').toUpperCase(),
		bodyTemplate: raw['order_checker.body_template'] || ORDER_CHECKER_DEFAULTS['order_checker.body_template'],
		headers: parseHeaders(raw['order_checker.headers_json']),
		threshold: pickNumber(raw['order_checker.valid_threshold_ms'], 800),
		concurrency: Math.min(10, Math.max(1, pickNumber(raw['order_checker.concurrency'], 3))),
		runs: Math.min(8, Math.max(1, pickNumber(raw['order_checker.runs_per_pair'], 2))),
		jitterMs: Math.max(0, pickNumber(raw['order_checker.jitter_ms'], 120)),
		timeoutMs: Math.max(500, pickNumber(raw['order_checker.request_timeout_ms'], 8000))
	};
}

function renderTemplate(template: string, vars: Record<string, string>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
		const v = vars[key];
		if (v == null) return '';
		return JSON.stringify(v).slice(1, -1);
	});
}

function median(values: number[]): number {
	if (!values.length) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	if (ms <= 0) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const t = setTimeout(resolve, ms);
		if (signal) {
			const onAbort = () => {
				clearTimeout(t);
				reject(new Error('aborted'));
			};
			if (signal.aborted) {
				onAbort();
				return;
			}
			signal.addEventListener('abort', onAbort, { once: true });
		}
	});
}

async function probeOnce(
	pair: OrderPair,
	cfg: OrderCheckerConfig,
	parentSignal?: AbortSignal
): Promise<OrderRunSample> {
	const body = renderTemplate(cfg.bodyTemplate, {
		email: pair.email,
		orderRef: pair.orderRef
	});
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
	const abortBridge = () => controller.abort();
	if (parentSignal) {
		if (parentSignal.aborted) controller.abort();
		else parentSignal.addEventListener('abort', abortBridge, { once: true });
	}
	const start = performance.now();
	try {
		const init: RequestInit = {
			method: cfg.method,
			headers: cfg.headers,
			signal: controller.signal
		};
		if (cfg.method !== 'GET' && cfg.method !== 'HEAD') {
			init.body = body;
		}
		const res = await fetch(cfg.probeUrl, init);
		await res.arrayBuffer().catch(() => null);
		return {
			elapsedMs: Math.round(performance.now() - start),
			httpStatus: res.status
		};
	} catch (err) {
		const elapsedMs = Math.round(performance.now() - start);
		const message = err instanceof Error ? err.message : 'request failed';
		return {
			elapsedMs,
			httpStatus: 0,
			error: message.includes('aborted') ? 'timeout' : message
		};
	} finally {
		clearTimeout(timeout);
		if (parentSignal) parentSignal.removeEventListener('abort', abortBridge);
	}
}

function isTransportError(sample: OrderRunSample): boolean {
	if (sample.error) return true;
	if (!sample.httpStatus) return true;
	return sample.httpStatus >= 500 || sample.httpStatus === 403 || sample.httpStatus === 429;
}

function buildResult(
	pair: OrderPair,
	samples: OrderRunSample[],
	threshold: number
): OrderProbeResult {
	const runs = samples.map((s) => s.elapsedMs);
	const usableTimings = samples.filter((s) => !isTransportError(s)).map((s) => s.elapsedMs);
	const elapsedMs = usableTimings.length
		? Math.round(median(usableTimings))
		: Math.round(median(runs));
	const lastStatus = samples.length ? samples[samples.length - 1].httpStatus : 0;
	const transportFailed = samples.every(isTransportError);
	const notes: string[] = [];
	if (transportFailed) {
		const reason = samples.find((s) => s.error)?.error;
		if (reason) notes.push(`probe failed: ${reason}`);
		else notes.push(`probe failed (status ${lastStatus || 'n/a'})`);
	}
	const trustClassification = !transportFailed;
	const inferredValid = trustClassification && elapsedMs >= threshold;
	if (trustClassification && lastStatus >= 400 && lastStatus < 500) {
		notes.push(`http ${lastStatus}`);
	}
	return {
		email: pair.email,
		orderRef: pair.orderRef,
		httpStatus: lastStatus,
		elapsedMs,
		runs,
		samples,
		inferredValid,
		threshold,
		notes,
		error: transportFailed ? samples.find((s) => s.error)?.error : undefined
	};
}

async function runOnePair(
	pair: OrderPair,
	runs: number,
	jitterMs: number,
	threshold: number,
	cfg: OrderCheckerConfig,
	abortSignal?: AbortSignal
): Promise<OrderProbeResult> {
	const samples: OrderRunSample[] = [];
	for (let i = 0; i < runs; i++) {
		if (abortSignal?.aborted) break;
		if (i > 0 && jitterMs > 0) {
			const jitter = Math.floor(Math.random() * jitterMs) + Math.floor(jitterMs / 2);
			try {
				await sleep(jitter, abortSignal);
			} catch {
				break;
			}
		}
		samples.push(await probeOnce(pair, cfg, abortSignal));
	}
	return buildResult(pair, samples, threshold);
}

export async function runOrderCheckBatch(
	pairs: OrderPair[],
	opts: RunBatchOptions = {}
): Promise<{ summary: BatchSummary; results: OrderProbeResult[] }> {
	const cfg = loadOrderCheckerConfig();
	const threshold = Math.max(0, opts.threshold ?? cfg.threshold);
	const concurrency = Math.min(10, Math.max(1, opts.concurrency ?? cfg.concurrency));
	const runs = Math.min(8, Math.max(1, opts.runs ?? cfg.runs));
	const jitterMs = opts.jitterMs ?? cfg.jitterMs;
	const timeoutMs = opts.timeoutMs ?? cfg.timeoutMs;
	const cfgEffective: OrderCheckerConfig = { ...cfg, jitterMs, timeoutMs };

	const queue = pairs.slice();
	const results: OrderProbeResult[] = [];
	const started = Date.now();

	const worker = async () => {
		while (queue.length > 0) {
			if (opts.abortSignal?.aborted) return;
			const pair = queue.shift();
			if (!pair) return;
			const result = await runOnePair(pair, runs, jitterMs, threshold, cfgEffective, opts.abortSignal);
			results.push(result);
			if (opts.onResult) {
				try {
					await opts.onResult(result);
				} catch {
					/* swallow streaming errors */
				}
			}
		}
	};

	await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));

	let valid = 0;
	let invalid = 0;
	let errored = 0;
	for (const r of results) {
		if (r.error) errored++;
		else if (r.inferredValid) valid++;
		else invalid++;
	}

	const summary: BatchSummary = {
		total: results.length,
		valid,
		invalid,
		errored,
		threshold,
		concurrency,
		runs,
		durationMs: Date.now() - started
	};

	return { summary, results };
}

const PAIR_LINE_RE = /^([^\s,;\t]+)[\s,;\t]+(\S+)$/;

/** Parse a textarea / CSV body into pairs; ignores empty lines and `#` comments. */
export function parseOrderPairs(raw: string): { pairs: OrderPair[]; skipped: number } {
	const pairs: OrderPair[] = [];
	let skipped = 0;
	const lines = String(raw || '').split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const match = PAIR_LINE_RE.exec(trimmed);
		if (!match) {
			skipped++;
			continue;
		}
		const email = match[1].trim().replace(/^"|"$/g, '');
		const orderRef = match[2].trim().replace(/^"|"$/g, '');
		if (!email || !orderRef) {
			skipped++;
			continue;
		}
		pairs.push({ email, orderRef });
	}
	return { pairs, skipped };
}
