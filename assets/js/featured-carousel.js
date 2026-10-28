/* Embla 8.6.0, local build. Keep ordinary project links as the no-JS fallback. */
document.addEventListener('DOMContentLoaded', () => {
  const track = document.querySelector('.home .featured-grid');
  if (!track || typeof EmblaCarousel !== 'function') return;
  const cards = Array.from(track.querySelectorAll('.feature-card'));
  if (cards.length < 3) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.createElement('div');
  root.className = 'featured-carousel';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', '轮播');
  root.setAttribute('aria-label', '精选作品轮播');
  const viewport = document.createElement('div');
  viewport.className = 'featured-viewport';
  track.before(root);
  root.append(viewport);
  viewport.append(track);
  track.classList.add('featured-track');
  const slides = cards.map((card, index) => {
    const slide = document.createElement('div');
    slide.className = 'featured-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', '幻灯片');
    slide.setAttribute('aria-label', `${index + 1} / ${cards.length}`);
    card.before(slide);
    slide.append(card);
    card.querySelector('img').draggable = false;
    return slide;
  });
  const controls = document.createElement('div');
  controls.className = 'featured-carousel-controls';
  controls.innerHTML = '<button class="featured-carousel-arrow" type="button" aria-label="上一件作品"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button><div class="featured-carousel-dots" role="group" aria-label="选择作品"></div><button class="featured-carousel-arrow" type="button" aria-label="下一件作品"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m10 5 7 7-7 7"/></svg></button><span class="featured-carousel-status" aria-live="polite" aria-atomic="true"></span>';
  root.append(controls);
  const dots = cards.map((card, index) => {
    const dot = document.createElement('button');
    dot.className = 'featured-carousel-dot';
    dot.type = 'button';
    dot.setAttribute('aria-label', `展示${card.querySelector('h3').textContent}`);
    controls.querySelector('.featured-carousel-dots').append(dot);
    dot.addEventListener('click', () => {
      api.scrollTo(index, reduced.matches);
      prioritizeSelected();
    });
    return dot;
  });
  // Embla uses a physics duration rather than milliseconds; 30 gives an approximately 0.6s transition.
  const api = EmblaCarousel(viewport, { loop: true, align: 'center', duration: 30 });
  function prioritizeSelected() {
    window.portfolioMedia?.prioritize(cards[api.selectedScrollSnap()].querySelector('img'));
  }
  const dwellTime = 2000;
  let autoplayTimer = 0;
  let hovering = false;
  let dragging = false;
  let moving = false;
  function stopAutoplay() {
    clearTimeout(autoplayTimer);
    autoplayTimer = 0;
  }
  function scheduleAutoplay() {
    stopAutoplay();
    if (hovering || dragging || moving || document.hidden || reduced.matches) return;
    autoplayTimer = setTimeout(() => api.scrollNext(), dwellTime);
  }
  root.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovering = true;
    stopAutoplay();
  });
  root.addEventListener('pointerleave', () => {
    hovering = false;
    scheduleAutoplay();
  });
  // A manual selection starts a fresh dwell, including a click on the current dot.
  root.addEventListener('click', scheduleAutoplay);
  document.addEventListener('visibilitychange', scheduleAutoplay);
  api.on('pointerDown', () => { dragging = true; stopAutoplay(); })
    .on('pointerUp', () => { dragging = false; prioritizeSelected(); scheduleAutoplay(); })
    .on('scroll', () => { moving = true; stopAutoplay(); })
    .on('settle', () => { moving = false; scheduleAutoplay(); })
    .on('reInit', () => { moving = false; scheduleAutoplay(); })
    .on('destroy', stopAutoplay);
  // Correct the tween distance when Embla moves a slide across the loop boundary.
  function tween() {
    const engine = api.internalEngine();
    const progress = api.scrollProgress();
    const snaps = api.scrollSnapList();
    snaps.forEach((snap, snapIndex) => {
      engine.slideRegistry[snapIndex].forEach(index => {
        let difference = snap - progress;
        if (engine.options.loop) engine.slideLooper.loopPoints.forEach(point => {
          if (point.index !== index || point.target() === 0) return;
          difference = snap - (point.target() < 0 ? 1 + progress : progress - 1);
        });
        const scale = reduced.matches ? (index === api.selectedScrollSnap() ? 1 : .6)
          : Math.max(.6, 1 - Math.abs(difference * snaps.length) * .4);
        cards[index].style.setProperty('--carousel-scale', scale.toFixed(4));
      });
    });
  }
  function select() {
    const selected = api.selectedScrollSnap();
    slides.forEach((slide, index) => {
      slide.classList.toggle('is-current', index === selected);
      cards[index].tabIndex = index === selected ? 0 : -1;
      dots[index].setAttribute('aria-current', String(index === selected));
    });
    controls.querySelector('.featured-carousel-status').textContent = `${selected + 1} / ${cards.length}：${cards[selected].querySelector('h3').textContent}`;
    tween();
  }
  const arrows = controls.querySelectorAll('.featured-carousel-arrow');
  arrows[0].addEventListener('click', () => { api.scrollPrev(reduced.matches); prioritizeSelected(); });
  arrows[1].addEventListener('click', () => { api.scrollNext(reduced.matches); prioritizeSelected(); });
  root.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') api.scrollPrev(reduced.matches);
    else api.scrollNext(reduced.matches);
    prioritizeSelected();
    if (event.target.closest('.feature-card')) cards[api.selectedScrollSnap()].focus({ preventScroll: true });
  });
  cards.forEach((card, index) => card.addEventListener('click', event => {
    if (event.defaultPrevented) return;
    if (index !== api.selectedScrollSnap() && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      api.scrollTo(index, reduced.matches);
      prioritizeSelected();
    }
  }));
  api.on('scroll', tween).on('select', select).on('reInit', select);
  reduced.addEventListener('change', () => {
    api.scrollTo(api.selectedScrollSnap(), true);
    moving = false;
    select();
    scheduleAutoplay();
  });
  select();
  scheduleAutoplay();
});
