/* Local, dependency-free motion. Content stays visible if JavaScript is unavailable. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)');
  const animations = new Set();
  const ease = 'cubic-bezier(.16,1,.3,1)';
  function animate(element, frames, options = {}) {
    if (!element || reduced.matches || !element.animate) return;
    const animation = element.animate(frames, { duration: 1000, easing: ease, ...options });
    animations.add(animation);
    const release = () => animations.delete(animation);
    animation.addEventListener('finish', release, { once: true });
    animation.addEventListener('cancel', release, { once: true });
    return animation;
  }
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const image = hero?.querySelector('.hero-bg-img');
  const title = hero?.querySelector('h1');
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);

  if (hero) {
    const curtain = document.createElement('div');
    curtain.className = 'hero-curtain';
    curtain.setAttribute('aria-hidden', 'true');
    hero.append(curtain);
    animate(curtain, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: 1450 });
    animate(image, [{ scale: '1.14', filter: 'brightness(.45)' }, { scale: '1', filter: 'brightness(1)' }], { duration: 2400 });
    if (title && !reduced.matches) {
      title.setAttribute('aria-label', title.textContent);
      const letters = Array.from(title.textContent, letter => {
        const span = document.createElement('span');
        span.className = 'hero-letter';
        span.textContent = letter === ' ' ? '\u00a0' : letter;
        span.setAttribute('aria-hidden', 'true');
        return span;
      });
      title.replaceChildren(...letters);
      letters.forEach((letter, i) => animate(letter,
        [{ transform: 'translateY(115%) rotate(7deg)', opacity: 0 }, { transform: 'translateY(0) rotate(0)', opacity: 1 }],
        { duration: 1250, delay: 300 + i * 65, fill: 'backwards' }));
    }
    hero.querySelectorAll('.subtitle, .hero-cta').forEach((element, i) => animate(element,
      [{ opacity: 0, transform: 'translateY(25px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { delay: 650 + i * 160, fill: 'backwards' }));
    const featured = document.querySelector('.featured');
    if (featured) {
      featured.id ||= 'featured';
      const cue = document.createElement('a');
      cue.className = 'scroll-cue';
      cue.href = '#' + featured.id;
      cue.innerHTML = '<span>向下探索</span><i aria-hidden="true"></i>';
      hero.append(cue);
    }
  }
  animate(header, [{ opacity: 0, transform: 'translateY(-16px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: 350, fill: 'backwards' });

  // Prepare works cards before the observer runs, preventing a visible -> hidden flash.
  const pendingCards = new Set();
  const cardAnimations = new Map();
  const cardEase = 'cubic-bezier(.22,.61,.36,1)';
  function revealCard(card, index, filtering = false) {
    const previous = cardAnimations.get(card);
    const current = previous ? getComputedStyle(card) : null;
    const from = current
      ? { opacity: current.opacity, translate: current.translate }
      : { opacity: filtering ? .45 : 0, translate: filtering ? '0 12px' : '0 22px' };
    previous?.cancel();
    pendingCards.delete(card);
    observer?.unobserve(card);
    // The animation holds the first frame during its stagger delay; base styles stay visible.
    const animation = animate(card, [from, { opacity: 1, translate: '0 0' }], {
      duration: filtering ? 1100 : 1600,
      delay: Math.min(index, 2) * 140,
      easing: cardEase,
      fill: 'backwards'
    });
    card.classList.remove('motion-pending');
    if (!animation) return;
    cardAnimations.set(card, animation);
    const release = () => { if (cardAnimations.get(card) === animation) cardAnimations.delete(card); };
    animation.addEventListener('finish', release, { once: true });
    animation.addEventListener('cancel', release, { once: true });
  }
  const revealTargets = document.querySelectorAll('.section-head, .feature-card, .card, .intro-inner, .page-head, .about-hero, .about-cols, .contact-item, .project-head, .project-media, .project-info');
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      // Keep the shared cover stable while the browser performs a page transition.
      if (element.matches('.project-media, .project-head')) {
        observer.unobserve(element);
        return;
      }
      if (element.matches('.card')) {
        // Filtering can consume an already queued intersection. Do not reveal twice.
        if (pendingCards.has(element)) {
          const visibleCards = Array.from(element.parentElement.children).filter(card => !card.classList.contains('hidden'));
          revealCard(element, visibleCards.indexOf(element) % 3);
        }
        return;
      }
      const isCard = element.matches('.feature-card, .card');
      const index = isCard ? Array.from(element.parentElement.children).indexOf(element) % 3 : 0;
      animate(element, [
        { opacity: 0, translate: '0 48px', clipPath: isCard ? 'inset(10% 0 0 0)' : 'inset(0)' },
        { opacity: 1, translate: '0 0', clipPath: 'inset(0)' }
      ], { duration: 1100, delay: index * 95, fill: 'backwards' });
      observer.unobserve(element);
    });
  }, { threshold: .01, rootMargin: '0px 0px 48px 0px' }) : null;
  revealTargets.forEach(element => {
    if (observer && !reduced.matches && element.matches('.card')) {
      pendingCards.add(element);
      element.classList.add('motion-pending');
    }
    observer?.observe(element);
  });

  const cards = document.querySelectorAll('.feature-card, .card');
  const resets = [];
  cards.forEach(card => {
    let frame = 0;
    let hoverBounds = null;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      hoverBounds = null;
      card.style.removeProperty('transform');
      card.style.removeProperty('--light-x');
      card.style.removeProperty('--light-y');
      card.classList.remove('is-tilting');
    };
    resets.push(reset);
    card.addEventListener('pointermove', event => {
      if (reduced.matches || !desktop.matches || event.pointerType === 'touch') return;
      // Do not add a second movement while the card is arriving.
      if (cardAnimations.has(card)) return;
      // Measure the resting card once; measuring the tilted card feeds back into its angle.
      const bounds = hoverBounds ||= card.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        card.classList.add('is-tilting');
        card.style.setProperty('--light-x', `${x * 100}%`);
        card.style.setProperty('--light-y', `${y * 100}%`);
        card.style.transform = `perspective(1100px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 8}deg) translateY(-6px)`;
      });
    });
    card.addEventListener('pointerleave', reset);
    card.addEventListener('pointercancel', reset);
    card.addEventListener('blur', reset);
  });

  let scrollFrame = 0;
  function renderScroll() {
    scrollFrame = 0;
    const distance = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${distance > 0 ? Math.min(1, Math.max(0, scrollY / distance)) : 0})`;
    header?.classList.toggle('is-scrolled', scrollY > 40);
    if (image) {
      const amount = !reduced.matches && desktop.matches ? Math.min(scrollY, hero.offsetHeight) * .15 : 0;
      image.style.translate = `0 ${amount}px`;
    }
  }
  function scheduleScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(renderScroll);
  }
  addEventListener('scroll', scheduleScroll, { passive: true });
  addEventListener('resize', scheduleScroll);
  function preferenceChanged() {
    animations.forEach(animation => animation.cancel());
    pendingCards.forEach(card => card.classList.remove('motion-pending'));
    pendingCards.clear();
    resets.forEach(reset => reset());
    renderScroll();
  }
  reduced.addEventListener('change', preferenceChanged);
  desktop.addEventListener('change', preferenceChanged);
  // Use one reveal owner for scrolling and filtering, with no repeated jump on the active filter.
  let lastFilter = document.querySelector('#workFilters .is-active')?.dataset.filter;
  let lastSort = document.querySelector('#workSort')?.value;
  document.querySelectorAll('#workFilters, #workSort').forEach(control => {
    control.addEventListener(control.id === 'workSort' ? 'change' : 'click', event => {
      if (control.id === 'workSort') {
        if (lastSort === control.value) return;
        lastSort = control.value;
      } else {
        const chip = event.target.closest('.chip');
        if (!chip || chip.dataset.filter === lastFilter) return;
        lastFilter = chip.dataset.filter;
      }
      resets.forEach(reset => reset());
      document.querySelectorAll('.card.hidden').forEach(card => cardAnimations.get(card)?.cancel());
      document.querySelectorAll('.card:not(.hidden)').forEach((card, i) => revealCard(card, i % 3, true));
    });
  });
  renderScroll();
}, { once: true });
