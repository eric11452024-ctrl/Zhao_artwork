/* Two muted cover shots, double-buffered so a slow next clip never makes a black frame. */
(() => {
  'use strict';
  window.createHeroVideo = hero => {
    if (!hero) return null;
    const videos = Array.from(hero.querySelectorAll('.hero-video'));
    const poster = hero.querySelector('.hero-bg-img');
    const button = hero.querySelector('.hero-video-toggle');
    if (videos.length !== 2 || !button) return null;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let active = -1;
    let starting = false;
    let switching = false;
    let visible = true;
    let userPaused = false;
    let manualMotion = false;
    let leaving = false;
    let posterReady = !poster || poster.complete;
    let resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });
    const readyTimeout = setTimeout(() => resolveReady(), 20000);
    function settleReady() { clearTimeout(readyTimeout); resolveReady(); }
    const staticCover = () => userPaused || (reduced.matches && !manualMotion);
    const shouldPlay = () => !leaving && visible && !document.hidden && !userPaused && (!reduced.matches || manualMotion);
    function updateButton() {
      button.textContent = staticCover() ? '点击切换为视频封面' : '点击切换为静态封面';
      button.setAttribute('aria-label', button.textContent);
    }
    function prepare(index) {
      const video = videos[index];
      if (video.getAttribute('src') || video.dataset.failed) return;
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.defaultPlaybackRate = index === 0 ? 1 / 1.1 : 1;
      video.playbackRate = video.defaultPlaybackRate;
      video.preload = 'auto';
      video.src = video.dataset.heroSrc;
      video.load();
    }
    async function activate(index) {
      if (!shouldPlay() || starting || switching || videos[index].readyState < 3) return;
      starting = true;
      const video = videos[index];
      try {
        await video.play();
        if (!shouldPlay()) { video.pause(); return; }
        const previous = active;
        active = index;
        video.style.zIndex = '2';
        video.classList.add('is-active');
        if (previous >= 0 && previous !== index) {
          switching = true;
          videos[previous].style.zIndex = '1';
          setTimeout(() => {
            videos[previous].classList.remove('is-active');
            videos[previous].pause();
            videos[previous].currentTime = 0;
            switching = false;
            if (active >= 0 && videos[active].paused) sync();
          }, 600);
        }
        prepare(1 - index);
      } catch {
        // Autoplay can be declined; keep the poster/current frame and offer a play button.
        userPaused = true;
        videos.forEach(clip => { clip.pause(); clip.hidden = true; });
      } finally {
        starting = false;
        updateButton();
      }
    }
    function sync() {
      // Static mode reveals the poster instead of leaving a paused video frame on screen.
      videos.forEach(video => { video.hidden = staticCover(); });
      if (!shouldPlay()) {
        videos.forEach(video => video.pause());
        updateButton();
        return;
      }
      if (!posterReady) return;
      const index = active < 0 ? 0 : active;
      prepare(index);
      activate(index);
    }
    videos.forEach((video, index) => {
      video.addEventListener('canplay', () => {
        if (index === 0) settleReady();
        if (active < 0 || active === index) sync();
      });
      video.addEventListener('timeupdate', () => {
        if (active !== index || switching || starting || !shouldPlay()) return;
        if (Number.isFinite(video.duration) && video.duration - video.currentTime <= .6 * video.playbackRate) activate(1 - index);
      });
      video.addEventListener('error', () => {
        video.dataset.failed = 'true';
        video.classList.remove('is-active');
        if (index === 0) settleReady();
        if (active === index) { active = -1; sync(); }
        updateButton();
      });
    });
    button.hidden = false;
    button.addEventListener('click', () => {
      if (staticCover()) { userPaused = false; manualMotion = true; }
      else { userPaused = true; settleReady(); }
      sync();
    });
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', () => { manualMotion = false; sync(); });
    window.addEventListener('pagehide', () => { leaving = true; sync(); });
    window.addEventListener('pageshow', () => { leaving = false; sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        sync();
      }, { threshold: .01 }).observe(hero);
    }
    if (reduced.matches) settleReady();
    if (poster && !poster.complete) {
      const start = () => { posterReady = true; sync(); };
      poster.addEventListener('load', start, { once: true });
      poster.addEventListener('error', start, { once: true });
    } else sync();
    updateButton();
    return { ready };
  };
  window.heroVideoPlayback = window.createHeroVideo(document.querySelector('.hero'));
})();
