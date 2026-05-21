/**
 * Live date/time values for mail templates ({{DATE}}) and visitor pages (data-rv-var).
 */
export function buildLiveDateVars(now = new Date()): Record<string, string> {
	const year = String(now.getFullYear());
	const date = now.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
	const dateLong = now.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
	const time = now.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		timeZoneName: 'short'
	});
	const dateTime = now.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZoneName: 'short'
	});
	const callbackTime = now.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});

	return {
		'{{DATE}}': date,
		'{{CALLBACK_DATE}}': dateLong,
		'{{CALLBACK_TIME}}': callbackTime,
		'{{CURRENT_YEAR}}': year,
		date,
		dateLong,
		dateTime,
		time,
		currentYear: year,
		callbackDate: dateLong,
		callbackTime
	};
}

/** Mail template tokens filled automatically unless the operator overrides them. */
export const AUTO_MAIL_DATE_TOKENS = new Set([
	'{{DATE}}',
	'{{CALLBACK_DATE}}',
	'{{CALLBACK_TIME}}',
	'{{CURRENT_YEAR}}'
]);

export function isAutoDateMailToken(token: string): boolean {
	const t = token.trim();
	return AUTO_MAIL_DATE_TOKENS.has(t);
}

/** Merge auto date values; explicit non-empty operator values win. */
export function mergeAutoDateVariables(values: Record<string, string> = {}): Record<string, string> {
	const auto = buildLiveDateVars();
	const out = { ...auto };
	for (const [key, val] of Object.entries(values)) {
		if (val != null && String(val).trim() !== '') out[key] = val;
	}
	return out;
}

/** Replace {{DATE}} tokens and © Coinbase 20xx footers in static HTML. */
export function applyLiveDatesToHtml(html: string, now = new Date()): string {
	const vars = buildLiveDateVars(now);
	let out = html;
	for (const [token, value] of Object.entries(vars)) {
		if (!token.startsWith('{{')) continue;
		out = out.split(token).join(value);
	}
	const year = vars.currentYear;
	out = out.replace(/© Coinbase 20\d{2}/g, `© Coinbase ${year}`);
	return out;
}
