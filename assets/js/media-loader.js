/* Per-page media ordering: first view, pictures, playable videos, then 3D. */
(() => {
  'use strict';
  window.createPortfolioMediaLoader = root => {
    const media = Array.from(root.querySelectorAll('img[data-media-src], video[data-media-src], iframe[data-media-src], .hero-bg-img'));
    const tasks = new Map(media.map(element => [element, {
      element, state: 'queued', promise: null, cancel: null
    }]));
    const images = media.filter(element => element.tagName === 'IMG');
    const videos = media.filter(element => element.tagName === 'VIDEO');
    const viewers = media.filter(element => element.tagName === 'IFRAME');
    let stopped = false;
    let suspended = document.hidden;
    const waiting = new Set();
    const timers = new Set();

    function finishTask(task, state) {
      task.state = state;
      task.element.dataset.mediaState = state;
      task.element.dispatchEvent(new CustomEvent('media:state', { detail: { state } }));
    }
    function load(element, urgent = false) {
      const task = tasks.get(element);
      if (!task || stopped) return Promise.resolve();
      if (urgent && element.tagName === 'IMG') element.fetchPriority = 'high';
      if (task.state === 'loading' || task.state === 'ready') return task.promise;
      if (task.state !== 'queued' && !urgent) return task.promise;
      task.promise = new Promise(resolve => {
        const video = element.tagName === 'VIDEO';
        let timer;
        let finished = false;
        const readyEvent = video ? 'canplay' : 'load';
        const finish = state => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          timers.delete(timer);
          element.removeEventListener(readyEvent, ready);
          element.removeEventListener('error', failed);
          task.cancel = null;
          finishTask(task, state);
          resolve();
        };
        const ready = () => finish('ready');
        const failed = () => finish('error');
        task.cancel = () => finish('cancelled');
        finishTask(task, 'loading');
        element.addEventListener(readyEvent, ready);
        element.addEventListener('error', failed);
        timer = setTimeout(() => finish('timeout'), video ? 20000 : 15000);
        timers.add(timer);
        const source = element.dataset.mediaSrc;
        if (element.tagName === 'IMG' && !urgent) element.fetchPriority = 'low';
        if (video) {
          element.preload = 'auto';
          if (source && element.getAttribute('src') !== source) element.src = source;
          element.load();
          if (element.readyState >= 3) ready();
        } else {
          element.loading = 'eager';
          if (source && (element.getAttribute('src') !== source || urgent)) element.src = source;
          if (element.tagName === 'IMG' && element.complete) {
            if (element.naturalWidth > 0) ready();
            else if (element.getAttribute('src')) failed();
          }
        }
      });
      return task.promise;
    }
    function available() {
      if (stopped) return Promise.resolve(false);
      if (!suspended) return Promise.resolve(true);
      return new Promise(resolve => { waiting.add(resolve); });
    }
    function resume() {
      suspended = document.hidden;
      if (!suspended) {
        waiting.forEach(resolve => resolve(!stopped));
        waiting.clear();
      }
    }
    async function batch(elements, concurrency) {
      // One shared queue also limits requests when a task has already been promoted.
      const queue = [...elements];
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (queue.length && !stopped) {
          if (!await available()) return;
          await load(queue.shift());
        }
      }));
    }
    const track = root.querySelector('#carouselTrack');
    const firstSlide = track?.firstElementChild;
    const first = firstSlide?.querySelector('img, video') || images[0] || videos[0];
    async function run() {
      if (!await available()) return;
      if (first) await load(first, true);
      if (root.querySelector('.hero-visual')) await window.heroVideoPlayback?.ready;
      // Adjacent slides precede the rest, with a maximum of two background images.
      const adjacent = track ? [track.children[1], track.lastElementChild]
        .map(slide => slide?.querySelector('img')).filter(Boolean) : [];
      const ordered = [...new Set([...adjacent, ...images])].filter(image => image !== first);
      await batch(ordered, 2);
      await batch(videos.filter(video => video !== first), 1);
      await batch(viewers, 1);
    }
    function prioritize(element) {
      return load(element, true);
    }
    function selectSlide(event) {
      const slide = track?.children[event.detail?.index];
      const element = slide?.querySelector('img, video, iframe');
      if (element) prioritize(element);
      videos.forEach(video => { if (video !== element) video.pause(); });
    }
    function stop() {
      stopped = true;
      waiting.forEach(resolve => resolve(false));
      waiting.clear();
      tasks.forEach(task => task.cancel?.());
      timers.forEach(clearTimeout);
      timers.clear();
      videos.forEach(video => { video.pause(); video.preload = 'none'; });
    }
    function restore(event) {
      if (!event.persisted) return;
      stopped = false;
      tasks.forEach(task => {
        if (task.state === 'cancelled') task.state = 'queued';
      });
      resume();
      run();
    }
    track?.addEventListener('gallery:change', selectSlide);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', restore);
    run();
    return {
      prioritize,
      // Thumbnail images get their URL only after the original request is ready.
      // This prevents hidden lightbox thumbnails from bypassing the queue.
      thumbnail(source, thumbnail) {
        const sync = () => {
          if (source.dataset.mediaState === 'ready' || (source.complete && source.naturalWidth > 0)) {
            thumbnail.src = source.currentSrc || source.getAttribute('src');
          }
        };
        source.addEventListener('media:state', sync);
        source.addEventListener('load', sync);
        sync();
      }
    };
  };
})();
