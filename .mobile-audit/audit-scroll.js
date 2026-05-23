// Snippet evaluated in-page after navigation to each template.
// Returns: viewport sizing, body/wrapper overflow info, and an attempt to
// measure how far you can scroll on the page or on the inner fixed wrapper.
() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Test 1: scroll the document. Many templates put their content inside a
  // `position:fixed` wrapper so window.scroll never moves.
  window.scrollTo(0, 0);
  const startWin = window.scrollY;
  window.scrollTo(0, 99999);
  const endWin = window.scrollY;
  const winScrollRange = endWin - startWin;

  // Test 2: find every scrollable inner element (the fixed wrapper trick).
  // Returns the deepest one with overflow + measurable scrollHeight > clientHeight.
  function findScrollable() {
    const els = Array.from(document.querySelectorAll('*'));
    const candidates = els.filter(el => {
      const cs = getComputedStyle(el);
      const overflowY = cs.overflowY;
      const scrolls = overflowY === 'auto' || overflowY === 'scroll';
      return scrolls && el.scrollHeight > el.clientHeight + 1;
    });
    return candidates.map(el => ({
      tag: el.tagName.toLowerCase(),
      className: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
      position: getComputedStyle(el).position,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflowable: el.scrollHeight - el.clientHeight
    }));
  }
  const innerScrollables = findScrollable();

  // Test 3: detect if there is any content below the fold that is unreachable.
  // Approach: find the bottom-most element with text/buttons and check whether
  // its bounding-rect is visible after scrolling everything possible.
  // First, scroll any inner scrollable to bottom.
  const innerEls = Array.from(document.querySelectorAll('*')).filter(el => {
    const cs = getComputedStyle(el);
    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll')
      && el.scrollHeight > el.clientHeight + 1;
  });
  innerEls.forEach(el => { el.scrollTop = el.scrollHeight; });
  window.scrollTo(0, 99999);

  // Now find the bottom-most interactive element (button/a/input) and see if
  // its bottom is within the viewport.
  const interactive = Array.from(document.querySelectorAll('button, a, input, textarea, select'));
  let lowestBottom = -Infinity;
  let lowestEl = null;
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.width === 0) continue; // hidden
    if (r.bottom > lowestBottom) {
      lowestBottom = r.bottom;
      lowestEl = el;
    }
  }
  const lowestVisible = lowestBottom <= vh + 4;

  // Also report document body sizing for diagnostics.
  const body = document.body;
  const html = document.documentElement;
  const docHeight = Math.max(body.scrollHeight, body.offsetHeight,
                             html.clientHeight, html.scrollHeight, html.offsetHeight);

  return {
    vw, vh,
    docHeight,
    winScrollRange,
    bodyScrollable: docHeight > vh + 4,
    innerScrollables,
    lowestBottom: Math.round(lowestBottom),
    lowestVisible,
    lowestElText: lowestEl ? (lowestEl.textContent || lowestEl.value || lowestEl.placeholder || '').trim().slice(0, 60) : null
  };
}
