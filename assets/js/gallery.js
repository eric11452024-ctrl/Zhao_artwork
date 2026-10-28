/* Keyboard-accessible, viewport-sized image gallery. Card links use ordinary navigation. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const easing = 'cubic-bezier(.22,.61,.36,1)';
  const track = document.getElementById('carouselTrack');
  const images = track ? Array.from(track.querySelectorAll('.carousel-item img')) : [];
  if (!images.length) return;
  const media = document.querySelector('.project-media');
  const carousel = document.getElementById('mediaCarousel');
  carousel.classList.add('gallery-enhanced');
  ['btnPrev', 'btnNext'].forEach(id => {
    const button = document.getElementById(id);
    if (button) carousel.append(button);
  });
  const slides = Array.from(track.children);
  const items = slides.map((slide, slideIndex) => ({
    image: slide.querySelector('img'),
    frame: slide.querySelector('iframe'),
    slideIndex
  })).filter(item => item.image || item.frame);
  const frameHomes = new Map(items.filter(item => item.frame).map(item => [item.frame, item.frame.parentElement]));
  const projectName = document.getElementById('projectTitle').textContent;
  let current = Number(track.dataset.index || 0);
  let active = 0;
  let revision = 0;
  let lastFocus = null;
  let imageAnimation;
  let openingRect = null;
  if (!reduced.matches && media.animate) {
    media.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing });
    document.querySelector('.project-head')?.animate([
      { opacity: 0, translate: '0 12px' }, { opacity: 1, translate: '0 0' }
    ], { duration: 700, delay: 180, easing, fill: 'backwards' });
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'gallery-toolbar';
  const count = document.createElement('span');
  count.className = 'gallery-count';
  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'gallery-open-button';
  openButton.textContent = '全屏鉴赏 ↗';
  toolbar.append(count, openButton);
  media.append(toolbar);
  const strip = document.createElement('div');
  strip.className = 'gallery-thumbnails';
  strip.setAttribute('aria-label', '项目图片与 3D 展示');
  media.append(strip);
  const inlineThumbs = slides.map((slide, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-thumbnail';
    const image = slide.querySelector('img');
    if (image) {
      const thumbnail = document.createElement('img');
      thumbnail.src = image.src;
      thumbnail.alt = '';
      thumbnail.draggable = false;
      thumbnail.loading = 'lazy';
      button.append(thumbnail);
      button.setAttribute('aria-label', `查看第 ${index + 1} 张图片`);
    } else {
      button.textContent = '3D';
      button.setAttribute('aria-label', '打开交互式 3D 展示');
    }
    button.addEventListener('click', () => track.dispatchEvent(new CustomEvent('gallery:select', { detail: { index } })));
    strip.append(button);
    return button;
  });

  const dialog = document.createElement('dialog');
  dialog.className = 'art-lightbox';
  dialog.setAttribute('aria-labelledby', 'lightboxTitle');
  dialog.innerHTML = `<div class="lightbox-header"><div><p class="lightbox-eyebrow">作品鉴赏</p><h2 id="lightboxTitle"></h2></div><button class="lightbox-close" type="button" aria-label="关闭全屏鉴赏"><span aria-hidden="true">×</span></button></div><div class="lightbox-stage"><button class="lightbox-prev" type="button" aria-label="上一项"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="14 6 8 12 14 18"></polyline></svg></button><img class="lightbox-image" alt=""><button class="lightbox-next" type="button" aria-label="下一项"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="10 6 16 12 10 18"></polyline></svg></button><p class="lightbox-error" hidden>图片暂时无法载入，请切换图片或稍后重试。</p></div><div class="lightbox-footer"><p class="lightbox-counter" aria-live="polite" aria-atomic="true"></p><div class="lightbox-thumbnails" aria-label="选择图片或 3D 展示"></div><p class="lightbox-hint">← → 切换 · Esc 关闭</p></div>`;
  document.body.append(dialog);
  dialog.querySelector('h2').textContent = projectName;
  const fullImage = dialog.querySelector('.lightbox-image');
  fullImage.draggable = false;
  const stage = dialog.querySelector('.lightbox-stage');
  const error = dialog.querySelector('.lightbox-error');
  const close = dialog.querySelector('.lightbox-close');
  const thumbs = items.map((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-thumbnail';
    button.setAttribute('aria-label', item.frame ? '查看交互式 3D 模型' : `查看第 ${index + 1} 张图片`);
    if (item.image) {
      const thumbnail = document.createElement('img');
      thumbnail.src = item.image.src;
      thumbnail.alt = '';
      thumbnail.draggable = false;
      thumbnail.loading = 'lazy';
      button.append(thumbnail);
    } else {
      button.textContent = '3D';
      button.classList.add('gallery-thumbnail-3d');
    }
    button.addEventListener('click', () => show(index));
    dialog.querySelector('.lightbox-thumbnails').append(button);
    return button;
  });

  // Reuse the existing viewer rather than loading a second WebGL model.
  function moveFrame(frame, parent) {
    if (parent.moveBefore && frame.isConnected && parent.isConnected) {
      try { parent.moveBefore(frame, null); return; } catch { /* Use ordinary insertion when state-preserving moves are unavailable. */ }
    }
    parent.append(frame);
  }
  function restoreViewers(except) {
    frameHomes.forEach((home, frame) => {
      if (frame === except) return;
      if (frame.parentElement !== home) moveFrame(frame, home);
      frame.classList.remove('lightbox-viewer');
    });
  }
  function wireViewerEscape(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc || doc.documentElement.dataset.galleryEscape) return;
      doc.documentElement.dataset.galleryEscape = 'true';
      doc.addEventListener('keydown', event => {
        if (event.key === 'Escape' && dialog.open) { event.preventDefault(); dialog.close(); }
      });
    } catch { /* The visible close button remains available for isolated local-file viewers. */ }
  }
  frameHomes.forEach((home, frame) => frame.addEventListener('load', () => wireViewerEscape(frame)));

  async function show(index) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && (dialog.contains(selection.anchorNode) || dialog.contains(selection.focusNode))) {
      selection.removeAllRanges();
    }
    active = (index + items.length) % items.length;
    const ticket = ++revision;
    imageAnimation?.cancel();
    // Load separately so rapid switching cannot display an out-of-date image.
    const item = items[active];
    const source = item.image;
    restoreViewers(item.frame);
    fullImage.hidden = Boolean(item.frame);
    stage.classList.toggle('is-viewer', Boolean(item.frame));
    error.hidden = true;
    stage.setAttribute('aria-busy', 'true');
    dialog.querySelector('.lightbox-counter').textContent = `${String(active + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}${item.frame ? ' · 3D' : ''}`;
    dialog.querySelector('.lightbox-hint').textContent = item.frame ? '拖动旋转 · 滚轮缩放' : '← → 切换 · Esc 关闭';
    thumbs.forEach((button, i) => button.setAttribute('aria-pressed', String(i === active)));
    thumbs[active].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    if (item.frame) {
      openingRect = null;
      fullImage.style.opacity = '0';
      stage.querySelectorAll('.lightbox-previous').forEach(image => image.remove());
      item.frame.classList.add('lightbox-viewer');
      moveFrame(item.frame, stage);
      wireViewerEscape(item.frame);
      stage.setAttribute('aria-busy', 'false');
      return;
    }
    const loaded = new Image();
    loaded.src = source.src;
    try {
      await loaded.decode();
      if (ticket !== revision || !dialog.open) return;
      stage.querySelectorAll('.lightbox-previous').forEach(image => image.remove());
      if (fullImage.getAttribute('src') && fullImage.style.opacity !== '0' && !reduced.matches && fullImage.animate) {
        const previous = fullImage.cloneNode();
        previous.className = 'lightbox-image lightbox-previous';
        previous.setAttribute('aria-hidden', 'true');
        stage.append(previous);
        const fade = previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing, fill: 'forwards' });
        fade.finished.then(() => previous.remove(), () => previous.remove());
      }
      fullImage.src = source.src;
      fullImage.alt = `${projectName}，第 ${active + 1} 张，共 ${images.length} 张`;
      fullImage.style.opacity = '1';
      if (!reduced.matches && fullImage.animate) {
        let initial = { opacity: 0, transform: 'scale(.975)' };
        if (openingRect?.width) {
          const bounds = fullImage.getBoundingClientRect();
          const fittedWidth = Math.min(bounds.width, bounds.height * loaded.naturalWidth / loaded.naturalHeight);
          if (fittedWidth > 0) {
            const dx = openingRect.left + openingRect.width / 2 - bounds.left - bounds.width / 2;
            const dy = openingRect.top + openingRect.height / 2 - bounds.top - bounds.height / 2;
            initial = { opacity: .3, transform: `translate(${dx}px, ${dy}px) scale(${openingRect.width / fittedWidth})` };
          }
        }
        imageAnimation = fullImage.animate([initial, { opacity: 1, transform: 'translate(0,0) scale(1)' }], { duration: openingRect ? 720 : 550, easing });
      }
      openingRect = null;
    } catch {
      if (ticket === revision && dialog.open) { error.hidden = false; fullImage.style.opacity = '0'; }
    } finally {
      if (ticket === revision) stage.setAttribute('aria-busy', 'false');
    }
  }
  function open(index) {
    lastFocus = document.activeElement;
    openingRect = items[index].image?.getBoundingClientRect() || null;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('gallery-is-open');
    fullImage.style.opacity = '0';
    close.focus();
    show(index);
  }
  function sync() {
    current = Number(track.dataset.index || 0);
    const source = slides[current]?.querySelector('img');
    openButton.hidden = false;
    count.textContent = source ? `${String(current + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')} · 点击图片放大` : '3D · 拖动旋转模型';
    inlineThumbs.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
  }
  track.addEventListener('gallery:change', sync);
  openButton.addEventListener('click', () => {
    const index = items.findIndex(item => item.slideIndex === current);
    if (index >= 0) open(index);
  });
  images.forEach((image, index) => {
    image.draggable = false;
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `全屏鉴赏第 ${index + 1} 张图片`);
    const itemIndex = items.findIndex(item => item.image === image);
    image.addEventListener('click', () => open(itemIndex));
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(itemIndex); }
    });
  });
  close.addEventListener('click', () => dialog.close());
  dialog.querySelector('.lightbox-prev').addEventListener('click', () => show(active - 1));
  dialog.querySelector('.lightbox-next').addEventListener('click', () => show(active + 1));
  dialog.querySelector('.lightbox-prev').hidden = dialog.querySelector('.lightbox-next').hidden = items.length < 2;
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      show(active + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  let touchStart = null;
  stage.addEventListener('pointerdown', event => {
    if (!items[active].frame && event.pointerType === 'touch' && !event.target.closest('button')) touchStart = { x: event.clientX, y: event.clientY };
  });
  stage.addEventListener('pointerup', event => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(active + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => { touchStart = null; });
  dialog.addEventListener('close', () => {
    revision++;
    stage.querySelectorAll('.lightbox-previous').forEach(image => image.remove());
    imageAnimation?.cancel();
    restoreViewers();
    document.body.classList.remove('gallery-is-open');
    const index = items[active].slideIndex;
    track.dispatchEvent(new CustomEvent('gallery:select', { detail: { index } }));
    if (lastFocus?.isConnected && !lastFocus.closest('[inert]')) lastFocus.focus({ preventScroll: true });
    else openButton.focus({ preventScroll: true });
  });
  reduced.addEventListener('change', () => { if (reduced.matches) imageAnimation?.cancel(); });
  sync();
});
