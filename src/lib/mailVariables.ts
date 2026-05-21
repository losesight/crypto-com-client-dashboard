import { applyLiveDatesToHtml, mergeAutoDateVariables } from '$lib/dateVars.js';

/** Patterns: {{var}}, [var], [[var]] */
const VARIABLE_PATTERNS = [
	/\{\{\s*([^{}]+?)\s*\}\}/g,
	/\[\[\s*([^\[\]]+?)\s*\]\]/g,
	/\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*\]/g
];

/** MSO / HTML bracket tokens that are not template variables */
const BRACKET_IGNORE = new Set(['if', 'endif', 'mso', 'CDATA']);

function normalizeToken(name: string): string {
	return name.trim();
}

function formatVariable(name: string): string {
	return `{{${normalizeToken(name)}}}`;
}

/** Extract unique template variables from HTML (returns {{name}} tokens) */
export function extractTemplateVariables(html: string): string[] {
	const found = new Set<string>();
	for (const re of VARIABLE_PATTERNS) {
		re.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(html)) !== null) {
			const name = normalizeToken(m[1]);
			if (!name || BRACKET_IGNORE.has(name.toLowerCase())) continue;
			found.add(formatVariable(name));
		}
	}
	return [...found];
}

/** Human-readable label for a variable token */
export function variableLabel(token: string): string {
	return token
		.replace(/^\{\{\s*/, '')
		.replace(/\s*\}\}$/, '')
		.replace(/^\[\[\s*/, '')
		.replace(/\s*\]\]$/, '')
		.replace(/^\[\s*/, '')
		.replace(/\s*\]$/, '')
		.trim();
}

/** Replace all variable patterns in HTML/subject with provided values */
export function replaceTemplateVariables(
	html: string,
	values: Record<string, string>
): string {
	let result = html;
	const merged = mergeAutoDateVariables(values);
	for (const [token, rawValue] of Object.entries(merged)) {
		const value = rawValue ?? '';
		const name = variableLabel(token);
		if (!name) continue;

		result = result.replaceAll(token, value);
		result = result.replaceAll(`{{${name}}}`, value);
		result = result.replaceAll(`[[${name}]]`, value);
		result = result.replaceAll(`[${name}]`, value);
	}
	return applyLiveDatesToHtml(result);
}
