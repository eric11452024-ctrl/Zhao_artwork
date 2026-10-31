/* Small event-driven DOM fixture; layout values are explicit inputs, not a browser rendering claim. */
class Animation {
  constructor(element, frames, options) { Object.assign(this, { element, frames, options }); }
  get finished() { return this.promise ||= new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
  cancel() { this.cancelled = true; this.reject?.(new Error('cancelled')); }
  finish() { this.resolve?.(); }
}
class Element extends EventTarget {
  constructor(tag, doc) {
    super(); this.tagName = tag.toUpperCase(); this.doc = doc;
    this.children = []; this.dataset = {}; this.style = {}; this.attrs = new Map(); this.classes = new Set();
    this.animations = []; this.bounds = { left: 0, right: 800, top: 0, width: 800, height: 500 };
    this.classList = {
      add: (...values) => values.forEach(value => this.classes.add(value)),
      remove: (...values) => values.forEach(value => this.classes.delete(value)),
      contains: value => this.classes.has(value),
      toggle: (value, force) => { const add = force ?? !this.classes.has(value); add ? this.classes.add(value) : this.classes.delete(value); return add; }
    };
  }
  set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(' '); }
  setAttribute(name, value) {
    if (name === 'class') this.className = value;
    else if (name === 'id') this.id = value;
    else this.attrs.set(name, String(value));
  }
  getAttribute(name) { return name === 'class' ? this.className : name === 'id' ? this.id : this.attrs.get(name) ?? null; }
  set src(value) { this.setAttribute('src', value); }
  get src() { return this.getAttribute('src') || ''; }
  get isConnected() { return this === this.doc.body || Boolean(this.parentElement?.isConnected); }
  append(...elements) {
    for (const element of elements) { element.remove(); element.parentElement = this; this.children.push(element); }
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
  }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) {
    if (selector === '[inert]') return Boolean(this.inert);
    if (selector.startsWith('.')) return selector.slice(1).split('.').every(value => this.classes.has(value));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    return this.tagName.toLowerCase() === selector;
  }
  closest(selector) { return selector.split(',').some(part => this.matches(part.trim())) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) {
    const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
    if (selector === '*') return all;
    return all.filter(element => selector.split(',').some(part => {
      const chain = part.trim().split(/\s+/);
      if (!element.matches(chain.pop())) return false;
      let parent = element.parentElement;
      while (chain.length) {
        const match = chain.pop();
        while (parent && !parent.matches(match)) parent = parent.parentElement;
        if (!parent) return false;
        parent = parent.parentElement;
      }
      return true;
    }));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  set innerHTML(html) {
    this.children = [];
    const stack = [this];
    for (const match of html.matchAll(/<(\/?)([\w-]+)([^>]*)>/g)) {
      if (match[1]) { if (stack.length > 1) stack.pop(); continue; }
      const child = new Element(match[2], this.doc);
      for (const attr of match[3].matchAll(/([\w-]+)="([^"]*)"/g)) child.setAttribute(attr[1], attr[2]);
      if (/\bhidden\b/.test(match[3])) child.hidden = true;
      stack.at(-1).append(child);
      if (!['img', 'input', 'br', 'source', 'meta'].includes(match[2])) stack.push(child);
    }
  }
  cloneNode() {
    const clone = new Element(this.tagName, this.doc);
    clone.attrs = new Map(this.attrs); clone.style = { ...this.style }; clone.className = this.className;
    return clone;
  }
  focus(options) { this.doc.activeElement = this; this.focusOptions = options; }
  getBoundingClientRect() { return this.bounds; }
  scrollBy(options) { (this.scrolls ||= []).push(options); }
  scrollIntoView() { throw new Error('Must not move the outer page from a thumbnail'); }
  animate(frames, options) { const animation = new Animation(this, frames, options); this.animations.push(animation); return animation; }
  decode() { return this.decodePromise || Promise.resolve(); }
  pause() { this.paused = true; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
}
function fixture({ reduced = false } = {}) {
  const document = new EventTarget();
  document.createElement = tag => new Element(tag, document);
  document.body = document.createElement('body'); document.activeElement = document.body;
  document.querySelector = selector => document.body.querySelector(selector);
  document.getElementById = id => document.querySelector(`#${id}`);
  const add = (parent, tag, className, id) => {
    const element = document.createElement(tag); element.className = className || ''; element.id = id;
    parent.append(element); return element;
  };
  add(document.body, 'h1', '', 'projectTitle').textContent = '测试作品';
  add(document.body, 'header', 'project-head');
  const media = add(document.body, 'section', 'project-media');
  const carousel = add(media, 'div', 'carousel', 'mediaCarousel');
  const track = add(carousel, 'div', 'carousel-track', 'carouselTrack'); track.dataset.index = '0';
  const sources = ['first.webp', 'second.webp', 'third.webp', 'viewer.html'].map((src, i) => {
    const slide = add(track, 'div', 'carousel-item'); const home = add(slide, 'div');
    const element = add(home, i === 3 ? 'iframe' : 'img'); element.src = src;
    return element;
  });
  add(media, 'button', '', 'btnPrev'); add(media, 'button', '', 'btnNext');
  const preference = new EventTarget(); preference.matches = reduced;
  const window = { getSelection: () => null, portfolioMedia: { prioritize: () => Promise.resolve(), thumbnail() {} } };
  track.addEventListener('gallery:select', event => {
    track.dataset.index = String(event.detail.index); track.dispatchEvent(new Event('gallery:change'));
  });
  return { document, window, media, track, sources, preference };
}
module.exports = { fixture };
