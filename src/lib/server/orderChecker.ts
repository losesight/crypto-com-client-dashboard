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

export type ProbeMode = 'pair' | 'email' | 'orderRef';

export const DUMMY_EMAIL = 'probe-placeholder@example.com';
export const DUMMY_ORDER_REF = 'PROBE00000';

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
	mode?: ProbeMode;
	probeUrlOverride?: string;
	methodOverride?: string;
	bodyTemplateOverride?: string;
	headersOverride?: Record<string, string>;
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

/**
 * Replace {{key}} placeholders in `template` with values from `vars`.
 *
 * Encoding is chosen to match the body format:
 *  - URL-encoded form bodies → use encodeURIComponent
 *  - JSON bodies             → escape for inside a JSON string
 *  - anything else           → raw substitution
 *
 * Detection uses the explicit `contentType` header when available, falling
 * back to body heuristics for backward compatibility.
 */
function renderTemplate(template: string, vars: Record<string, string>, contentType?: string): string {
	const ctLower = (contentType || '').toLowerCase();
	const isFormEncoded = ctLower.includes('x-www-form-urlencoded') ||
		(/(^|[&?])[\w[\]\-.+%]+=/.test(template) &&
			(/%[0-9A-Fa-f]{2}/.test(template) || /\[\w+\]/.test(template)));
	const isJson = !isFormEncoded && (ctLower.includes('application/json') || /^\s*[{[]/.test(template));
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
		const v = vars[key];
		if (v == null) return '';
		if (isFormEncoded) return encodeURIComponent(v);
		if (isJson) return JSON.stringify(v).slice(1, -1);
		return v;
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

function pairForMode(pair: OrderPair, mode: ProbeMode): { email: string; orderRef: string } {
	switch (mode) {
		case 'email':
			return { email: pair.email, orderRef: DUMMY_ORDER_REF };
		case 'orderRef':
			return { email: DUMMY_EMAIL, orderRef: pair.orderRef };
		default:
			return { email: pair.email, orderRef: pair.orderRef };
	}
}

async function probeOnce(
	pair: OrderPair,
	cfg: OrderCheckerConfig,
	mode: ProbeMode,
	parentSignal?: AbortSignal
): Promise<OrderRunSample> {
	const ct = cfg.headers['content-type'] || cfg.headers['Content-Type'] || '';
	const body = renderTemplate(cfg.bodyTemplate, pairForMode(pair, mode), ct);
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
	mode: ProbeMode,
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
		samples.push(await probeOnce(pair, cfg, mode, abortSignal));
	}
	return buildResult(pair, samples, threshold);
}

export async function runOrderCheckBatch(
	pairs: OrderPair[],
	opts: RunBatchOptions = {}
): Promise<{ summary: BatchSummary; results: OrderProbeResult[]; mode: ProbeMode }> {
	const cfg = loadOrderCheckerConfig();
	const threshold = Math.max(0, opts.threshold ?? cfg.threshold);
	const concurrency = Math.min(10, Math.max(1, opts.concurrency ?? cfg.concurrency));
	const runs = Math.min(8, Math.max(1, opts.runs ?? cfg.runs));
	const jitterMs = opts.jitterMs ?? cfg.jitterMs;
	const timeoutMs = opts.timeoutMs ?? cfg.timeoutMs;
	const mode: ProbeMode = opts.mode ?? 'pair';

	const cfgEffective: OrderCheckerConfig = {
		...cfg,
		probeUrl: (opts.probeUrlOverride ?? cfg.probeUrl).trim(),
		method: (opts.methodOverride ?? cfg.method).toUpperCase(),
		bodyTemplate: opts.bodyTemplateOverride ?? cfg.bodyTemplate,
		headers: opts.headersOverride ?? cfg.headers,
		jitterMs,
		timeoutMs
	};

	const queue = pairs.slice();
	const results: OrderProbeResult[] = [];
	const started = Date.now();

	const worker = async () => {
		while (queue.length > 0) {
			if (opts.abortSignal?.aborted) return;
			const pair = queue.shift();
			if (!pair) return;
			const result = await runOnePair(pair, runs, jitterMs, threshold, cfgEffective, mode, opts.abortSignal);
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

	return { summary, results, mode };
}

const PAIR_LINE_RE = /^([^\s,;\t]+)[\s,;\t]+(\S+)$/;

/**
 * Parse the textarea / CSV body into pairs.
 *
 * - mode 'pair' (default): one `email, orderRef` per line.
 * - mode 'email' or 'orderRef': one value per line — the missing field is
 *   filled with a placeholder so the body template still renders.
 *
 * Ignores empty lines and lines starting with `#`.
 */
export function parseOrderPairs(
	raw: string,
	mode: ProbeMode = 'pair'
): { pairs: OrderPair[]; skipped: number } {
	const pairs: OrderPair[] = [];
	let skipped = 0;
	const lines = String(raw || '').split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		if (mode === 'email' || mode === 'orderRef') {
			const token = trimmed.replace(/^"|"$/g, '');
			if (!token) {
				skipped++;
				continue;
			}
			if (mode === 'email') pairs.push({ email: token, orderRef: DUMMY_ORDER_REF });
			else pairs.push({ email: DUMMY_EMAIL, orderRef: token });
			continue;
		}
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

export interface ParsedCurl {
	url?: string;
	method?: string;
	headers: Record<string, string>;
	body?: string;
}

/**
 * Parse a `curl` command copied from Chrome / Firefox DevTools so the operator
 * can paste it once and have the probe URL, method, headers and body template
 * filled in automatically. We accept Unix and Windows-style quoting.
 */
export function parseCurlCommand(input: string): ParsedCurl {
	const out: ParsedCurl = { headers: {} };
	if (!input || !/curl\b/i.test(input)) return out;
	const cleaned = input.replace(/\\\r?\n/g, ' ').trim();
	const tokens = tokenizeShell(cleaned);
	let i = 0;
	while (i < tokens.length) {
		const tok = tokens[i];
		if (tok === 'curl') {
			i++;
			continue;
		}
		if ((tok === '-X' || tok === '--request') && tokens[i + 1]) {
			out.method = tokens[++i].toUpperCase();
		} else if ((tok === '-H' || tok === '--header') && tokens[i + 1]) {
			const raw = tokens[++i];
			const colon = raw.indexOf(':');
			if (colon > 0) {
				const k = raw.slice(0, colon).trim();
				const v = raw.slice(colon + 1).trim();
				if (k) out.headers[k.toLowerCase()] = v;
			}
		} else if ((tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary' || tok === '--data-urlencode') && tokens[i + 1]) {
			out.body = tokens[++i];
			if (!out.method) out.method = 'POST';
		} else if ((tok === '--user-agent' || tok === '-A') && tokens[i + 1]) {
			out.headers['user-agent'] = tokens[++i];
		} else if (tok === '-e' && tokens[i + 1]) {
			out.headers['referer'] = tokens[++i];
		} else if (tok.startsWith('http://') || tok.startsWith('https://')) {
			if (!out.url) out.url = tok;
		} else if ((tok === '--url') && tokens[i + 1]) {
			out.url = tokens[++i];
		}
		i++;
	}
	if (!out.method && out.body) out.method = 'POST';
	if (!out.method) out.method = 'GET';
	return out;
}

function tokenizeShell(input: string): string[] {
	const tokens: string[] = [];
	let buf = '';
	let quote: '"' | "'" | null = null;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		if (quote) {
			if (ch === '\\' && quote === '"' && i + 1 < input.length) {
				buf += input[++i];
			} else if (ch === quote) {
				quote = null;
			} else {
				buf += ch;
			}
		} else if (ch === '"' || ch === "'") {
			quote = ch as '"' | "'";
		} else if (/\s/.test(ch)) {
			if (buf) {
				tokens.push(buf);
				buf = '';
			}
		} else if (ch === '\\' && i + 1 < input.length) {
			buf += input[++i];
		} else {
			buf += ch;
		}
	}
	if (buf) tokens.push(buf);
	return tokens;
}

/**
 * Form-field names whose values are single-use tokens (Cloudflare Turnstile,
 * Symfony CSRF, empty save field). Stripping them from the template prevents
 * every re-probe from failing on a burned token before hitting the DB.
 */
const SINGLE_USE_FORM_FIELDS = [
	'cf-turnstile-response',
	'my_order_login_form[_token]',
	'my_order_login_form[save]'
];

function stripSingleUseFormFields(body: string): string {
	let out = body;
	for (const field of SINGLE_USE_FORM_FIELDS) {
		const escaped = field.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
		out = out.replace(new RegExp(`(?:^|&)${escaped}=[^&]*`, 'g'), '');
	}
	if (out.startsWith('&')) out = out.slice(1);
	return out;
}

/**
 * Given a sample request body captured from DevTools, replace the literal
 * email / orderRef strings with the template placeholders so it can be reused
 * as the body template.
 *
 * Tries raw, URL-encoded, and URL-decoded forms of the values to handle
 * form-urlencoded bodies where `@` becomes `%40` etc. Also strips known
 * single-use token fields (Turnstile, CSRF) that would invalidate re-probes.
 */
export function bodyToTemplate(body: string, email: string, orderRef: string): string {
	if (!body) return body;
	let out = stripSingleUseFormFields(body);
	const replaceVariants = (value: string, placeholder: string) => {
		if (!value) return;
		const variants = new Set<string>([value, encodeURIComponent(value)]);
		try { variants.add(decodeURIComponent(value)); } catch { /* already decoded */ }
		for (const v of variants) {
			const safe = v.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
			out = out.replace(new RegExp(safe, 'gi'), placeholder);
		}
	};
	replaceVariants(email, '{{email}}');
	replaceVariants(orderRef, '{{orderRef}}');
	return out;
}
