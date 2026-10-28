/* Two-section scrolling with one transition per wheel gesture. */
document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.querySelector('.featured-wrap');
  if (!wrap) return;
  const content = wrap.querySelector('.featured-content');
  const section = wrap.querySelector('.featured');
  const intro = section.querySelector('.intro');
  const header = document.querySelector('.site-header');
  // Keep desktop page transitions available in shorter browser windows too.
  const enabled = matchMedia('(min-width: 769px)');
  let transitionFrame = 0;
  let animating = false;
  let pageIndex = 0;
  let lastViewport = '';
  let wasEnabled = false;
  let settleTimer = 0;
  let gestureTimer = 0;
  let wheelTotal = 0;
  let gestureConsumed = false;

  function stops() {
    const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    return [0, Math.max(0, Math.min(maximum, wrap.getBoundingClientRect().top + scrollY - header.offsetHeight))];
  }
  function nearestPage() {
    return scrollY > stops()[1] / 2 ? 1 : 0;
  }
  function cancelTransition() {
    cancelAnimationFrame(transitionFrame);
    clearTimeout(settleTimer);
    transitionFrame = 0;
    animating = false;
  }
  function goTo(index, smooth = true) {
    if (!enabled.matches) return;
    cancelTransition();
    pageIndex = Math.max(0, Math.min(1, index));
    const destination = stops()[pageIndex];
    const origin = scrollY;
    const distance = destination - origin;
    if (!smooth || Math.abs(distance) < 1) {
      scrollTo({ top: destination, behavior: 'instant' });
      return;
    }
    animating = true;
    const started = performance.now();
    function step(now) {
      const progress = Math.min(1, (now - started) / 800);
      const eased = 1 - Math.pow(1 - progress, 4);
      scrollTo({ top: origin + distance * eased, behavior: 'instant' });
      if (progress < 1) transitionFrame = requestAnimationFrame(step);
      else {
        animating = false;
        transitionFrame = 0;
      }
    }
    transitionFrame = requestAnimationFrame(step);
  }
  function measure() {
    document.body.classList.toggle('home-stage-active', enabled.matches);
    if (!enabled.matches) {
      content.style.removeProperty('--featured-scale');
      wrap.style.removeProperty('--featured-artwork-height');
      section.style.removeProperty('--featured-top-shift');
      cancelTransition();
      clearTimeout(gestureTimer);
      wheelTotal = 0;
      gestureConsumed = false;
      wasEnabled = false;
      return;
    }
    const headerHeight = header.offsetHeight;
    document.documentElement.style.setProperty('--home-stage-header', `${headerHeight}px`);
    section.style.removeProperty('--featured-top-shift');
    const availableHeight = section.clientHeight;
    const layout = getComputedStyle(section);
    const topSpace = parseFloat(layout.paddingTop);
    const bottomSpace = parseFloat(layout.paddingBottom);
    const gap = parseFloat(layout.rowGap);
    const artworkSpace = availableHeight - topSpace - bottomSpace - gap - intro.offsetHeight;
    // The former one-row controls occupied 48px. Preserve that baseline so the
    // new stacked controls do not cancel the requested 10% overall enlargement.
    const controls = content.querySelector('.featured-carousel-controls');
    const baselineHeight = content.offsetHeight - (controls ? controls.offsetHeight - 48 : 0);
    const baselineScale = Math.min(document.documentElement.clientWidth * .94 / content.offsetWidth,
      Math.max(1, artworkSpace) / baselineHeight);
    const minimumTopSpace = 16;
    const fittingScale = Math.max(1, availableHeight - minimumTopSpace - bottomSpace - gap - intro.offsetHeight)
      / content.offsetHeight;
    const maxScale = Math.min(baselineScale * 1.1,
      (document.documentElement.clientWidth - 32) / content.offsetWidth, fittingScale);
    const artworkHeight = content.offsetHeight * maxScale;
    // Reclaim the empty space above while keeping the entire introduction in view.
    const requiredHeight = artworkHeight + topSpace + bottomSpace + gap + intro.offsetHeight;
    const topShift = Math.min(Math.max(0, topSpace - minimumTopSpace), Math.max(0, requiredHeight - availableHeight));
    section.style.setProperty('--featured-top-shift', `${topShift}px`);
    wrap.style.setProperty('--featured-artwork-height', `${artworkHeight}px`);
    content.style.setProperty('--featured-scale', maxScale);
    const viewport = `${innerWidth}:${innerHeight}`;
    if (!wasEnabled) {
      pageIndex = location.hash === '#featured' ? 1 : nearestPage();
      goTo(pageIndex, false);
    } else if (viewport !== lastViewport) goTo(pageIndex, false);
    lastViewport = viewport;
    wasEnabled = true;
  }
  addEventListener('wheel', event => {
    if (!enabled.matches || event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    if (event.target instanceof Element && event.target.closest('textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    clearTimeout(gestureTimer);
    gestureTimer = setTimeout(() => {
      wheelTotal = 0;
      gestureConsumed = false;
    }, 240);
    // Absorb momentum events until the current gesture has ended.
    if (animating || gestureConsumed) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    if (Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
    wheelTotal += delta;
    if (Math.abs(wheelTotal) < 40) return;
    gestureConsumed = true;
    goTo(nearestPage() + Math.sign(wheelTotal));
  }, { passive: false });
  addEventListener('scroll', () => {
    clearTimeout(settleTimer);
    if (!enabled.matches || animating) return;
    // Scrollbar dragging and browser-driven focus scrolling also settle to a page.
    settleTimer = setTimeout(() => goTo(nearestPage()), 150);
  }, { passive: true });
  addEventListener('keydown', event => {
    if (!enabled.matches || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof Element) {
      if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.target.closest('button, a') && (event.code === 'Space' || event.key === 'ArrowDown' || event.key === 'ArrowUp')) return;
    }
    const direction = event.key === 'PageDown' || event.key === 'ArrowDown' || (event.code === 'Space' && !event.shiftKey) ? 1
      : event.key === 'PageUp' || event.key === 'ArrowUp' || (event.code === 'Space' && event.shiftKey) ? -1 : 0;
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    if (animating) return;
    goTo(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : nearestPage() + direction);
  });
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href="#featured"]') : null;
    if (!enabled.matches || !link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.hash !== '#featured') history.pushState(null, '', '#featured');
    goTo(1);
  });
  addEventListener('hashchange', () => { if (enabled.matches) goTo(location.hash === '#featured' ? 1 : 0); });
  addEventListener('pagehide', cancelTransition);
  addEventListener('resize', measure);
  addEventListener('pageshow', measure);
  enabled.addEventListener('change', measure);
  document.fonts?.ready.then(measure);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(content);
  measure();
});
