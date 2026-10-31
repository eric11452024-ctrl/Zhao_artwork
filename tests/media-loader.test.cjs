const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/media-loader.js'), 'utf8');

test('home cover video readiness gates background pictures after the poster', async () => {
  const f = fixture();
  const query = f.root.querySelector.bind(f.root);
  f.root.querySelector = selector => selector === '.hero-visual' ? {} : query(selector);
  let release;
  f.window.heroVideoPlayback = { ready: new Promise(resolve => { release = resolve; }) };
  await flush();
  f.media[0].ready(); await flush();
  assert.equal(f.media[1].getAttribute('src'), null);
  release(); await flush();
  assert.equal(f.media[1].dataset.mediaState, 'loading');
});

async function flush() {
  // Drain the real promise continuations used by the loader's async workers.
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

class FakeClock {
  now = 0;
  next = 0;
  timers = new Map();
  setTimeout = (fn, delay) => {
    const id = ++this.next;
    this.timers.set(id, { at: this.now + delay, fn });
    return id;
  };
  clearTimeout = id => this.timers.delete(id);
  async advance(duration) {
    const end = this.now + duration;
    while (true) {
      const next = [...this.timers].filter(([, timer]) => timer.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.now = next[1].at;
      this.timers.delete(next[0]);
      next[1].fn();
      await flush();
    }
    this.now = end;
    await flush();
  }
}

function fixture({ tags = ['img', 'img', 'iframe'], hidden = false, trackIndexes = null, prepare } = {}) {
  const requests = [];
  class Element extends EventTarget {
    constructor(tag, name) {
      super();
      this.tagName = tag.toUpperCase();
      this.name = name;
      this.children = [];
      this.dataset = {};
      this.attributes = new Map();
      this.complete = false;
      this.naturalWidth = 0;
      this.readyState = 0;
      this.loading = 'lazy';
      this.pauseCount = 0;
      this.loadCount = 0;
    }
    append(...children) { this.children.push(...children); }
    get firstElementChild() { return this.children[0] || null; }
    get lastElementChild() { return this.children.at(-1) || null; }
    set src(value) {
      this.attributes.set('src', value);
      requests.push({ element: this, source: value });
    }
    get src() { return this.attributes.get('src') || ''; }
    get currentSrc() { return this.src; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    querySelector(selector) {
      if (selector === '#carouselTrack') return this.track || null;
      return this.querySelectorAll(selector)[0] || null;
    }
    querySelectorAll(selector) {
      const nodes = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
      if (selector === '*') return nodes;
      return nodes.filter(node => selector.split(',').some(part => {
        const rule = part.trim();
        if (rule === '.hero-bg-img') return node.hero === true;
        const match = /^(img|video|iframe)(\[data-media-src\])?$/.exec(rule);
        return match && node.tagName === match[1].toUpperCase()
          && (!match[2] || Object.hasOwn(node.dataset, 'mediaSrc'));
      }));
    }
    pause() { this.pauseCount++; }
    load() { this.loadCount++; }
    ready() {
      if (this.tagName === 'IMG') { this.complete = true; this.naturalWidth = 400; }
      if (this.tagName === 'VIDEO') this.readyState = 3;
      this.dispatchEvent(new Event(this.tagName === 'VIDEO' ? 'canplay' : 'load'));
    }
    fail() { this.dispatchEvent(new Event('error')); }
  }

  const media = tags.map((tag, index) => {
    const element = new Element(tag, `${tag}${index}`);
    element.dataset.mediaSrc = `${element.name}.${tag === 'img' ? 'webp' : tag === 'video' ? 'mp4' : 'html'}`;
    return element;
  });
  const root = new Element('main', 'root');
  const track = new Element('div', 'track');
  root.track = track;
  const indexes = trackIndexes || media.map((_, index) => index);
  for (const index of indexes) {
    const slide = new Element('div', `slide${index}`);
    slide.append(media[index]);
    track.append(slide);
  }
  root.append(track, ...media.filter((_, index) => !indexes.includes(index)));
  const document = new EventTarget();
  document.hidden = hidden;
  const window = new EventTarget();
  const clock = new FakeClock();
  vm.runInNewContext(source, {
    window, document, CustomEvent,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout
  }, { filename: 'media-loader.js' });
  prepare?.({ media, requests, root, track });
  const loader = window.createPortfolioMediaLoader(root);
  function event(target, type, props = {}) {
    const event = new Event(type);
    Object.assign(event, props);
    target.dispatchEvent(event);
  }
  return { media, root, track, window, document, clock, requests, loader, Element, event };
}

test('first image alone, then next/previous images with at most two background requests', async () => {
  const f = fixture({ tags: ['img', 'img', 'img', 'img', 'img', 'iframe'], trackIndexes: [0, 1, 2, 3, 4] });
  const [first, next, middleA, middleB, previous, frame] = f.media;
  await flush();
  assert.deepEqual(f.requests.map(request => request.element), [first]);
  assert.equal(first.fetchPriority, 'high');
  first.ready();
  await flush();
  assert.deepEqual(f.requests.map(request => request.element), [first, next, previous]);
  assert.equal(middleA.getAttribute('src'), null);
  assert.equal(frame.getAttribute('src'), null);
  next.ready();
  await flush();
  assert.equal(middleA.dataset.mediaState, 'loading');
  assert.equal(middleB.getAttribute('src'), null);
  previous.ready();
  await flush();
  assert.equal(middleB.dataset.mediaState, 'loading');
  assert.equal(f.media.filter(element => element.tagName === 'IMG' && element.dataset.mediaState === 'loading').length, 2);
  middleB.ready();
  await flush();
  assert.equal(frame.getAttribute('src'), null, '3D waits for the last unfinished picture');
  middleA.ready();
  await flush();
  assert.equal(frame.src, frame.dataset.mediaSrc);
  assert.equal(frame.loading, 'eager', 'automatic model loading must not depend on viewport visibility');
});

test('video canplay, rather than loadeddata, gates the following video and model', async () => {
  const f = fixture({ tags: ['img', 'img', 'video', 'video', 'iframe'] });
  const [first, second, videoA, videoB, frame] = f.media;
  await flush();
  first.ready();
  await flush();
  second.ready();
  await flush();
  assert.equal(videoA.src, videoA.dataset.mediaSrc);
  assert.equal(videoA.preload, 'auto');
  assert.equal(videoA.loadCount, 1);
  assert.equal(videoB.getAttribute('src'), null);
  videoA.dispatchEvent(new Event('loadeddata'));
  await flush();
  assert.equal(videoB.getAttribute('src'), null);
  assert.equal(frame.getAttribute('src'), null);
  videoA.ready();
  await flush();
  assert.equal(videoB.src, videoB.dataset.mediaSrc);
  assert.equal(frame.getAttribute('src'), null);
  videoB.ready();
  await flush();
  assert.equal(frame.src, frame.dataset.mediaSrc);
});

test('a first-slide video is prepared before secondary pictures', async () => {
  const f = fixture({ tags: ['video', 'img', 'iframe'] });
  await flush();
  assert.equal(f.media[0].loadCount, 1);
  assert.equal(f.media[1].getAttribute('src'), null);
  f.media[0].ready();
  await flush();
  assert.equal(f.media[1].src, f.media[1].dataset.mediaSrc);
});

test('image failure and image/video timeout cannot deadlock automatic 3D loading', async () => {
  const f = fixture({ tags: ['img', 'img', 'video', 'iframe'] });
  const [first, second, video, frame] = f.media;
  await flush();
  first.fail();
  await flush();
  assert.equal(first.dataset.mediaState, 'error');
  assert.equal(second.dataset.mediaState, 'loading');
  await f.clock.advance(14999);
  assert.equal(video.getAttribute('src'), null);
  await f.clock.advance(1);
  assert.equal(second.dataset.mediaState, 'timeout');
  assert.equal(video.dataset.mediaState, 'loading');
  await f.clock.advance(19999);
  assert.equal(frame.getAttribute('src'), null);
  await f.clock.advance(1);
  assert.equal(video.dataset.mediaState, 'timeout');
  assert.equal(frame.src, frame.dataset.mediaSrc);
});

test('manual 3D selection starts immediately and repeated selection does not reload it', async () => {
  const f = fixture();
  await flush();
  const frame = f.media[2];
  f.track.dispatchEvent(new CustomEvent('gallery:change', { detail: { index: 2 } }));
  assert.equal(frame.src, frame.dataset.mediaSrc);
  assert.equal(frame.loading, 'eager');
  assert.equal(f.media[0].dataset.mediaState, 'loading');
  f.track.dispatchEvent(new CustomEvent('gallery:change', { detail: { index: 2 } }));
  assert.equal(f.requests.filter(request => request.element === frame).length, 1);
  frame.ready();
  await f.loader.prioritize(frame);
  assert.equal(f.requests.filter(request => request.element === frame).length, 1);
});

test('manual picture selection promotes that picture ahead of the background queue', async () => {
  const f = fixture({ tags: ['img', 'img', 'img', 'iframe'] });
  await flush();
  f.track.dispatchEvent(new CustomEvent('gallery:change', { detail: { index: 2 } }));
  assert.equal(f.media[2].src, f.media[2].dataset.mediaSrc);
  assert.equal(f.media[2].fetchPriority, 'high');
  assert.equal(f.media[1].getAttribute('src'), null);
});

test('thumbnails receive no URL until their source image is ready', async () => {
  const f = fixture();
  const firstThumb = new f.Element('img', 'firstThumb');
  const secondThumb = new f.Element('img', 'secondThumb');
  f.loader.thumbnail(f.media[0], firstThumb);
  f.loader.thumbnail(f.media[1], secondThumb);
  assert.equal(firstThumb.getAttribute('src'), null);
  assert.equal(secondThumb.getAttribute('src'), null);
  await flush();
  assert.equal(firstThumb.getAttribute('src'), null, 'loading the original must not create another request via thumbnail');
  f.media[0].ready();
  await flush();
  assert.equal(firstThumb.src, f.media[0].src);
  assert.equal(secondThumb.getAttribute('src'), null);
  f.media[1].ready();
  await flush();
  assert.equal(secondThumb.src, f.media[1].src);
});

test('pagehide cancels waiting tasks and prevents later background or manual starts', async () => {
  const f = fixture({ tags: ['img', 'img', 'video', 'iframe'] });
  await flush();
  f.event(f.window, 'pagehide');
  assert.equal(f.media[0].dataset.mediaState, 'cancelled');
  await f.clock.advance(60000);
  f.media[0].ready();
  await f.loader.prioritize(f.media[3]);
  await flush();
  assert.equal(f.requests.length, 1);
  assert.equal(f.media[2].pauseCount, 1);
  assert.equal(f.media[2].preload, 'none');
  assert.equal(f.clock.timers.size, 0);
});

test('BFCache pageshow resumes resources that pagehide cancelled', async () => {
  const f = fixture();
  await flush();
  f.event(f.window, 'pagehide');
  await flush();
  f.event(f.window, 'pageshow', { persisted: false });
  await flush();
  assert.equal(f.media[0].dataset.mediaState, 'cancelled');
  f.event(f.window, 'pageshow', { persisted: true });
  await flush();
  assert.equal(f.media[0].dataset.mediaState, 'loading');
  f.media[0].ready();
  await flush();
  assert.equal(f.media[1].dataset.mediaState, 'loading');
  f.media[1].ready();
  await flush();
  assert.equal(f.media[2].src, f.media[2].dataset.mediaSrc);
});

test('hidden tab starts nothing, and visibility restoration resumes the queue without deadlock', async () => {
  const f = fixture({ hidden: true });
  await flush();
  assert.equal(f.requests.length, 0);
  f.document.hidden = false;
  f.event(f.document, 'visibilitychange');
  await flush();
  assert.equal(f.media[0].dataset.mediaState, 'loading');
  f.document.hidden = true;
  f.event(f.document, 'visibilitychange');
  f.media[0].ready();
  await flush();
  assert.equal(f.media[1].getAttribute('src'), null);
  f.document.hidden = false;
  f.event(f.document, 'visibilitychange');
  await flush();
  f.media[1].ready();
  await flush();
  assert.equal(f.media[2].src, f.media[2].dataset.mediaSrc);
});

test('an already cached hero settles immediately without waiting for a second load event', async () => {
  const f = fixture({
    trackIndexes: [],
    prepare({ media }) {
      const hero = media[0];
      hero.hero = true;
      hero.attributes.set('src', hero.dataset.mediaSrc);
      delete hero.dataset.mediaSrc;
      hero.complete = true;
      hero.naturalWidth = 1920;
    }
  });
  await flush();
  assert.equal(f.media[0].dataset.mediaState, 'ready');
  assert.equal(f.media[1].dataset.mediaState, 'loading');
  assert.equal(f.requests.filter(request => request.element === f.media[0]).length, 0);
});

test('a cached failed hero does not block the remaining pictures', async () => {
  const f = fixture({
    trackIndexes: [],
    prepare({ media }) {
      const hero = media[0];
      hero.hero = true;
      hero.attributes.set('src', hero.dataset.mediaSrc);
      delete hero.dataset.mediaSrc;
      hero.complete = true;
      hero.naturalWidth = 0;
    }
  });
  await flush();
  assert.equal(f.media[0].dataset.mediaState, 'error');
  assert.equal(f.media[1].dataset.mediaState, 'loading');
});

test('manual interaction retries a failed picture instead of returning its old settled promise', async () => {
  const f = fixture();
  await flush();
  f.media[0].fail();
  await flush();
  const retry = f.loader.prioritize(f.media[0]);
  assert.equal(f.media[0].dataset.mediaState, 'loading');
  assert.equal(f.requests.filter(request => request.element === f.media[0]).length, 2);
  f.media[0].ready();
  await retry;
  assert.equal(f.media[0].dataset.mediaState, 'ready');
});

test('manual interaction upgrades an already running background picture without starting a duplicate request', async () => {
  const f = fixture();
  await flush();
  f.media[0].ready();
  await flush();
  const picture = f.media[1];
  assert.equal(picture.dataset.mediaState, 'loading');
  assert.notEqual(picture.fetchPriority, 'high');
  f.loader.prioritize(picture);
  assert.equal(picture.fetchPriority, 'high');
  assert.equal(f.requests.filter(request => request.element === picture).length, 1);
});

test('a picture that arrives after its scheduling timeout still fills its thumbnail', async () => {
  const f = fixture();
  const thumbnail = new f.Element('img', 'lateThumbnail');
  f.loader.thumbnail(f.media[1], thumbnail);
  await flush();
  f.media[0].ready();
  await flush();
  await f.clock.advance(15000);
  assert.equal(f.media[1].dataset.mediaState, 'timeout');
  assert.equal(thumbnail.getAttribute('src'), null);
  f.media[1].ready();
  await flush();
  assert.equal(thumbnail.src, f.media[1].src);
});
