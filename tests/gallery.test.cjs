const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fixture } = require('./helpers/gallery-dom.cjs');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/gallery.js'), 'utf8');
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
function setup(options) {
  const f = fixture(options);
  class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } }
  vm.runInNewContext(source, { document: f.document, window: f.window, matchMedia: () => f.preference, CustomEvent });
  f.document.dispatchEvent(new Event('DOMContentLoaded'));
  f.dialog = f.document.querySelector('.art-lightbox');
  f.image = f.dialog.querySelector('.lightbox-image');
  f.openButton = f.media.querySelector('.gallery-open-button');
  return f;
}
const click = element => { element.focus(); element.dispatchEvent(new Event('click')); };
test('opens in place, crossfades without transforms, and closes with focus restored', async () => {
  const f = setup(); click(f.openButton); await flush();
  assert(f.dialog.open); assert.equal(f.image.src, 'first.webp');
  assert.equal(f.image.animations.at(-1).options.duration, 420);
  assert(f.image.animations.at(-1).frames.every(frame => !('transform' in frame)));
  click(f.dialog.querySelector('.lightbox-next')); await flush();
  assert.equal(f.image.src, 'second.webp');
  const previous = f.dialog.querySelector('.lightbox-previous'); assert(previous);
  assert.equal(previous.animations.at(-1).options.duration, 280);
  click(f.dialog.querySelector('.lightbox-close'));
  assert(f.dialog.open); assert.equal(f.dialog.animations.at(-1).options.duration, 180);
  f.dialog.animations.at(-1).finish(); await flush();
  assert(!f.dialog.open); assert.equal(f.track.dataset.index, '1');
  assert.equal(f.document.activeElement, f.openButton);
  assert.equal(f.openButton.focusOptions.preventScroll, true);
});
test('rapid selection discards a late decoded picture', async () => {
  const f = setup(); click(f.openButton); await flush();
  let complete; f.sources[1].decodePromise = new Promise(resolve => { complete = resolve; });
  click(f.dialog.querySelector('.lightbox-next')); await flush();
  click(f.dialog.querySelector('.lightbox-next')); await flush(); assert.equal(f.image.src, 'third.webp');
  complete(); await flush(); assert.equal(f.image.src, 'third.webp');
});
test('Escape uses the close animation; reduced motion closes immediately', async () => {
  const f = setup(); click(f.openButton); await flush();
  const event = new Event('cancel', { cancelable: true }); f.dialog.dispatchEvent(event);
  assert(event.defaultPrevented); assert(f.dialog.open);
  f.dialog.animations.at(-1).finish(); await flush(); assert(!f.dialog.open);
  const reduced = setup({ reduced: true }); click(reduced.openButton); await flush();
  assert.equal(reduced.image.animations.length, 0);
  click(reduced.dialog.querySelector('.lightbox-close')); assert(!reduced.dialog.open);
});
test('thumbnail navigation scrolls only its own strip', async () => {
  const f = setup(); click(f.openButton); await flush();
  const thumbs = f.dialog.querySelector('.lightbox-thumbnails');
  thumbs.bounds = { left: 0, right: 100 };
  thumbs.children[1].bounds = { left: 120, right: 180 };
  click(thumbs.children[1]); await flush();
  assert.equal(f.image.src, 'second.webp'); assert.equal(thumbs.scrolls.at(-1).left, 88);
});
test('a late load after close cannot replace the next opening', async () => {
  const f = setup({ reduced: true });
  let complete; f.sources[0].decodePromise = new Promise(resolve => { complete = resolve; });
  click(f.openButton); await flush(); click(f.dialog.querySelector('.lightbox-close'));
  f.track.dataset.index = '1'; f.track.dispatchEvent(new Event('gallery:change'));
  click(f.openButton); await flush(); assert.equal(f.image.src, 'second.webp');
  complete(); await flush(); assert.equal(f.image.src, 'second.webp');
});
test('failed pictures show an error and the next picture can still open', async () => {
  const f = setup(); f.sources[0].decodePromise = Promise.reject(new Error('decode failed'));
  click(f.openButton); await flush();
  assert.equal(f.dialog.querySelector('.lightbox-error').hidden, false);
  click(f.dialog.querySelector('.lightbox-next')); await flush();
  assert.equal(f.image.src, 'second.webp'); assert.equal(f.dialog.querySelector('.lightbox-error').hidden, true);
});
test('3D moves the existing frame and returns it to its original slide', async () => {
  const f = setup({ reduced: true }); const frame = f.sources[3]; const home = frame.parentElement;
  f.track.dataset.index = '3'; f.track.dispatchEvent(new Event('gallery:change'));
  click(f.openButton); await flush();
  assert.equal(frame.parentElement, f.dialog.querySelector('.lightbox-stage')); assert.equal(frame.src, 'viewer.html');
  click(f.dialog.querySelector('.lightbox-close'));
  assert.equal(frame.parentElement, home); assert.equal(frame.src, 'viewer.html');
});
