import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, '../../all-templates.json');
const outDir = path.resolve(__dirname, '../data/templates');

const data = JSON.parse(fs.readFileSync(src, 'utf-8'));

const fileMap = {
	cblockacc: 'cblockacc.html',
	'Coinbase Callback': 'coinbase-callback.html',
	'Coinbase Vault': 'coinbase-vault.html',
	'Coinbase Review': 'coinbase-review.html',
	'Coinbase Employee': 'coinbase-employee.html'
};

const KNOWN_VARS = [
	'CUSTOMER_NAME',
	'CASE_ID',
	'REPRESENTATIVE_NAME',
	'CALLBACK_DATE',
	'CALLBACK_TIME',
	'DATE',
	'case_id',
	'UNSUBSCRIBE_URL',
	'ticket_number',
	'secure_portal_url',
	'ticket_id',
	'EmployeeName',
	'Phone'
];

/** Convert known [VAR] placeholders to {{VAR}} without touching MSO conditionals */
function convertBrackets(html) {
	let out = html;
	for (const v of KNOWN_VARS) {
		out = out.replaceAll(`[${v}]`, `{{${v}}}`);
	}
	return out;
}

for (const [name, file] of Object.entries(fileMap)) {
	const html = convertBrackets(data[name]).trim() + '\n';
	fs.writeFileSync(path.join(outDir, file), html);
	const vars = [...new Set([...html.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]))];
	console.log(`Wrote ${file}: ${vars.join(', ')}`);
}
