/* Uniform scaling preserves image, typography, spacing and card proportions. */
document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.querySelector('.featured-wrap');
  if (!wrap) return;
  const content = wrap.querySelector('.featured-content');
  const section = wrap.querySelector('.featured');
  const intro = section.querySelector('.intro');
  const header = document.querySelector('.site-header');
  const enabled = matchMedia('(min-width: 769px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)');
  let frame = 0;
  let start = 0;
  let travel = 1;
  let minScale = 1;
  let maxScale = 1;

  function render() {
    frame = 0;
    if (!enabled.matches) return;
    const progress = Math.max(0, Math.min(1, (scrollY - start) / travel));
    const eased = progress * progress * (3 - 2 * progress);
    content.style.setProperty('--featured-scale', minScale + (maxScale - minScale) * eased);
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  function measure() {
    document.body.classList.toggle('home-stage-active', enabled.matches);
    if (!enabled.matches) {
      content.style.removeProperty('--featured-scale');
      wrap.style.removeProperty('--featured-artwork-height');
      section.style.removeProperty('--featured-top-shift');
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
    maxScale = Math.min(baselineScale * 1.1,
      (document.documentElement.clientWidth - 32) / content.offsetWidth, fittingScale);
    const artworkHeight = content.offsetHeight * maxScale;
    // Reclaim the empty space above while keeping the entire introduction in view.
    const requiredHeight = artworkHeight + topSpace + bottomSpace + gap + intro.offsetHeight;
    const topShift = Math.min(Math.max(0, topSpace - minimumTopSpace), Math.max(0, requiredHeight - availableHeight));
    section.style.setProperty('--featured-top-shift', `${topShift}px`);
    wrap.style.setProperty('--featured-artwork-height', `${artworkHeight}px`);
    minScale = Math.min(1, maxScale * .76);
    travel = availableHeight * .85;
    start = wrap.getBoundingClientRect().top + scrollY - headerHeight - travel;
    render();
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', measure);
  addEventListener('pageshow', measure);
  enabled.addEventListener('change', measure);
  document.fonts?.ready.then(measure);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(content);
  measure();
});
