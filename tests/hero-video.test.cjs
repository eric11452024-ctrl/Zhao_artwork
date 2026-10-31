const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/hero-video.js'), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture({ reduced = false, posterReady = true, blocked = false } = {}) {
  class Element extends EventTarget {
    dataset = {}; style = {}; attributes = new Map(); paused = true; readyState = 0;
    currentTime = 0; duration = 5; rejectPlay = false; complete = posterReady;
    classes = new Set();
    classList = { add: value => this.classes.add(value), remove: value => this.classes.delete(value) };
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    set src(value) { this.setAttribute('src', value); }
    load() {}
    pause() { this.paused = true; }
    play() {
      if (this.rejectPlay) return Promise.reject(new Error('Autoplay blocked'));
      this.paused = false;
      return Promise.resolve();
    }
    ready() { this.readyState = 3; this.dispatchEvent(new Event('canplay')); }
  }
  const videos = [new Element(), new Element()];
  videos.forEach((video, i) => { video.dataset.heroSrc = `${i}.mp4`; });
  videos[0].rejectPlay = blocked;
  const poster = new Element(), button = new Element();
  const hero = { querySelectorAll: () => videos,
    querySelector: selector => selector === '.hero-bg-img' ? poster : button };
  const document = new EventTarget();
  document.hidden = false;
  document.querySelector = () => hero;
  const window = new EventTarget();
  const preference = new EventTarget(); preference.matches = reduced;
  let observer;
  class Observer { constructor(fn) { observer = fn; } observe() {} }
  window.IntersectionObserver = Observer;
  const timers = new Map(); let timerId = 0;
  vm.runInNewContext(source, { window, document, matchMedia: () => preference, IntersectionObserver: Observer,
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout(id) { timers.delete(id); } });
  return { videos, poster, button, document, window, preference, observer, ready: window.heroVideoPlayback.ready,
    fade() { for (const [id, timer] of timers) if (timer.ms === 600) { timers.delete(id); timer.fn(); } } };
}
test('poster comes first, second clip is only requested after first playback starts', async () => {
  const f = fixture({ posterReady: false });
  assert.equal(f.videos[0].getAttribute('src'), null);
  f.poster.dispatchEvent(new Event('load'));
  assert.equal(f.videos[0].getAttribute('src'), '0.mp4');
  assert.equal(f.videos[1].getAttribute('src'), null);
  f.videos[0].ready(); await flush(); await f.ready;
  assert.equal(f.videos[1].getAttribute('src'), '1.mp4');
  assert.equal(f.videos[0].paused, false);
  assert.equal(f.videos[0].muted, true);
  assert.equal(f.videos[0].playbackRate, 1 / 1.1);
  assert.equal(f.videos[1].playbackRate, 1);
});
test('both directions overlap for 600ms before the previous clip is reset', async () => {
  const f = fixture(); f.videos[0].ready(); await flush(); f.videos[1].ready();
  f.videos[0].currentTime = 4.5; f.videos[0].dispatchEvent(new Event('timeupdate')); await flush();
  assert(f.videos.every(video => video.classes.has('is-active')));
  f.fade(); assert.equal(f.videos[0].paused, true); assert.equal(f.videos[0].currentTime, 0);
  f.videos[1].currentTime = 4.5; f.videos[1].dispatchEvent(new Event('timeupdate')); await flush(); f.fade();
  assert.equal(f.videos[0].paused, false); assert.equal(f.videos[1].paused, true);
});
test('an unready second clip leaves the first visible and looping', async () => {
  const f = fixture(); f.videos[0].ready(); await flush();
  f.videos[0].currentTime = 4.8; f.videos[0].dispatchEvent(new Event('timeupdate')); await flush();
  assert(f.videos[0].classes.has('is-active')); assert.equal(f.videos[0].paused, false);
  assert.equal(f.videos[0].loop, true); assert.equal(f.videos[1].paused, true);
});
test('blocked autoplay keeps the poster and can be retried with the button', async () => {
  const f = fixture({ blocked: true }); f.videos[0].ready(); await flush();
  assert.equal(f.videos[0].classes.has('is-active'), false);
  assert.equal(f.button.textContent, '点击切换为视频封面');
  f.videos[0].rejectPlay = false; f.button.dispatchEvent(new Event('click')); await flush();
  assert(f.videos[0].classes.has('is-active'));
});
test('hidden tab, offscreen hero, and pagehide pause playback; returning resumes it', async () => {
  const f = fixture(); f.videos[0].ready(); await flush();
  f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange')); assert(f.videos[0].paused);
  f.document.hidden = false; f.document.dispatchEvent(new Event('visibilitychange')); await flush(); assert(!f.videos[0].paused);
  f.observer([{ isIntersecting: false }]); assert(f.videos[0].paused);
  f.observer([{ isIntersecting: true }]); await flush(); assert(!f.videos[0].paused);
  f.window.dispatchEvent(new Event('pagehide')); assert(f.videos[0].paused);
  f.window.dispatchEvent(new Event('pageshow')); await flush(); assert(!f.videos[0].paused);
});
test('reduced motion shows the poster until explicitly played, and manual pause persists', async () => {
  const f = fixture({ reduced: true }); await f.ready;
  assert.equal(f.videos[0].getAttribute('src'), null);
  f.button.dispatchEvent(new Event('click')); f.videos[0].ready(); await flush(); assert(!f.videos[0].paused);
  f.button.dispatchEvent(new Event('click')); assert(f.videos[0].paused);
  f.document.dispatchEvent(new Event('visibilitychange')); await flush(); assert(f.videos[0].paused);
});
test('failed first clip releases the page media queue and retains the poster', async () => {
  const f = fixture(); f.videos[0].dispatchEvent(new Event('error')); await f.ready;
  assert.equal(f.videos[0].classes.has('is-active'), false);
  assert.equal(f.videos[1].getAttribute('src'), null);
});

test('static cover hides both clips, persists across visibility changes and restores video on another click', async () => {
  const f = fixture(); f.videos[0].ready(); await flush();
  assert.equal(f.button.textContent, '点击切换为静态封面');
  f.button.dispatchEvent(new Event('click'));
  assert(f.videos.every(video => video.hidden && video.paused));
  assert.equal(f.button.textContent, '点击切换为视频封面');
  f.document.dispatchEvent(new Event('visibilitychange')); await flush();
  assert(f.videos.every(video => video.hidden && video.paused));
  f.button.dispatchEvent(new Event('click')); await flush();
  assert.equal(f.videos[0].hidden, false); assert.equal(f.videos[0].paused, false);
});

test('switching to static while buffering releases the queue without starting playback', async () => {
  const f = fixture(); f.button.dispatchEvent(new Event('click')); await f.ready;
  f.videos[0].ready(); await flush();
  assert(f.videos.every(video => video.hidden && video.paused));
});

test('switching to static and back during a crossfade resumes the selected clip', async () => {
  const f = fixture(); f.videos[0].ready(); await flush(); f.videos[1].ready();
  f.videos[0].currentTime = 4.5; f.videos[0].dispatchEvent(new Event('timeupdate')); await flush();
  f.button.dispatchEvent(new Event('click')); assert(f.videos.every(video => video.hidden));
  f.button.dispatchEvent(new Event('click')); await flush(); f.fade(); await flush();
  assert.equal(f.videos[1].hidden, false); assert.equal(f.videos[1].paused, false);
});
