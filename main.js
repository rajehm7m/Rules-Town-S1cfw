/* ===== asset-queue.js ===== */
(() => {
  'use strict';
  const sections=['#stories','#memories','#city-map','#connect','#evolution','#partners','footer'];
  const prepared=new Map(),pending=new WeakMap();
  const idle=()=>new Promise(resolve=>window.requestIdleCallback?window.requestIdleCallback(resolve,{timeout:650}):setTimeout(resolve,40));
  function imageReady(image,priority='low'){
    if(pending.has(image))return pending.get(image);
    const promise=new Promise(resolve=>{
      let done=false,timer;
      const finish=()=>{if(done)return;done=true;clearTimeout(timer);image.removeEventListener('load',loaded);image.removeEventListener('error',finish);resolve();};
      const loaded=()=>Promise.resolve(image.decode?.()).catch(()=>{}).finally(finish);
      image.decoding='async';image.fetchPriority=priority;
      image.addEventListener('load',loaded,{once:true});image.addEventListener('error',finish,{once:true});
      timer=setTimeout(finish,12000); // One failed asset must not block later sections.
      if(image.dataset.src){image.loading='eager';image.src=image.dataset.src;delete image.dataset.src;}
      if(image.complete&&image.naturalWidth)loaded();
    });
    pending.set(image,promise);return promise;
  }
  const domReady=new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const audio=document.querySelector('#brand-audio');
  const audioReady=new Promise(resolve=>{
    if(!audio||audio.readyState>=3){resolve();return;}
    const timer=setTimeout(done,3500);
    function done(){clearTimeout(timer);audio.removeEventListener('canplay',done);audio.removeEventListener('error',done);resolve();}
    audio.addEventListener('canplay',done,{once:true});audio.addEventListener('error',done,{once:true});
  });
  const introReady=Promise.allSettled([
    document.fonts.load('16px Serpentine'),
    audioReady,...[...document.querySelectorAll('#intro .intro-logo')].map(image=>imageReady(image,'high'))
  ]);
  const heroReady=Promise.allSettled([introReady,domReady]).then(async()=>{
    const images=[...document.querySelectorAll('#home img,.site-header img')].filter(image=>!image.closest('.portal-preview'));
    const first=images.filter(image=>image.closest('.character-layer.current')||image.closest('.site-header'));
    await Promise.allSettled(first.map(image=>imageReady(image,'high')));
    document.documentElement.dataset.heroReady='true';
  });
  const homeReady=heroReady.then(async()=>{
    for(const image of document.querySelectorAll('#home img[data-src]')){if(image.closest('.portal-preview'))continue;await idle();await imageReady(image,'low');}
  });
  function prepare(selector){
    if(prepared.has(selector))return prepared.get(selector);
    const section=document.querySelector(selector);if(!section)return Promise.resolve();
    const promise=(async()=>{
      const images=[...section.querySelectorAll('img[data-src]')];
      if(selector==='#stories')images.push(...document.querySelectorAll('.portal-preview img[data-src]'));
      section.dataset.assets='loading';
      // Two requests/decodes per batch, with time left for input and animation.
      for(let i=0;i<images.length;i+=2){await idle();await Promise.allSettled(images.slice(i,i+2).map(image=>imageReady(image)));}
      section.dataset.assets='ready';
    })();
    prepared.set(selector,promise);return promise;
  }
  window.MT_ASSETS={introReady,heroReady,deferImage(image,src){image.dataset.src=src;image.decoding='async';},prepare};
  async function start(){
    await homeReady;
    for(const selector of sections)await prepare(selector);
  }
  document.addEventListener('DOMContentLoaded',start,{once:true});
  // An explicit jump gets its destination ready without waiting for unrelated images.
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#"]'),href=link?.getAttribute('href');
    if(sections.includes(href))heroReady.then(()=>prepare(href));
  });
})();

;
/* ===== app.js ===== */
'use strict';

const scenes = [
  { name: 'R.I.F', arabic: 'R.I.F', image: 'abdulsamad.webp', lines: ['TRUST', 'NO ONE.', 'REMEMBER', 'EVERYTHING.'], phrase: 'TRUST NO ONE. REMEMBER EVERYTHING.', accent: '#ff1b23', rgb: '255,27,35', word: 'F-0', label: 'THE ART OF DISTRUST', story: 'بعض الأسرار لا تُقال. وبعض الوجوه لا تُنسى.' },
  { name: 'FIB', arabic: 'المارينز', image: 'mhna.webp', lines: ['POWER ISN’T', 'GIVEN.', 'IT’S', 'TAKEN.'], phrase: 'POWER ISN’T GIVEN. IT’S TAKEN.', accent: '#e65156', rgb: '230,81,86', word: 'P-1', label: 'THE PRICE OF POWER', story: 'لا تنتظر مكانك في القمة. اصنع الطريق إليه.' },
  { name: 'S.W.A.T', arabic: 'S.W.A.T', image: 'vladi.webp', lines: ['THE CITY', 'WATCHES.', 'THE CITY', 'REMEMBERS.'], phrase: 'THE CITY WATCHES. THE CITY REMEMBERS.', accent: '#81b8b5', rgb: '129,184,181', word: 'P-2', label: 'NOTHING GOES UNSEEN', story: 'لكل خطوة شاهد. ولكل حكاية أثر.' },
  { name: 'ANONYMOUS', arabic: 'أنونيموس', image: 'Snake.webp', lines: ['ONE', 'DECISION', 'CAN CHANGE', 'EVERYTHING.'], phrase: 'ONE DECISION CAN CHANGE EVERYTHING.', accent: '#b4bc80', rgb: '180,188,128', word: 'CHOOSE', label: 'THE MOMENT OF NO RETURN', story: 'بين ما كنت عليه وما ستصبحه، قرار واحد.' }
];
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const hero = $('.hero');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let introActive = document.body.classList.contains('intro-active');
let chapterTransition = false;
document.addEventListener('mtrp:chapterstate', event => { chapterTransition = event.detail.active; elapsed = 0; });
document.addEventListener('mtrp:introstate', event => { introActive = event.detail.active; elapsed = 0; lastTime = performance.now(); });
const pauseButton = $('.autoplay-toggle');
const period = 7200;
let active = 0;
let busy = false;
let requested = null;
let paused = reduced.matches;
let hovering = false;
let inView = true;
let elapsed = 0;
let lastTime = performance.now();
let raf = 0;
let transitionAnimations = [];

// Decode the four supplied portraits before each transition, so a slow image
// cannot leave an empty stage. They are also cached by the thumbnail selectors.
const portraits = scenes.map((scene) => {
  const image = new Image();
  image.decoding = 'async'; image.fetchPriority = scene === scenes[0] ? 'high' : 'low';
  if(!window.MT_ASSETS)image.src = `assets/images/${scene.image}`;
  return image;
});

function animate(element, frames, options) {
  const animation = element.animate(frames, { fill: 'both', ...options });
  transitionAnimations.push(animation);
  return animation.finished.catch(() => {});
}

function applyScene(index, announce) {
  const scene = scenes[index];
  hero.style.setProperty('--accent', scene.accent);
  hero.style.setProperty('--accent-rgb', scene.rgb);
  $$('.headline-line').forEach((line, i) => { line.textContent = scene.lines[i]; });
  $('.identity-name').textContent = scene.name;
  $('.identity-overline').textContent = scene.label;
  $('.ghost-word').textContent = scene.word;
  $('.scene-number').textContent = `0${index + 1}`;
  $('.chapter-current').textContent = `0${index + 1}`;
  $$('.character-choice').forEach((button, i) => {
    button.classList.toggle('active', i === index);
    button.setAttribute('aria-pressed', String(i === index));
  });
  if (announce) $('.scene-status').textContent = `${scene.arabic}. ${scene.phrase}`;
  hero.dataset.scene = String(index);
}

async function changeScene(index, manual = false) {
  index = (index + scenes.length) % scenes.length;
  if (busy) { requested = { index, manual }; return; }
  if (index === active) { elapsed = 0; return; }
  busy = true;
  hero.dataset.transitioning = 'true';
  document.dispatchEvent(new CustomEvent('mtrp:scenewillchange'));
  elapsed = 0;
  const oldLayer = $('.character-layer.current');
  const newLayer = $('.character-layer.standby');
  try {
    if(!portraits[index].src)portraits[index].src=`assets/images/${scenes[index].image}`;
    await portraits[index].decode();
    newLayer.querySelector('img').src = portraits[index].src;
    await newLayer.querySelector('img').decode();
    const quick = reduced.matches;
    newLayer.style.visibility = 'visible';
    newLayer.style.zIndex = '2';
    const imageOut = animate(oldLayer, quick ? [{ opacity: 1 }, { opacity: 0 }] : [
      { transform: 'translate3d(0,0,0) scale(1)', opacity: 1, offset: 0 },
      { transform: 'translate3d(-1%,9%,0) scale(.985)', opacity: 1, offset: .27 },
      { transform: 'translate3d(-3%,105%,0) scale(.92)', opacity: .1, offset: 1 }
    ], { duration: quick ? 100 : 760, easing: 'cubic-bezier(.5,0,.85,.45)' });
    const imageIn = animate(newLayer, quick ? [{ opacity: 0 }, { opacity: 1 }] : [
      { transform: 'translate3d(5%,112%,0) scale(1.06)', opacity: 1, offset: 0 },
      { transform: 'translate3d(0,-1.1%,0) scale(1.005)', opacity: 1, offset: .85 },
      { transform: 'translate3d(0,0,0) scale(1)', opacity: 1, offset: 1 }
    ], { delay: quick ? 0 : 230, duration: quick ? 130 : 1150, easing: 'cubic-bezier(.16,1,.3,1)' });
    const lines = $$('.headline-line');
    const textOut = lines.map((line, i) => animate(line, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: quick ? 'none' : 'translateY(32px)' }], { duration: quick ? 60 : 210, delay: quick ? 0 : i * 24, easing: 'ease-in' }));
    const identityOut = animate($('.identity'), [{ opacity: 1 }, { opacity: 0 }], { duration: quick ? 60 : 200 });
    animate($('.ghost-word'), [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: quick ? 'none' : 'translateY(-65px)' }], { duration: quick ? 60 : 260 });
    animate($('.ambient-particles'), [{ transform: 'translateY(0)', opacity: 1 }, { transform: quick ? 'none' : 'translateY(-90px)', opacity: 0 }], { duration: quick ? 60 : 350 });
    await Promise.all([...textOut, identityOut]);
    applyScene(index, manual);
    const textIn = lines.map((line, i) => animate(line, [{ opacity: 0, transform: quick ? 'none' : 'translateY(45px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: quick ? 80 : 700, delay: quick ? 0 : 70 + i * 65, easing: 'cubic-bezier(.16,1,.3,1)' }));
    animate($('.identity'), [{ opacity: 0 }, { opacity: 1 }], { delay: quick ? 0 : 300, duration: quick ? 80 : 550 });
    animate($('.ghost-word'), [{ opacity: 0, transform: quick ? 'none' : 'translateY(75px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: quick ? 80 : 1100, easing: 'cubic-bezier(.16,1,.3,1)' });
    animate($('.ambient-particles'), [{ transform: quick ? 'none' : 'translateY(95px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: quick ? 80 : 1100 });
    await Promise.all([imageOut, imageIn, ...textIn]);
    oldLayer.classList.replace('current', 'standby');
    oldLayer.style.visibility = 'hidden';
    newLayer.classList.replace('standby', 'current');
    newLayer.style.visibility = 'visible';
    oldLayer.style.zIndex = '';
    newLayer.style.zIndex = '';
    active = index;
  } catch (error) {
    newLayer.style.visibility = 'hidden';
    oldLayer.style.visibility = 'visible';
    applyScene(active, false);
    $('.scene-status').textContent = 'تعذر تحميل الشخصية. حاول مرة أخرى.';
    console.error('Portrait transition failed:', error);
  } finally {
    transitionAnimations.forEach((animation) => animation.cancel());
    transitionAnimations = [];
    busy = false;
    hero.dataset.transitioning = 'false';
    document.dispatchEvent(new CustomEvent('mtrp:scenechange'));
    elapsed = 0;
    if (requested) {
      const next = requested;
      requested = null;
      if (next.index !== active) changeScene(next.index, next.manual);
    }
  }
}

function syncPause() {
  if (!pauseButton) return;
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused ? 'تشغيل التبديل التلقائي' : 'إيقاف التبديل التلقائي');
}
pauseButton?.addEventListener('click', () => { paused = !paused; syncPause(); elapsed = 0; });
reduced.addEventListener('change', () => { paused = reduced.matches; syncPause(); });
syncPause();
applyScene(0, false);

$$('.character-choice').forEach((button) => button.addEventListener('click', () => changeScene(Number(button.dataset.scene), true)));
$$('.roster-card').forEach((button) => button.addEventListener('click', () => {
  paused = true;
  syncPause();
  changeScene(Number(button.dataset.scene), true);
  hero.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' });
  hero.focus({ preventScroll: true });
}));
hero.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    changeScene(active + (event.key === 'ArrowRight' ? 1 : -1), true);
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    changeScene(event.key === 'Home' ? 0 : scenes.length - 1, true);
  }
});
$('.character-selectors').addEventListener('pointerenter', () => { hovering = true; });
$('.character-selectors').addEventListener('pointerleave', () => { hovering = false; });
let touchStart = null;
hero.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch' || event.target.closest('button, a')) return;
  touchStart = { x: event.clientX, y: event.clientY };
});
hero.addEventListener('pointercancel', () => { touchStart = null; });
hero.addEventListener('pointerup', (event) => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) changeScene(active + (dx < 0 ? 1 : -1), true);
});
hero.addEventListener('pointermove', (event) => {
  if (reduced.matches || event.pointerType !== 'mouse' || innerWidth < 900) return;
  const rect = hero.getBoundingClientRect();
  hero.style.setProperty('--pointer-x', `${((event.clientX - rect.left) / rect.width - .5) * 12}px`);
  hero.style.setProperty('--pointer-y', `${((event.clientY - rect.top) / rect.height - .5) * 7}px`);
});
hero.addEventListener('pointerleave', () => { hero.style.setProperty('--pointer-x', '0px'); hero.style.setProperty('--pointer-y', '0px'); });

function tick(now) {
  const delta = Math.min(now - lastTime, 100);
  lastTime = now;
  const focusedControl = hero.contains(document.activeElement) && document.activeElement !== hero && document.activeElement.matches(':focus-visible');
  if (!introActive && !chapterTransition && !paused && !busy && !hovering && inView && !document.hidden && !focusedControl && !document.querySelector('dialog[open]') && !document.body.classList.contains('menu-open')) {
    elapsed += delta;
    if (elapsed >= period) changeScene(active + 1);
  }
  raf = requestAnimationFrame(tick);
}
new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }, { threshold: .2 }).observe(hero);
document.addEventListener('visibilitychange', () => { lastTime = performance.now(); });
raf = requestAnimationFrame(tick);
window.addEventListener('pagehide', () => cancelAnimationFrame(raf));
window.addEventListener('pageshow', (event) => { if (event.persisted) { lastTime = performance.now(); raf = requestAnimationFrame(tick); } });

$('#year').textContent = new Date().getFullYear();

// Keep navigation visible and mark the section currently passing under it.
const siteHeader = $('.site-header');
const navLinks = $$('.site-header nav a[href^="#"]');
const navSections = navLinks.map(link => document.querySelector(link.hash));
let navFrame = 0;
function updateNavigation() {
  navFrame = 0;
  siteHeader.classList.toggle('is-scrolled', scrollY > 30);
  const threshold = siteHeader.getBoundingClientRect().height + 100;
  let current = navSections[0];
  for (const section of navSections) {
    if (section.getBoundingClientRect().top <= threshold) current = section;
  }
  navLinks.forEach(link => {
    if (link.hash === `#${current.id}`) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  });
}
addEventListener('scroll', () => { if (!navFrame) navFrame = requestAnimationFrame(updateNavigation); }, {passive:true});
addEventListener('resize', updateNavigation);
updateNavigation();

const menuToggle = $('.menu-toggle');
const studioMenu = $('#studio-menu');
const menuBackdrop = $('.menu-backdrop');
const menuBackground = $$('main, footer');
function setMenu(open, restoreFocus = true) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
  studioMenu.hidden = !open;
  menuBackdrop.hidden = !open;
  document.body.classList.toggle('menu-open', open);
  document.dispatchEvent(new CustomEvent('mtrp:menuchange', {detail:{open}}));
  menuBackground.forEach(element => { element.inert = open; });
  if (open) navLinks[0].focus({preventScroll:true});
  else if (restoreFocus) menuToggle.focus({preventScroll:true});
}
menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
menuBackdrop.addEventListener('click', () => setMenu(false));
$('.nav-store').addEventListener('click', () => setMenu(false));
navLinks.forEach(link => link.addEventListener('click', () => {
  setMenu(false, false);
  const section = document.querySelector(link.hash);
  section.setAttribute('tabindex', '-1');
  section.focus({preventScroll:true});
}));
document.addEventListener('keydown', event => {
  if (menuToggle.getAttribute('aria-expanded') !== 'true') return;
  if (event.key === 'Escape') { event.preventDefault(); setMenu(false); }
  if (event.key === 'Tab') {
    const items = [$('.brand'), menuToggle, ...navLinks, $('.nav-store')];
    const index = items.indexOf(document.activeElement);
    event.preventDefault();
    items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length].focus();
  }
});
$('.brand').addEventListener('click', () => {
  if (menuToggle.getAttribute('aria-expanded') === 'true') setMenu(false, false);
});

;
/* ===== intro.js ===== */
(() => {
  'use strict';
  const screen = document.querySelector('#intro');
  const loader = screen.querySelector('.intro-loader');
  const meter = screen.querySelector('.intro-loading-line');
  const counter = screen.querySelector('.intro-percent');
  const titles = [...screen.querySelectorAll('.intro-title')];
  const audio = document.querySelector('#brand-audio');
  const soundEnable = screen.querySelector('.intro-audio-enable');
  const background = [...document.querySelectorAll('.site-header, main, footer, .skip-link')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const cues = [[.48,.82],[.84,1.08],[1.09,2.22],[2.42,3.36],[3.39,4.53]];
  const duration = 5.18;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let mode = 'loading', generation = 0, frame, cue = -1;
  let silent = false, silentStart = 0, previousFrame = 0, mediaTime = 0, mediaStall = 0;
  let ready = false, completed = 0, completionTarget = 0, progress = 0;
  let restoreFocus;
  function setActive(active) {
    document.body.classList.toggle('intro-active', active);
    background.forEach(element => { element.inert = active; });
    document.dispatchEvent(new CustomEvent('mtrp:introstate', {detail:{active}}));
  }
  function showCue(index) {
    if (cue === index) return;
    cue = index;
    titles.forEach((title, i) => {
      title.classList.toggle('is-visible', i === index);
      title.setAttribute('aria-hidden', String(i !== index));
    });
    screen.dataset.cue = String(index);
  }
  function useSilentClock(time = 0) {
    audio.pause(); silent = true;
    silentStart = performance.now() - time * 1000;
    screen.dataset.audio = 'silent';
    soundEnable.hidden = !!audio.error;
  }
  function render(now) {
    if (mode !== 'playing') return;
    const delta = Math.min(now - previousFrame, 100);
    previousFrame = now;
    const time = silent ? (now - silentStart) / 1000 : audio.currentTime;
    if (!silent && !document.hidden) {
      mediaStall = Math.abs(time - mediaTime) < .001 ? mediaStall + delta : 0;
      mediaTime = time;
      if (mediaStall > 1500) useSilentClock(time);
    }
    showCue(cues.findIndex(([start,end]) => time >= start && time < end));
    if (time >= duration || (!silent && audio.ended)) { finish(); return; }
    frame = requestAnimationFrame(render);
  }
  async function play() {
    const token = generation;
    mode = 'starting'; silent = false; audio.currentTime = 0; audio.volume = 1;
    const started = await Promise.race([audio.play().then(() => {
      delete screen.dataset.audioError;
      return true;
    }, error => {
      screen.dataset.audioError = error.name;
      return false;
    }),wait(1500).then(() => false)]);
    if (token !== generation) { audio.pause(); return; }
    if (!started) useSilentClock();
    mode = 'playing'; screen.dataset.state = 'playing';
    screen.dataset.audio = silent ? 'silent' : 'playing';
    loader.classList.add('is-away');
    if (silent) silentStart = performance.now();
    previousFrame = performance.now(); mediaTime = audio.currentTime; mediaStall = 0;
    frame = requestAnimationFrame(render);
  }
  async function finish() {
    if (mode === 'done' || mode === 'ending') return;
    mode = 'ending'; screen.dataset.state = 'ending'; generation++;
    if(window.MT_ASSETS)await window.MT_ASSETS.heroReady;
    soundEnable.hidden = true;
    cancelAnimationFrame(frame); audio.pause(); showCue(-1);
    document.body.classList.add('intro-reveal', 'experience-ready');
    document.dispatchEvent(new CustomEvent('mtrp:introreveal'));
    screen.classList.add('is-ending');
    await wait(motion.matches ? 100 : 650);
    screen.hidden = true; mode = 'done'; screen.dataset.state = 'done';
    setActive(false);
    (restoreFocus || document.querySelector('.hero')).focus({preventScroll:true});
    document.body.classList.add('experience-ready');
    document.body.classList.remove('intro-reveal');
  }
  function paintProgress(value) {
    progress = value;
    const rounded = Math.floor(value);
    counter.textContent = String(rounded).padStart(3,'0');
    meter.setAttribute('aria-valuenow', String(rounded));
    screen.style.setProperty('--load-progress', `${value}%`);
    screen.style.setProperty('--load-fraction', String(value / 100));
    screen.querySelector('.intro-load-status').textContent = value < 48 ? 'DRAWING THE MARK' : value < 99 ? 'BRINGING IT TO LIFE' : 'WELCOME TO YOUR NEXT CHAPTER';
  }
  async function load() {
    const token = ++generation;
    mode = 'loading'; screen.dataset.state = 'loading'; setActive(true);
    screen.focus({preventScroll:true});
    const resources = window.MT_ASSETS ? [window.MT_ASSETS.introReady] : [document.fonts.load('16px Serpentine'),screen.querySelector('.intro-logo').decode(), ...[...document.querySelectorAll('#home img')].map(image => image.decode())];
    const resourcesReady = Promise.allSettled(resources.map(resource => resource.finally(() => { completionTarget = ++completed / resources.length * 100; })));
    Promise.race([resourcesReady,wait(6000)]).then(() => { ready = true; completionTarget = 100; });
    const started = performance.now(), minimum = motion.matches ? 600 : 1800;
    let lastLoadFrame = started;
    await new Promise(resolve => {
      function loadingFrame(now) {
        if (token !== generation) { resolve(); return; }
        // Counts asset preparation plus the logo's draw/fill initialization.
        const phase = Math.min((now - started) / minimum, 1);
        const visualProgress = (phase * phase * (3 - 2 * phase)) * 100;
        const target = Math.min(visualProgress, ready ? 100 : Math.min(completionTarget,94));
        const delta = Math.min(now - lastLoadFrame, 50);
        lastLoadFrame = now;
        const eased = progress + Math.max(0, target - progress) * (1 - Math.exp(-delta / 135));
        const next = target === 100 && eased > 99.97 ? 100 : eased;
        paintProgress(next);
        if (next >= 100) resolve(); else frame = requestAnimationFrame(loadingFrame);
      }
      frame = requestAnimationFrame(loadingFrame);
    });
    if (token !== generation) return;
    await wait(240); await play();
  }
  audio.addEventListener('ended', () => { if (mode === 'playing' && !silent) finish(); });
  // Browsers may require a real interaction before permitting audible playback.
  let unlocking = false;
  async function unlockSound() {
    if (unlocking || (mode !== 'loading' && !(mode === 'playing' && silent))) return;
    unlocking = true;
    const duringLoad = mode === 'loading';
    if (duringLoad) audio.volume = 0;
    else {
      audio.volume = 1;
      audio.currentTime = Math.min((performance.now() - silentStart) / 1000, duration);
    }
    try {
      await audio.play();
      if (duringLoad && mode === 'loading') { audio.pause(); audio.currentTime = 0; }
      else if (mode === 'playing') {
        silent = false; screen.dataset.audio = 'playing';
        soundEnable.hidden = true;
        mediaStall = 0; mediaTime = audio.currentTime;
      } else if (mode === 'done' || mode === 'ending') audio.pause();
    } catch { /* Keep the visual sequence running when audio is blocked. */ }
    finally { audio.volume = 1; unlocking = false; }
  }
  screen.addEventListener('pointerdown', unlockSound);
  screen.addEventListener('click', unlockSound);
  screen.addEventListener('touchend', unlockSound, {passive:true});
  soundEnable.addEventListener('click', unlockSound);
  screen.addEventListener('keydown', unlockSound);
  screen.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      event.preventDefault();
      (soundEnable.hidden ? screen : soundEnable).focus({preventScroll:true});
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (silent || mode !== 'playing') return;
    if (document.hidden) audio.pause();
    else audio.play().catch(() => useSilentClock(audio.currentTime));
  });
  load();
})();

;
/* ===== stories.js ===== */
(() => {
  'use strict';
  const roles = {
    police: {title:'POLICE', kicker:'PROTECT THE CITY', image:'police-bintallal.webp', description:'احمِ المدينة، واصنع حكايتك على جانب القانون.', paths:['دوريات وبلاغات','قضايا وتحقيقات','عمل جماعي']},
    medic: {title:'MEDIC', kicker:'EVERY SECOND COUNTS', image:'medic.webp', description:'كن الأمل حين تحتاجك المدينة. كل ثانية تصنع فرقًا.', paths:['استجابة للبلاغات','إنقاذ وطوارئ','فريق المستشفى']},
    criminal: {title:'CRIMINAL', kicker:'LIVE ON THE EDGE', image:'criminal.webp', description:'عش على حافة المخاطرة. كل قرار يترك أثرًا.', paths:['تحالفات','تخطيط وصفقات','مخاطرة وعواقب']},
    citizen: {title:'CITIZEN', image:'citizen.webp', kicker:'BUILD YOUR OWN WORLD', description:'حياة بطريقتك. اصنع مكانك في المدينة.', paths:['مهن وأعمال','مشاريع','علاقات وحكايات']}
  };
  const dialog = document.querySelector('.story-dialog');
  const panel = dialog.querySelector('.story-panel');
  const stage = dialog.querySelector('.story-flight');
  const turner = dialog.querySelector('.story-turner');
  const close = dialog.querySelector('.story-close');
  const apply = document.createElement('a');
  apply.className = 'story-apply';
  apply.href = 'https://discord.gg/mt';
  apply.target = '_blank';
  apply.rel = 'noopener noreferrer';
  apply.innerHTML = '<span>قدّم الآن<small>التقديم عبر ديسكورد RT</small></span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  apply.hidden = true;
  panel.querySelector('.story-detail-footer').before(apply);
  const composition = document.createElement('div');
  composition.className = 'story-content';
  ['.story-detail-top','.story-detail-art','.story-detail-copy'].forEach(selector => composition.append(panel.querySelector(selector)));
  panel.append(composition);
  const ranks = {police:['01','♠'],medic:['02','♥'],criminal:['03','♣'],citizen:['04','♦']};
  const rank = document.createElement('span');
  rank.className = 'story-detail-rank'; rank.setAttribute('aria-hidden','true'); panel.append(rank);
  function fitStory() {
    if (!dialog.open) return;
    const height = composition.scrollHeight;
    const scale = Math.min(1, panel.clientHeight / Math.max(1,height));
    composition.style.setProperty('--story-fit', String(scale));
    composition.style.setProperty('--story-offset', `${Math.min(12,Math.max(0,(panel.clientHeight-height*scale)/2))}px`);
  }
  if ('ResizeObserver' in window) {
    const sizing = new ResizeObserver(fitStory);
    sizing.observe(panel); sizing.observe(composition);
  }
  document.fonts?.ready.then(fitStory);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let origin, returnFocus, flight, rotation, closing = false, preparing = false;
  // Reuse decoded artwork so opening a card never waits for a fresh image layer.
  const artwork = new Map(Object.entries(roles).map(([key, role]) => {
    const image = document.createElement(role.image ? 'img' : 'span');
    if (role.image) { image.src = `assets/images/${role.image}`; image.alt = ''; image.decode().catch(() => {}); }
    else image.textContent = 'RT';
    return [key, image];
  }));
  function originTransform() {
    const from = origin.getBoundingClientRect();
    return `translate(${from.x+from.width/2-dialog.clientWidth/2}px,${from.y+from.height/2-dialog.clientHeight/2}px) rotateZ(${getComputedStyle(origin).getPropertyValue('--angle')}) scale(${origin.offsetWidth/stage.offsetWidth},${origin.offsetHeight/stage.offsetHeight})`;
  }
  async function openStory(button, opener = button) {
    if (dialog.open || preparing) return;
    preparing = true;
    origin = button; returnFocus = opener;
    const key = button.dataset.story, role = roles[key];
    rank.innerHTML = `${ranks[key][0]}<span>${ranks[key][1]}</span>`;
    apply.hidden = key !== 'police';
    stage.dataset.story = key;
    panel.querySelector('h2').textContent = role.title;
    panel.querySelector('.story-detail-eyebrow').textContent = role.kicker;
    panel.querySelector('p').textContent = role.description;
    panel.querySelector('ul').replaceChildren(...role.paths.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    const art = panel.querySelector('.story-detail-art');
    const image = artwork.get(key);
    if (role.image) await image.decode().catch(() => {});
    art.replaceChildren(image);
    document.body.classList.add('story-open');
    dialog.showModal(); panel.scrollTop = 0;
    fitStory();
    preparing = false;
    origin.style.visibility = 'hidden';
    const start = originTransform();
    if (!reduced.matches) {
      dialog.classList.add('is-animating');
      flight = stage.animate([{transform:start},{transform:'translate(0,0) rotateZ(0deg) scale(1)'}],{duration:1550,easing:'cubic-bezier(.22,.65,.18,1)',fill:'both'});
      rotation = turner.animate([{transform:'rotateY(0deg)'},{transform:'rotateY(360deg)'}],{duration:1550,easing:'cubic-bezier(.3,.05,.25,1)',fill:'both'});
      try { await Promise.all([flight.finished,rotation.finished]); } catch {}
    }
    if (dialog.open && !closing) {
      flight?.cancel(); rotation?.cancel(); dialog.classList.remove('is-animating');
      close.focus({preventScroll:true});
    }
  }
  async function closeStory() {
    if (!dialog.open || closing) return;
    closing = true;
    dialog.classList.add('is-animating');
    const currentFlight = getComputedStyle(stage).transform;
    const currentTurn = getComputedStyle(turner).transform;
    flight?.cancel(); rotation?.cancel();
    if (!reduced.matches) {
      flight = stage.animate([{transform:currentFlight,opacity:1},{transform:originTransform(),opacity:0}],{duration:450,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
      rotation = turner.animate([{transform:currentTurn},{transform:'rotateY(0deg)'}],{duration:400,easing:'ease-out',fill:'both'});
      try { await Promise.all([flight.finished,rotation.finished]); } catch {}
    }
    dialog.close(); document.body.classList.remove('story-open');
    flight?.cancel(); rotation?.cancel(); dialog.classList.remove('is-animating');
    origin.style.visibility = ''; returnFocus.focus({preventScroll:true}); closing = false;
  }
  document.querySelectorAll('.story-card').forEach(button => {
    const portrait = document.createElement('span'); portrait.className = 'story-card-portrait';
    const nodes = ['img'];
    nodes.forEach(selector => portrait.append(button.querySelector(selector))); button.append(portrait);
    const reverse = document.createElement('span'); reverse.className = 'story-corner story-corner-opposite'; reverse.setAttribute('aria-hidden','true');
    const [number,suit] = ranks[button.dataset.story]; reverse.innerHTML = `${number}<span>${suit}</span>`; button.append(reverse);
    const foil = document.createElement('span'); foil.className = 'story-foil'; foil.setAttribute('aria-hidden','true'); button.append(foil);
    button.addEventListener('click', () => openStory(button));
  });
  document.querySelectorAll('[data-story-open]').forEach(button => {
    button.addEventListener('click', () => openStory(document.querySelector(`.story-card[data-story="${button.dataset.storyOpen}"]`), button));
  });
  close.addEventListener('click',closeStory);
  dialog.addEventListener('cancel',event => {event.preventDefault();closeStory();});
  dialog.addEventListener('click',event => {if(event.target === dialog) closeStory();});

  // Visual glitch only; the navbar intentionally has no sound.
  const brand = document.querySelector('.brand');
  let glitchTimer;
  function glitch(){
    brand.classList.remove('is-glitching'); void brand.offsetWidth;
    brand.classList.add('is-glitching');clearTimeout(glitchTimer);
    glitchTimer=setTimeout(()=>brand.classList.remove('is-glitching'),700);
  }
  brand.addEventListener('pointerenter',glitch);
  brand.addEventListener('focus',glitch);
  document.addEventListener('mtrp:menuchange',glitch);
})();


;
/* ===== memory-viewer.js ===== */
(() => {
  'use strict';
  const events = window.MT_MEMORIES || [];
  const section = document.querySelector('.memories-section');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = document.createElement('dialog');
  dialog.className = 'memory-dialog';
  dialog.setAttribute('aria-labelledby', 'memory-detail-title');
  dialog.innerHTML = `<article class="memory-sheet"><header class="memory-sheet-top"><span><i aria-hidden="true"></i> THE MEMORY ARCHIVE</span><button type="button" class="memory-close" aria-label="إغلاق الذكرى">×</button><span class="memory-reading-progress" aria-hidden="true"></span></header><div class="memory-editorial"><div class="memory-visual"><img class="memory-cover" alt=""><div class="memory-visual-tag"><span>RULES TOWN</span><span>ARCHIVED MOMENT ↗</span></div></div><div class="memory-copy"><span class="memory-label"></span><h2 id="memory-detail-title"></h2><div class="memory-blocks" dir="rtl"></div><div class="memory-sheet-foot"><img src="assets/images/mt-logo.png" alt="RT" width="38" height="38"></div></div></div></article>`;
  document.body.append(dialog);
  const sheet = dialog.querySelector('.memory-sheet');
  const cover = dialog.querySelector('.memory-cover');
  const close = dialog.querySelector('.memory-close');
  let origin, closing = false, opening = false, animations = [];
  const covers = new Map(events.map(event => {
    const image = new Image(); image.decoding = 'async';
    return [event.id, image];
  }));
  function cancelAnimations() { animations.forEach(animation => animation.cancel()); animations = []; }
  function animate(element, frames, options) {
    const animation = element.animate(frames, {fill: 'both', ...options});
    animations.push(animation); return animation.finished.catch(() => {});
  }
  function renderBlock(block) {
    if (block.type === 'text' || block.type === 'heading') {
      const node = document.createElement(block.type === 'text' ? 'p' : 'h3');
      node.textContent = block.text || ''; return node;
    }
    if (block.type !== 'image' && block.type !== 'video') return document.createDocumentFragment();
    const figure = document.createElement('figure');
    const media = document.createElement(block.type === 'video' ? 'video' : 'img');
    media.src = block.src;
    if (block.type === 'video') { media.controls = true; media.preload = 'metadata'; media.playsInline = true; if (block.poster) media.poster = block.poster; }
    else { media.alt = block.alt || ''; media.loading = 'lazy'; }
    figure.append(media);
    if (block.caption) { const caption = document.createElement('figcaption'); caption.textContent = block.caption; figure.append(caption); }
    return figure;
  }
  async function openMemory(button) {
    if (dialog.open || opening) return;
    const event = events.find(item => item.id === button.dataset.memory);
    if (!event) return;
    opening = true; origin = button;
    const prepared = covers.get(event.id); prepared.src = event.cover;
    await prepared.decode().catch(() => {});
    const from = button.closest('.memory-frame').getBoundingClientRect();
    cover.src = event.cover; cover.alt = event.title;
    dialog.querySelector('h2').textContent = event.title;
    dialog.querySelector('.memory-label').textContent = event.label;
    dialog.querySelector('.memory-blocks').replaceChildren(...(event.blocks || []).map(renderBlock));
    document.body.classList.add('memory-open');
    sheet.classList.toggle('has-story',Boolean(event.blocks?.length));
    dialog.showModal(); sheet.scrollTop = 0; opening = false;
    sheet.style.setProperty('--reading-progress','0%');
    if (!reduced.matches) {
      const to = sheet.getBoundingClientRect();
      const dx = Math.max(-innerWidth * .35, Math.min(innerWidth * .35, from.x + from.width / 2 - to.x - to.width / 2));
      const dy = Math.max(-innerHeight * .25, Math.min(innerHeight * .25, from.y + from.height / 2 - to.y - to.height / 2));
      await Promise.all([
        animate(sheet, [{transform:`translate(${dx}px,${dy}px) scale(.78)`,opacity:0},{transform:'translate(0,0) scale(1)',opacity:1}], {duration:760,easing:'cubic-bezier(.16,1,.3,1)'}),
        animate(cover, [{clipPath:'inset(10% 0 10% 0)',opacity:0},{clipPath:'inset(0)',opacity:1}], {duration:800,delay:70,easing:'cubic-bezier(.2,.7,.15,1)'}),
        animate(dialog.querySelector('.memory-copy'), [{transform:'translateY(24px)',opacity:0},{transform:'translateY(0)',opacity:1}], {duration:580,delay:220,easing:'cubic-bezier(.16,1,.3,1)'})
      ]);
    }
    if (dialog.open && !closing) { cancelAnimations(); close.focus({preventScroll:true}); }
  }
  async function closeMemory() {
    if (!dialog.open || closing) return;
    closing = true;
    const transform = getComputedStyle(sheet).transform;
    const opacity = getComputedStyle(sheet).opacity;
    cancelAnimations();
    dialog.querySelectorAll('video').forEach(video => video.pause());
    if (!reduced.matches) await animate(sheet,[{transform,opacity},{transform:'translateY(22px) scale(.97)',opacity:0}],{duration:260,easing:'ease-in'});
    dialog.close(); cancelAnimations(); document.body.classList.remove('memory-open');
    const focusTarget = origin?.closest('[aria-hidden="true"]')
      ? section.querySelector(`.memory-group:first-child [data-memory="${origin.dataset.memory}"]`) : origin;
    focusTarget?.focus({preventScroll:true}); closing = false;
  }
  section.querySelectorAll('.memory-group:first-child .memory-frame').forEach((frame, index) => {
    const event = events[index]; if (!event) return;
    const photo = frame.querySelector('.memory-photo img');
    if(window.MT_ASSETS)window.MT_ASSETS.deferImage(photo,event.cover);else photo.src=event.cover; photo.alt = event.title;
    frame.querySelector('figcaption > span').textContent = event.title;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'memory-open-button'; button.dataset.memory = event.id;
    button.setAttribute('aria-label', `فتح ذكرى ${event.title}`); button.setAttribute('aria-haspopup', 'dialog');
    frame.append(button);
    const preload = () => covers.get(event.id).decode().catch(() => {});
    button.addEventListener('pointerenter', preload, {once:true});
    button.addEventListener('focus', preload, {once:true});
  });
  section.addEventListener('click', event => {const button = event.target.closest('.memory-open-button'); if (button) openMemory(button);});
  sheet.addEventListener('scroll',()=>{const distance=sheet.scrollHeight-sheet.clientHeight;sheet.style.setProperty('--reading-progress',`${distance>0?sheet.scrollTop/distance*100:0}%`);},{passive:true});
  close.addEventListener('click', closeMemory);
  dialog.addEventListener('cancel', event => {event.preventDefault(); closeMemory();});
  dialog.addEventListener('click', event => {if(event.target === dialog) closeMemory();});
})();

;
/* ===== memories.js ===== */
(() => {
  'use strict';
  const section = document.querySelector('.memories-section');
  const group = section.querySelector('.memory-group');
  const duplicate = group.cloneNode(true);
  duplicate.setAttribute('aria-hidden','true');
  duplicate.querySelectorAll('button').forEach(button => button.tabIndex = -1);
  section.querySelector('.memory-track').append(duplicate);
  const observer = new IntersectionObserver(entries => section.classList.toggle('is-offscreen',!entries[0].isIntersecting));
  observer.observe(section);

  // A fixed short thumb preserves dragging, track clicks and keyboard scrolling.
  const bar = document.createElement('div');
  bar.className = 'page-scrollbar'; bar.tabIndex = 0;
  bar.setAttribute('role','scrollbar'); bar.setAttribute('aria-label','تمرير الصفحة');
  bar.setAttribute('aria-controls','main'); bar.setAttribute('aria-orientation','vertical');
  bar.setAttribute('aria-valuemin','0'); bar.setAttribute('aria-valuemax','100');
  const thumb = document.createElement('span'); thumb.className = 'page-scroll-thumb';
  bar.append(thumb); document.body.append(bar); document.documentElement.classList.add('custom-scrollbar');
  let scrollFrame = 0, grab = null;
  const maxScroll = () => Math.max(0,document.documentElement.scrollHeight-innerHeight);
  function updateBar() {
    scrollFrame = 0;
    const max = maxScroll(), travel = Math.max(0,bar.clientHeight-thumb.offsetHeight);
    const ratio = max ? Math.max(0,Math.min(1,scrollY/max)) : 0;
    bar.hidden = !max; thumb.style.transform = `translateY(${ratio*travel}px)`;
    bar.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
  }
  function queueBar() {if (!scrollFrame) scrollFrame = requestAnimationFrame(updateBar);}
  addEventListener('scroll',queueBar,{passive:true}); addEventListener('resize',queueBar);
  new ResizeObserver(queueBar).observe(document.body); updateBar();
  function scrollFromPointer(event) {
    const travel = bar.clientHeight-thumb.offsetHeight;
    const ratio = Math.max(0,Math.min(1,(event.clientY-bar.getBoundingClientRect().top-grab)/travel));
    scrollTo({top:ratio*maxScroll(),behavior:'instant'});
  }
  bar.addEventListener('pointerdown',event => {
    if(event.button !== 0) return;
    event.preventDefault(); bar.focus({preventScroll:true});
    const rect = thumb.getBoundingClientRect();
    grab = event.clientY >= rect.top && event.clientY <= rect.bottom ? event.clientY-rect.top : rect.height/2;
    bar.setPointerCapture(event.pointerId); scrollFromPointer(event);
  });
  bar.addEventListener('pointermove',event => {if(grab !== null) scrollFromPointer(event);});
  bar.addEventListener('pointerup',()=>{grab=null;}); bar.addEventListener('lostpointercapture',()=>{grab=null;});
  bar.addEventListener('keydown',event => {
    const keys = {ArrowDown:80,ArrowUp:-80,PageDown:innerHeight*.85,PageUp:-innerHeight*.85,Home:-maxScroll(),End:maxScroll()};
    if (!(event.key in keys)) return;
    event.preventDefault(); scrollTo({top:Math.max(0,Math.min(maxScroll(),scrollY+keys[event.key])),behavior:'instant'});
  });

  // Keep the native cursor. A small orange satellite follows it with a fading trail.
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const canvas = document.createElement('canvas'); canvas.className = 'cursor-trail'; canvas.setAttribute('aria-hidden','true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let x=0,y=0,tx=0,ty=0,visible=false,raf=0,last=0,points=[],radius=3.5,targetRadius=3.5;
  function updateTarget(element) {
    targetRadius = element instanceof Element && element.closest('a,button:not(:disabled),[role="button"],[role="scrollbar"],summary,input,select,textarea,video') ? 17 : 3.5;
    if (visible && !raf) raf = requestAnimationFrame(draw);
  }
  document.addEventListener('pointerover',event=>updateTarget(event.target),{passive:true});
  document.addEventListener('scroll',()=>{if(visible) updateTarget(document.elementFromPoint(tx,ty));},{passive:true,capture:true});
  function resizeTrail() {const dpr=Math.min(devicePixelRatio||1,2); canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  function clearTrail() {visible=false;points=[];cancelAnimationFrame(raf);raf=0;ctx.clearRect(0,0,innerWidth,innerHeight);}
  function draw(now) {
    raf=0;
    if(!visible || motion.matches || !fine.matches) return clearTrail();
    const dt=Math.min(40,now-last||16);last=now;
    const ease=1-Math.exp(-dt/95); x+=(tx-x)*ease; y+=(ty-y)*ease;
    radius+=(targetRadius-radius)*(1-Math.exp(-dt/90));
    if(!points.length || Math.hypot(x-points[points.length-1].x,y-points[points.length-1].y)>.45) points.push({x,y,t:now});
    points=points.filter(p=>now-p.t<520);
    ctx.clearRect(0,0,innerWidth,innerHeight);ctx.lineWidth=1;ctx.lineCap='round';
    for(let i=1;i<points.length;i++) {ctx.strokeStyle=`rgba(255,36,43,${.65*Math.max(0,1-(now-points[i].t)/520)})`;ctx.beginPath();ctx.moveTo(points[i-1].x,points[i-1].y);ctx.lineTo(points[i].x,points[i].y);ctx.stroke();}
    const expanded=Math.max(0,Math.min(1,(radius-3.5)/13.5));
    ctx.fillStyle=`rgba(255,40,47,${1-expanded*.93})`;ctx.strokeStyle='#ff4248';ctx.shadowColor='#ff282f50';ctx.shadowBlur=7;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    if(Math.hypot(tx-x,ty-y)>.1 || points.length>1 || Math.abs(radius-targetRadius)>.05) raf=requestAnimationFrame(draw);
  }
  document.addEventListener('pointermove',event => {
    if(event.pointerType==='touch' || motion.matches || !fine.matches) return;
    tx=event.clientX;ty=event.clientY;
    updateTarget(event.target);
    if(!visible){x=tx;y=ty;visible=true;last=performance.now();}
    if(!raf) raf=requestAnimationFrame(draw);
  },{passive:true});
  document.addEventListener('pointerout',event=>{if(!event.relatedTarget)clearTrail();});
  addEventListener('blur',clearTrail);addEventListener('resize',resizeTrail);
  motion.addEventListener('change',clearTrail);fine.addEventListener('change',clearTrail);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTrail();});
  // Native modal dialogs live above ordinary z-index layers.
  const dialogObserver = new MutationObserver(() => {
    const host=document.querySelector('dialog[open]')||document.body;
    if(canvas.parentElement!==host) host.append(canvas);
  });
  document.querySelectorAll('dialog').forEach(dialog => dialogObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
  resizeTrail();
})();


;
/* ===== memory-input.js ===== */
(() => {
  const section = document.querySelector('.memories-section');
  // Focus restored after a mouse click must not freeze the carousel.
  // Keyboard visitors can still hold it steady while tabbing through the cards.
  const usePointer = () => section.classList.remove('is-keyboard-nav');
  document.addEventListener('pointerdown', usePointer, {passive:true});
  document.addEventListener('pointermove', usePointer, {passive:true});
  document.addEventListener('keydown', event => {
    if (['Tab','ArrowLeft','ArrowRight','Enter',' '].includes(event.key)) section.classList.add('is-keyboard-nav');
  });
})();

;
/* ===== scroll-motion.js ===== */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let target = scrollY, frame = 0, previous = 0;
  const limit = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
  function stop() { cancelAnimationFrame(frame); frame = 0; target = scrollY; }
  function step(now) {
    const dt = Math.min(40, now - previous || 16); previous = now;
    target = Math.max(0, Math.min(limit(), target));
    const distance = target - scrollY;
    if (Math.abs(distance) < .8) { scrollTo({top:target,behavior:'instant'}); frame = 0; return; }
    scrollTo({top:scrollY + distance * (1 - Math.exp(-dt / 115)),behavior:'instant'});
    frame = requestAnimationFrame(step);
  }
  addEventListener('wheel', event => {
    if (reduced.matches || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.defaultPrevented || !event.cancelable) return;
    if (document.body.matches('.intro-active,.menu-open,.story-open,.memory-open,.dossier-open')) {stop();return;}
    // Nested content, controls and native modal scrolling keep their own behaviour.
    for(let node = event.target instanceof Element ? event.target : null; node && node !== document.body; node = node.parentElement) {
      if (node.matches('input,textarea,select,video,[contenteditable=true]')) return;
      if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return;
    }
    if (!limit()) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    if (!frame) target = scrollY;
    target = Math.max(0,Math.min(limit(), target + event.deltaY * unit * .86));
    if (!frame) {previous = performance.now(); frame = requestAnimationFrame(step);}
  }, {passive:false});
  addEventListener('pointerdown', stop, {passive:true});
  addEventListener('touchstart', stop, {passive:true});
  addEventListener('keydown', stop);
  addEventListener('hashchange', stop);
  addEventListener('resize', stop);
  document.addEventListener('click', stop);
  document.addEventListener('mtrp:dossierstate', stop);
  reduced.addEventListener('change', stop);
  document.addEventListener('visibilitychange', () => {if (document.hidden) stop();});
})();

;
/* ===== city-access.js ===== */
(() => {
  'use strict';
  const section = document.querySelector('.city-access');
  const status = section.querySelector('.access-status');
  section.querySelector('.access-connect').addEventListener('click', () => {
    // Native link only. No endpoint, copy command or address-bearing fallback text.
    status.textContent = 'يُفتح الرابط عبر FiveM المثبّت على جهازك.';
    section.classList.add('is-torn');
  });
  section.classList.add('is-enhanced');
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) section.classList.add('has-arrived');
  }, {threshold:.12}).observe(section);
})();

;
/* ===== wordmark.js ===== */
(() => {
  'use strict';
  const wordmark=document.querySelector('.wordmark-art');
  if(!wordmark)return;
  const glyphs=[...wordmark.querySelectorAll('.wordmark-glyph')];
  if(!glyphs.length)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=false,revealed=true,timer=0,release=0,active=[],last=-1;
  function stop(){
    clearTimeout(timer);clearTimeout(release);timer=release=0;
    active.forEach(glyph=>glyph.classList.remove('is-auto-filled'));active=[];
  }
  function schedule(delay=2600+Math.random()*2200){
    clearTimeout(timer);
    if(!visible||!revealed||document.hidden||reduced.matches)return;
    timer=setTimeout(()=>{
      let index=Math.floor(Math.random()*glyphs.length);
      if(index===last)index=(index+1)%glyphs.length;
      last=index;
      // A rotated, spaced group keeps five letters distributed across both words.
      active=Array.from({length:Math.min(5,glyphs.length)},(_,offset)=>glyphs[(index+offset*2)%glyphs.length]);
      active.forEach(glyph=>glyph.classList.add('is-auto-filled'));
      release=setTimeout(()=>{active.forEach(glyph=>glyph.classList.remove('is-auto-filled'));active=[];release=0;},850);
      schedule();
    },delay);
  }
  function sync(){stop();schedule(900);}
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{threshold:.15}).observe(wordmark);
  document.addEventListener('visibilitychange',sync);
  document.addEventListener('mtrp:footerreveal',event=>{revealed=event.detail.visible;sync();});
  reduced.addEventListener('change',sync);
  addEventListener('pagehide',stop);
  addEventListener('pageshow',sync);
  const brand=document.querySelector('.footer-brand');
  let glitchTimer;
  function glitch(){
    if(reduced.matches)return;
    clearTimeout(glitchTimer);brand.classList.remove('is-glitching');void brand.offsetWidth;
    brand.classList.add('is-glitching');
    glitchTimer=setTimeout(()=>brand.classList.remove('is-glitching'),700);
  }
  brand?.addEventListener('pointerenter',glitch);
  brand?.addEventListener('focus',glitch);
})();

;
/* ===== pixel-buttons.js ===== */
(() => {
  'use strict';
  const selector = '.primary-button,.access-connect,.footer-discord,.story-apply,.pixel-button,[data-pixel-button]';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Two-row opacity fields sampled from the user's 30 fps reference clip.
  // Interpolate the fields continuously; paint integer pixel boundaries without overlap.
  const decode = rows => rows.map(row => row.match(/../g).map(v => parseInt(v,16)/255));
  const arrival = decode(["0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","0e000f000e00000000000000000000000000000000002800000e000000000000000000000000000000000000","0e000f000e00000000000000000000000000000000002800000e000000000000000000000000000000000000","4b253d18330e0e000e00000000000000000000000000802819410e0000000000000000000000000000000000","4b253d18330e0e000e00000000000000000000000000802819410e0000000000000000000000000000000000","b280a5719a414127333319000c000000000000000000d78871a54c27270c2600271900000000000000000000","d8b3cba5cb72754c5a5b330e1900000e000000000000f1beb3cb80415b274b0e4c320e0e00000e0000000000","d8b3cba5cb72754c5a5b330e1900000e000000000000f1beb3cb80415b274b0e4c320e0e00000e0000000000","fff3fff3f3d8d8c0c0c0993366273333190e000e0e00fff1f1fed8b3c080b24dc09932331919330c19190000","fff3fff3f3d8d8c0c0c0993366273333190e000e0e00fff1f1fed8b3c080b24dc09932331919330c19190000","fffffffffffffff1f1f1e599cb7299a55a33194c3200fffffffefff1f1d8f1c0f1e599995b65a54c725b180e","ffffffffffffffffffffffe5f3d8e5e5c09966b39927fffffffefffffffffff1ffffe5e5cbcde5c0d8c05a41","ffffffffffffffffffffffe5f3d8e5e5c09966b39927fffffffefffffffffff1ffffe5e5cbcde5c0d8c05a41","fffffffffffffffffffffffffffffffff3e5cbf1e58dfffffffefffffffffffffffffffff3f3fff3fff1c0a6","fffffffffffffffffffffffffffffffffffff3ffffe7fffffffffffffffffffffffffffffffffffffffff1e6","fffffffffffffffffffffffffffffffffffff3ffffe7fffffffffffffffffffffffffffffffffffffffff1e6","fffffffffffffffffffffffffffffffffffffffffff5ffffffffffffffffffffffffffffffffffffffffffff","fffffffffffffffffffffffffffffffffffffffffff5ffffffffffffffffffffffffffffffffffffffffffff","ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"]);
  const departure = decode(["ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","d8f3e9f1e9ffffffffffffffffffffffffffffffffffb3f1f1e9ffffffffffffffffffffffffffffffffffff","d8f3e9f1e9ffffffffffffffffffffffffffffffffffb3f1f1e9ffffffffffffffffffffffffffffffffffff","80b399c0a5d8d8f3e7e7f3ffffffffffffffffffffff4da7c098d8f3e5fff2fff3f3ffffffffffffffffffff","80b399c0a5d8d8f3e7e7f3ffffffffffffffffffffff4da7c098d8f3e5fff2fff3f3ffffffffffffffffffff","284c335c338d8db3a5a5cdf3e7fffff3ffffffffffff0e424d3380c0a5d7b2f3b3cbf3f3fffff3ffffffffff","000e000e0e282841414166cd99d8cdcde7f3fff3f3ff000e0e00284d41804bb34166cdcde7e7cdf4e7e7ffff","000e000e0e282841414166cd99d8cdcde7f3fff3f3ff000e0e00284d41804bb34166cdcde7e7cdf4e7e7ffff","000000000000000e0e0e1a66338d665ba5cde5b3cbff00000000000e0e280b3f0e1d6666a5985cb38da5e5f4","000000000000000000000e331a4d41336699cd80a5ea000000000000000e001d000e4133655b33804d65cde9","000000000000000000000e331a4d41336699cd80a5ea000000000000000e001d000e4133655b33804d65cde9","00000000000000000000000e000e0e0e1a335b2841a70000000000000000000000000e0e1a1a0e290e1a6590","00000000000000000000000e000e0e0e1a335b2841a70000000000000000000000000e0e1a1a0e290e1a6590","00000000000000000000000000000000000e1a000e4100000000000000000000000000000000000000001a28","0000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000","0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"]);
  const installed = new WeakSet();
  function attach(button) {
    if (installed.has(button)) return;
    installed.add(button); button.classList.add('pixel-button');
    const canvas = document.createElement('canvas'); canvas.className='pixel-fill'; canvas.setAttribute('aria-hidden','true');button.append(canvas);
    const ctx = canvas.getContext('2d');
    let width=0,height=0,columns=1,cells=[],frame=0,start=0,target=0;
    function paint() {
      if (!ctx) return;
      ctx.clearRect(0,0,width,height);
      const cw=width/columns,ch=height/2;
      ctx.fillStyle='#ff282f';
      cells.forEach(cell=>{
        const left=Math.round(cell.x*cw),right=Math.round((cell.x+1)*cw);
        const top=Math.round(cell.y*ch),bottom=Math.round((cell.y+1)*ch);
        ctx.globalAlpha=cell.value;ctx.fillRect(left,top,right-left,bottom-top);
      });
      ctx.globalAlpha=1;
    }
    function resize() {
      width=button.clientWidth;height=button.clientHeight;
      const dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);
      columns=Math.max(1,Math.ceil(width/Math.max(12,height/2)));
      cells=Array.from({length:columns*2},(_,i)=>({x:i%columns,y:Math.floor(i/columns),value:target,from:target}));
      paint();
    }
    function tick(now) {
      const track=target?arrival:departure;
      const position=Math.min(track.length-1,Math.max(0,(now-start)*30/1000));
      const index=Math.floor(position),next=Math.min(index+1,track.length-1),mix=position-index;
      for (const cell of cells) {
        const sample=cell.y*22+Math.min(21,Math.floor((cell.x+.5)/columns*22));
        const opacity=track[index][sample]+(track[next][sample]-track[index][sample])*mix;
        cell.value=target?cell.from+(1-cell.from)*opacity:cell.from*opacity;
      }
      paint();frame=position===track.length-1?0:requestAnimationFrame(tick);
    }

    function change(value) {
      const next=Number(value);if(next===target)return;
      target=next;button.classList.toggle('is-pixel-active',Boolean(target));
      cancelAnimationFrame(frame);frame=0;
      button.classList.toggle('pixel-static',reduced.matches||!ctx);
      if(reduced.matches||!ctx){cells.forEach(cell=>cell.value=target);paint();return;}
      if(!width||!height)resize();
      cells.forEach(cell=>cell.from=cell.value);
      start=performance.now();frame=requestAnimationFrame(tick);
    }
    button.addEventListener('pointerenter',()=>change(true));
    button.addEventListener('pointerleave',()=>change(button.matches(':focus-visible')));
    button.addEventListener('focus',()=>change(true));
    button.addEventListener('blur',()=>change(button.matches(':hover')));
    reduced.addEventListener('change',()=>{
      cancelAnimationFrame(frame);frame=0;button.classList.toggle('pixel-static',reduced.matches||!ctx);
      cells.forEach(cell=>cell.value=target);paint();
    });
    new ResizeObserver(resize).observe(button);resize();
  }
  document.querySelectorAll(selector).forEach(attach);
  // New primary actions opt in with data-pixel-button or the shared pixel-button class.
  new MutationObserver(records=>{
    for(const record of records) for(const node of record.addedNodes) {
      if(!(node instanceof Element))continue;
      if(node.matches(selector))attach(node);
      node.querySelectorAll(selector).forEach(attach);
    }
  }).observe(document.body,{childList:true,subtree:true});
})();

;
/* ===== portal-shapes.js ===== */
window.MT_PORTAL_SHAPES={"O":{"path":"M91 -188Q80 -143 80 -109Q80 -52 111.5 -26.0Q143 0 206 0H572Q653 0 704.5 -44.0Q756 -88 781 -188L847 -452Q858 -498 858 -531Q858 -589 826.0 -614.5Q794 -640 732 -640H366Q284 -640 233.0 -596.0Q182 -552 157 -452ZM411 -493Q416 -515 430.0 -524.5Q444 -534 469 -534H575Q615 -534 615 -508Q615 -502 613 -493L527 -147Q521 -125 507.0 -115.5Q493 -106 468 -106H362Q323 -106 323 -132Q323 -138 325 -147Z","hole":"M411 -493Q416 -515 430.0 -524.5Q444 -534 469 -534H575Q615 -534 615 -508Q615 -502 613 -493L527 -147Q521 -125 507.0 -115.5Q493 -106 468 -106H362Q323 -106 323 -132Q323 -138 325 -147Z","em":1000,"cx":469.0,"cy":-320.0,"width":292,"height":428},"R":{"path":"M431 -534H569Q588 -534 595.5 -530.5Q603 -527 603 -516Q603 -509 600 -498L581 -420Q575 -398 565.5 -391.0Q556 -384 532 -384H394ZM442 -278 489 0H762Q751 -18 740 -69Q736 -85 733 -98L691 -278Q717 -280 733.5 -283.5Q750 -287 765.5 -296.5Q781 -306 793.5 -326.5Q806 -347 815 -381L844 -499Q852 -529 852 -551Q852 -600 818.0 -620.0Q784 -640 714 -640H188Q197 -620 197 -598Q197 -573 186 -530L81 -110Q71 -68 60.5 -44.5Q50 -21 34 0H318Q314 -19 314 -35Q314 -63 325 -110L367 -278Z","hole":"M431 -534H569Q588 -534 595.5 -530.5Q603 -527 603 -516Q603 -509 600 -498L581 -420Q575 -398 565.5 -391.0Q556 -384 532 -384H394Z","em":1000,"cx":498.5,"cy":-459.0,"width":209,"height":150}};
window.MT_HEADLINE_GLYPHS={"A":"M320 -278 472 -494 509 -278ZM525 -172 539 -90Q539 -88 540 -83Q541 -78 541 -75Q541 -59 537 -42Q534 -32 530.5 -25.5Q527 -19 512 0H833Q808 -38 799 -88L709 -640H420L439 -604L84 -116Q69 -95 59.0 -82.5Q49 -70 38.0 -57.5Q27 -45 14.0 -31.5Q1 -18 -18 0H163Q157 -18 157 -25Q157 -31 161 -46Q165 -66 179 -84L244 -172Z","B":"M367 -278H509Q528 -278 535.5 -274.5Q543 -271 543 -260Q543 -253 540 -242L515 -142Q510 -120 500.0 -113.0Q490 -106 466 -106H324ZM431 -534H573Q592 -534 599.5 -530.5Q607 -527 607 -516Q607 -509 604 -498L585 -420Q579 -398 569.5 -391.0Q560 -384 536 -384H394ZM81 -110Q71 -68 60.5 -44.5Q50 -21 34 0H558Q653 0 697.0 -33.5Q741 -67 757 -132L783 -238Q788 -256 788 -269Q788 -298 762.0 -310.0Q736 -322 668 -331V-333Q744 -339 781.0 -358.5Q818 -378 833 -435L851 -508Q857 -535 857 -554Q857 -596 825.0 -618.0Q793 -640 718 -640H194Q198 -621 198 -605Q198 -577 186 -530Z","C":"M750 -640H366Q284 -640 233.0 -596.0Q182 -552 157 -452L91 -188Q80 -143 80 -109Q80 -52 111.5 -26.0Q143 0 206 0H600L653 -130Q637 -123 626.0 -119.0Q615 -115 599.0 -112.0Q583 -109 560.0 -107.5Q537 -106 500 -106H362Q323 -106 323 -132Q323 -138 325 -147L411 -493Q416 -515 430.0 -524.5Q444 -534 469 -534H644Q676 -534 696.5 -530.0Q717 -526 738 -517Z","D":"M431 -534H558Q580 -534 588.0 -529.5Q596 -525 596 -512Q596 -503 591 -482L510 -158Q502 -125 491.5 -115.5Q481 -106 451 -106H324ZM81 -110Q71 -68 60.5 -44.5Q50 -21 34 0H531Q632 0 684.0 -41.5Q736 -83 760 -182L829 -458Q841 -503 841 -535Q841 -590 805.5 -615.0Q770 -640 691 -640H194Q198 -621 198 -605Q198 -577 186 -530Z","E":"M324 -106 367 -278H541Q577 -278 599.5 -274.0Q622 -270 646 -262L647 -261L682 -401H680Q651 -392 627.5 -388.0Q604 -384 568 -384H394L431 -534H630Q667 -534 689.5 -530.0Q712 -526 735 -518L737 -517L748 -640H194Q198 -621 198 -605Q198 -577 186 -530L81 -110Q71 -68 60.5 -44.5Q50 -21 34 0H598L651 -123Q623 -115 599.0 -110.5Q575 -106 536 -106Z","F":"M367 -278H541Q577 -278 599.5 -274.0Q622 -270 646 -262L647 -261L682 -401H680Q651 -392 627.5 -388.0Q604 -384 568 -384H394L431 -534H630Q668 -534 690.0 -529.5Q712 -525 736 -517L748 -640H194Q198 -621 198 -605Q198 -577 186 -530L81 -110Q71 -68 60.5 -44.5Q50 -21 34 0H318Q314 -19 314 -35Q314 -63 325 -110Z","G":"M430 -384 400 -266 402 -267Q427 -278 444 -278H535L503 -147Q497 -125 483.0 -115.5Q469 -106 444 -106H362Q323 -106 323 -132Q323 -138 325 -147L411 -493Q416 -515 430.0 -524.5Q444 -534 469 -534H728Q760 -534 780.5 -530.0Q801 -526 822 -517L834 -640H366Q284 -640 233.0 -596.0Q182 -552 157 -452L91 -188Q80 -143 80 -109Q80 -52 111.5 -26.0Q143 0 206 0H422Q469 0 488.5 -13.0Q508 -26 526 -59H528L521 0H736Q726 -25 726 -43Q726 -55 730.0 -75.0Q734 -95 741 -126L781 -284Q789 -318 798.5 -335.0Q808 -352 836 -384Z","H":"M394 -384 430 -530Q441 -572 451.5 -595.5Q462 -619 478 -640H194Q198 -621 198 -605Q198 -577 186 -530L81 -110Q71 -68 60.5 -44.5Q50 -21 34 0H318Q314 -19 314 -35Q314 -63 325 -110L367 -278H549L507 -110Q497 -68 486.5 -44.5Q476 -21 460 0H744Q740 -19 740 -35Q740 -63 751 -110L856 -530Q867 -572 877.5 -595.5Q888 -619 904 -640H620Q624 -621 624 -605Q624 -577 612 -530L576 -384Z","I":"M336 0Q332 -19 332 -35Q332 -63 343 -110L448 -530Q459 -572 469.5 -595.5Q480 -619 496 -640H212Q216 -621 216 -605Q216 -577 204 -530L99 -110Q89 -68 78.5 -44.5Q68 -21 52 0Z","J":"M105 -106Q64 -106 24 -123L13 0H330Q380 0 417.5 -6.5Q455 -13 487.0 -32.0Q519 -51 543.0 -88.5Q567 -126 582 -186L668 -530Q679 -572 689.5 -595.5Q700 -619 716 -640H432Q436 -621 436 -605Q436 -577 424 -530L338 -186Q326 -136 307.5 -121.0Q289 -106 248 -106Z","K":"M630 -451 780 -577Q808 -600 828.0 -612.0Q848 -624 876 -638L880 -640H657Q655 -624 653 -616Q649 -599 638.5 -584.5Q628 -570 601 -547L386 -353L430 -530Q441 -572 451.5 -595.5Q462 -619 478 -640H194Q198 -621 198 -605Q198 -577 186 -530L81 -110Q71 -68 60.5 -44.5Q50 -21 34 0H318Q314 -19 314 -35Q314 -63 325 -110L349 -206L424 -271L499 0H799Q781 -25 766.5 -59.5Q752 -94 739 -131Z","L":"M334 -106 440 -530Q451 -572 461.5 -595.5Q472 -619 488 -640H204Q208 -621 208 -605Q208 -577 196 -530L91 -110Q81 -68 70.5 -44.5Q60 -21 44 0H596L649 -127Q628 -116 597.0 -111.0Q566 -106 538 -106Z","M":"M561 -277H559L528 -640H192Q201 -619 201 -602Q201 -591 197.5 -573.0Q194 -555 187 -525L85 -115Q78 -88 73.0 -71.0Q68 -54 62.5 -42.0Q57 -30 50.0 -20.5Q43 -11 32 0H186Q177 -21 177 -38Q177 -58 191 -115L288 -504H290L336 0H505L808 -504H810L711 -110Q701 -68 690.5 -44.5Q680 -21 664 0H949Q944 -19 944 -37Q944 -64 955 -110L1060 -530Q1071 -573 1082.0 -596.0Q1093 -619 1109 -640H782Z","N":"M426 0H742L873 -525Q880 -552 885.0 -569.5Q890 -587 895.5 -598.5Q901 -610 908.0 -619.5Q915 -629 926 -640H772Q781 -619 781 -602Q781 -591 777.5 -573.0Q774 -555 767 -525L665 -118H662L533 -640H190Q199 -619 199 -602Q199 -591 195.5 -573.0Q192 -555 185 -525L83 -115Q76 -88 71.0 -71.0Q66 -54 60.5 -42.0Q55 -30 48.0 -20.5Q41 -11 30 0H184Q175 -21 175 -38Q175 -58 189 -115L292 -530H294Z","O":"M91 -188Q80 -143 80 -109Q80 -52 111.5 -26.0Q143 0 206 0H572Q653 0 704.5 -44.0Q756 -88 781 -188L847 -452Q858 -498 858 -531Q858 -589 826.0 -614.5Q794 -640 732 -640H366Q284 -640 233.0 -596.0Q182 -552 157 -452ZM411 -493Q416 -515 430.0 -524.5Q444 -534 469 -534H575Q615 -534 615 -508Q615 -502 613 -493L527 -147Q521 -125 507.0 -115.5Q493 -106 468 -106H362Q323 -106 323 -132Q323 -138 325 -147Z","P":"M431 -534H559Q579 -534 587.0 -529.0Q595 -524 595 -510Q595 -499 589 -479L567 -389Q559 -356 547.5 -345.0Q536 -334 509 -334H381ZM355 -228H609Q689 -228 738.0 -260.5Q787 -293 810 -384L835 -484Q844 -519 844 -546Q844 -600 810.0 -620.0Q776 -640 712 -640H188Q197 -620 197 -598Q197 -573 186 -530L81 -110Q71 -68 60.5 -44.5Q50 -21 34 0H318Q314 -19 314 -35Q314 -63 325 -110Z","Q":"M568 82 541 0H572Q653 0 704.5 -44.0Q756 -88 781 -188L847 -452Q858 -498 858 -531Q858 -589 826.0 -614.5Q794 -640 732 -640H366Q284 -640 233.0 -596.0Q182 -552 157 -452L91 -188Q80 -143 80 -109Q80 -52 111.5 -26.0Q143 0 206 0H444L471 82ZM381 -200 410 -106H362Q323 -106 323 -132Q323 -138 325 -147L411 -493Q416 -515 430.0 -524.5Q444 -534 469 -534H575Q615 -534 615 -508Q615 -502 613 -493L527 -147Q521 -123 504 -114L476 -200Z","R":"M431 -534H569Q588 -534 595.5 -530.5Q603 -527 603 -516Q603 -509 600 -498L581 -420Q575 -398 565.5 -391.0Q556 -384 532 -384H394ZM442 -278 489 0H762Q751 -18 740 -69Q736 -85 733 -98L691 -278Q717 -280 733.5 -283.5Q750 -287 765.5 -296.5Q781 -306 793.5 -326.5Q806 -347 815 -381L844 -499Q852 -529 852 -551Q852 -600 818.0 -620.0Q784 -640 714 -640H188Q197 -620 197 -598Q197 -573 186 -530L81 -110Q71 -68 60.5 -44.5Q50 -21 34 0H318Q314 -19 314 -35Q314 -63 325 -110L367 -278Z","S":"M792 -640H339Q274 -640 229.0 -601.5Q184 -563 166 -488L130 -345Q121 -308 121 -283Q121 -240 147.0 -223.0Q173 -206 230 -206H429Q453 -206 461.5 -202.5Q470 -199 470 -190Q470 -186 468 -178L457 -134Q453 -116 443.0 -111.0Q433 -106 404 -106H168Q137 -106 118.0 -112.0Q99 -118 78 -130L67 0H507Q591 0 635.0 -38.5Q679 -77 699 -157L738 -313Q744 -336 744 -355Q744 -401 710.5 -421.5Q677 -442 610 -442H437Q413 -442 404.0 -445.0Q395 -448 395 -458Q395 -463 397 -470L406 -506Q410 -523 421.0 -528.5Q432 -534 460 -534H687Q720 -534 738.5 -529.0Q757 -524 781 -513Z","T":"M180 -640 127 -508Q153 -522 172.5 -528.0Q192 -534 224 -534H335L229 -110Q219 -68 208.5 -44.5Q198 -21 182 0H466Q462 -19 462 -35Q462 -63 473 -110L579 -534H690Q722 -534 739.0 -528.0Q756 -522 775 -508L788 -640Z","U":"M380 -106Q331 -106 331 -142Q331 -152 334 -166L425 -530Q436 -572 446.5 -595.5Q457 -619 473 -640H189Q193 -621 193 -605Q193 -577 181 -530L98 -198Q87 -151 87 -116Q87 0 226 0H550Q603 0 640.0 -10.5Q677 -21 702.5 -44.0Q728 -67 746.0 -104.0Q764 -141 778 -198L860 -525Q867 -552 872.0 -569.5Q877 -587 882.5 -598.5Q888 -610 895.0 -619.5Q902 -629 913 -640H759Q768 -619 768 -602Q768 -591 764.5 -573.0Q761 -555 754 -525L665 -170Q660 -147 655.0 -135.0Q650 -123 641.0 -116.5Q632 -110 617.5 -108.0Q603 -106 576 -106Z","V":"M508 0 841 -524Q869 -569 891.5 -596.5Q914 -624 934 -640H769Q768 -618 765 -605Q760 -586 751.0 -568.5Q742 -551 724 -522L478 -136L434 -522Q430 -553 430 -568Q430 -587 435 -605Q438 -619 449 -640H145Q166 -614 169 -581L235 0Z","W":"M609 0H845L1111 -543Q1131 -582 1147.0 -602.5Q1163 -623 1179 -637Q1181 -639 1182 -640H1027Q1029 -634 1029 -625Q1029 -613 1025 -598Q1017 -566 1001 -535L851 -226H849L848 -640H604L401 -227H399L401 -535Q402 -553 403.5 -568.0Q405 -583 409 -598Q413 -613 416.5 -621.0Q420 -629 428 -640H138Q147 -621 152.0 -603.0Q157 -585 158 -557L162 0H395L604 -424H606Z","X":"M496 -564Q487 -583 487 -604Q487 -620 492 -640H132Q145 -629 151.5 -623.0Q158 -617 165.0 -608.0Q172 -599 179.5 -587.0Q187 -575 199 -552L337 -280L111 -95Q87 -75 70.5 -62.0Q54 -49 39.0 -38.5Q24 -28 12.5 -20.5Q1 -13 -14 -3Q-17 -1 -19 0H170Q178 -19 194.0 -37.0Q210 -55 242 -82L379 -194L426 -100V-99Q438 -76 442.0 -65.5Q446 -55 446 -43Q446 -28 438 0H788Q770 -16 758.5 -34.0Q747 -52 730 -87L729 -88L592 -368L805 -543Q881 -605 943 -640H744Q735 -620 719.0 -600.5Q703 -581 673 -556L547 -454Z","Y":"M268 -110Q258 -68 247.5 -44.5Q237 -21 221 0H505Q501 -19 501 -35Q501 -63 512 -110L544 -237L814 -546Q832 -566 841.5 -576.0Q851 -586 861.5 -595.5Q872 -605 885.0 -614.5Q898 -624 923 -640H741Q733 -614 724.0 -594.0Q715 -574 694 -551L540 -374L472 -547L470 -554Q463 -572 459.5 -584.0Q456 -596 456 -607Q456 -610 457 -614Q458 -618 458 -620Q459 -626 466 -638L467 -640H138Q151 -624 158.0 -611.0Q165 -598 179 -562L303 -250Z","Z":"M624 0 669 -119Q647 -111 630.0 -108.5Q613 -106 570 -106H376L840 -640H227L177 -514Q200 -524 220.0 -529.0Q240 -534 274 -534H467L5 0Z",".":"M76 0H312L354 -168H118Z","\u2019":"M265 -472 162 -338H247L415 -487L454 -640H218L176 -472Z","'":"M147 -368H259L327 -640H215Z"};

;
/* ===== evolution.js ===== */
(() => {
  'use strict';
  const section=document.querySelector('#evolution'),config=window.MT_EVOLUTION;
  if(!section)return;
  if(!config?.enabled||!config.chapters?.length){section.remove();return;}
  const chapters=config.chapters;
  const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const stage=make('div','evolution-stage'),top=make('header','evolution-top'),title=make('h2','','RT / THROUGH THE YEARS');
  title.id='evolution-title';top.append(title);
  const scenes=make('div','evolution-scenes'),navigation=make('nav','evolution-nav');navigation.setAttribute('aria-label','سنوات Rules Town');
  const bottom=make('div','evolution-bottom'),counter=make('b','','01 / 06');
  bottom.append(make('span','','2019 — AN ONGOING STORY'),counter);
  const rail=make('div','evolution-rail'),railInk=make('span','evolution-rail-ink'),railHead=make('span','evolution-rail-head');
  rail.setAttribute('aria-hidden','true');rail.append(railInk,railHead);navigation.append(rail);
  const articles=[],buttons=[];
  chapters.forEach((chapter,index)=>{
    const number=String(index+1).padStart(2,'0'),article=make('article','era');article.id=`era-${chapter.year}`;article.dataset.motif=chapter.motif;
    article.setAttribute('aria-labelledby',`era-title-${index}`);
    const year=make('img','era-year');if(window.MT_ASSETS)window.MT_ASSETS.deferImage(year,`assets/images/era-${chapter.year}.svg`);else year.src=`assets/images/era-${chapter.year}.svg`;year.alt='';year.setAttribute('aria-hidden','true');year.width=3200;year.height=740;
    const art=make('figure','era-art');art.setAttribute('aria-hidden','true');
    const artTop=make('div','era-art-top');
    const logo=make('img','era-logo');logo.src='assets/images/mt-logo.png';logo.alt='';logo.width=52;logo.height=42;
    artTop.append(logo);
    if(chapter.image){const photo=make('img','era-photo');if(window.MT_ASSETS)window.MT_ASSETS.deferImage(photo,chapter.image);else photo.src=chapter.image;photo.alt='';photo.loading='lazy';art.append(photo);art.classList.add('has-photo');}
    
    art.append(artTop,make('div','era-metric',chapter.metric),make('div','era-detail',chapter.detail));
    const copy=make('div','era-copy'),heading=make('h3','',chapter.title);heading.id=`era-title-${index}`;
    copy.append(make('span','era-label',chapter.label),heading,make('p','',chapter.text),make('div','era-copy-foot',chapter.tag));
    article.append(year,art,copy);scenes.append(article);articles.push(article);
    const button=make('button','era-jump',chapter.label);button.type='button';button.setAttribute('aria-label',`${chapter.label}: ${chapter.title}`);button.setAttribute('aria-controls',article.id);
    button.append(make('small','',number));
    button.addEventListener('click',()=>go(index));navigation.append(button);buttons.push(button);
  });
  stage.append(top,scenes,navigation,bottom);section.append(stage);section.hidden=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),wide=matchMedia('(min-width: 1000px) and (min-height: 700px)');
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),ease=n=>n*n*(3-2*n);
  let pinned=false,layout=null,frame=0,disposed=false,active=-1;
  const cache=new WeakMap();
  function prop(node,key,value){let values=cache.get(node);if(!values){values={};cache.set(node,values);}value=String(value);if(values[key]!==value){values[key]=value;node.style.setProperty(key,value);}}
  function select(index){
    if(active===index)return;active=index;
    articles.forEach((article,i)=>{article.classList.toggle('is-current',i===index);article.inert=pinned&&i!==index;if(pinned&&i!==index)article.setAttribute('aria-hidden','true');else article.removeAttribute('aria-hidden');buttons[i].setAttribute('aria-current',String(i===index));});
    counter.textContent=`${String(index+1).padStart(2,'0')} / ${String(chapters.length).padStart(2,'0')}`;
  }
  function measure(){
    if(disposed)return;
    pinned=wide.matches&&!reduced.matches;active=-1;
    const step=innerHeight*.88,lead=innerHeight*.16,tail=innerHeight*.2;
    prop(section,'--evolution-height',`${innerHeight+lead+(chapters.length-1)*step+tail}px`);
    section.classList.toggle('is-pinned',pinned);
    const start=section.getBoundingClientRect().top+scrollY;
    layout={start,step,lead,positions:articles.map(article=>article.getBoundingClientRect().top+scrollY)};
    if(!pinned)articles.forEach(article=>{article.inert=false;article.removeAttribute('aria-hidden');});
    queue();
  }
  function render(){
    frame=0;if(!layout||disposed||document.hidden)return;
    if(!pinned){let index=0;layout.positions.forEach((y,i)=>{if(scrollY+innerHeight*.5>=y)index=i;});select(index);prop(navigation,'--timeline-progress',index/Math.max(1,chapters.length-1));return;}
    const position=clamp((scrollY-layout.start-layout.lead)/layout.step,0,chapters.length-1);
    // Each chapter holds still before the next one arrives. Reverse scroll uses
    // identical geometry and never restarts a timer or an animation timeline.
    const base=Math.floor(position),fraction=position-base,mix=ease(clamp((fraction-.36)/.64));
    select(Math.min(chapters.length-1,base+(mix>=.5?1:0)));
    // The rail follows the very same chapter blend: no one-segment lead.
    prop(navigation,'--timeline-progress',((base+mix)/Math.max(1,chapters.length-1)).toFixed(5));
    articles.forEach((article,index)=>{
      const outgoing=index===base,incoming=index===base+1,visible=outgoing||incoming&&mix>0;
      article.classList.toggle('is-visible',visible);
      if(visible){
        const phase=outgoing?-mix:1-mix;
        prop(article,'--era-ink',(outgoing?1-mix:mix).toFixed(4));
        const contentBlend=ease(clamp((mix-.38)/.24));
        const contentInk=outgoing?1-contentBlend:contentBlend;
        prop(article,'--content-ink',contentInk.toFixed(4));
        prop(article,'--art-shift',`${(phase*32).toFixed(2)}px`);
        prop(article,'--copy-shift',`${(phase*24).toFixed(2)}px`);
        prop(article,'--year-shift',`${(phase*65).toFixed(2)}px`);
      }

    });
  }
  function queue(){if(!frame&&!disposed&&!document.hidden)frame=requestAnimationFrame(render);}
  function go(index){
    if(!layout)return;
    const top=pinned?layout.start+layout.lead+index*layout.step:layout.positions[index]-90;
    scrollTo({top,behavior:reduced.matches?'instant':'smooth'});
  }
  addEventListener('scroll',queue,{passive:true});addEventListener('resize',measure);
  document.addEventListener('visibilitychange',queue);
  reduced.addEventListener('change',measure);wide.addEventListener('change',measure);
  // chapters.js rearranges the closing sections synchronously after this script.
  // A single body resize observer refreshes cached offsets when earlier content grows.
  const sizing=new ResizeObserver(measure);sizing.observe(document.body);
  document.fonts?.ready.then(measure);
  addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);frame=0;sizing.disconnect();});
  addEventListener('pageshow',()=>{disposed=false;sizing.observe(document.body);measure();});
  measure();requestAnimationFrame(measure);
})();

;
/* ===== chapters.js ===== */
(() => {
  'use strict';
  const root=document.documentElement;
  const hero=document.querySelector('#home'),stories=document.querySelector('#stories'),memories=document.querySelector('#memories'),connect=document.querySelector('#connect'),footer=document.querySelector('.site-footer');
  if(!hero||!stories||!memories||!connect||!footer||!window.MT_PORTAL_SHAPES||!window.MT_HEADLINE_GLYPHS)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const desktop=matchMedia('(min-width: 1000px) and (min-height: 700px)');
  const clamp=v=>Math.max(0,Math.min(1,v)),range=(v,a,b)=>clamp((v-a)/(b-a)),smooth=v=>v*v*(3-2*v);
  const softFade=v=>v*v*v*(v*(v*6-15)+10);
  const written=new WeakMap();
  const property=(node,name,value)=>{let cache=written.get(node);if(!cache){cache={};written.set(node,cache);}value=String(value);if(cache[name]!==value){cache[name]=value;node.style.setProperty(name,value);}};
  const wrap=(node,className)=>{const wrapper=document.createElement('div');wrapper.className=className;node.before(wrapper);wrapper.append(node);return wrapper;};
  const heroChapter=wrap(hero,'hero-chapter');
  const stack=wrap(stories,'chapter-stack');stack.append(memories);
  const memoryChapter=wrap(memories,'memory-chapter');
  const evolution=document.querySelector('#evolution'),partners=document.querySelector('#partners');
  const closing=wrap(connect,'closing-chapters');if(evolution)closing.append(evolution);if(partners)closing.append(partners);closing.append(footer);footer.setAttribute('role','contentinfo');
  const heading=hero.querySelector('h1');
  const layer=document.createElement('div');layer.className='portal-layer';layer.setAttribute('aria-hidden','true');layer.inert=true;
  const preview=stories.cloneNode(true);preview.classList.add('portal-preview');preview.removeAttribute('id');preview.removeAttribute('aria-labelledby');preview.inert=true;
  preview.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
  preview.querySelectorAll('button,a').forEach(node=>node.tabIndex=-1);
  layer.append(preview);hero.append(layer);
  const ns='http://www.w3.org/2000/svg';
  const svgNode=(name,attrs={})=>{const node=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);return node;};
  const vector=svgNode('svg',{class:'portal-type','aria-hidden':'true',preserveAspectRatio:'none'}),camera=svgNode('g');vector.append(camera);hero.append(vector);
  const svg=svgNode('svg',{class:'chapter-definitions',width:'0',height:'0','aria-hidden':'true'}),defs=svgNode('defs');
  const aperture=svgNode('clipPath',{id:'chapter-counter',clipPathUnits:'userSpaceOnUse'}),counter=svgNode('path');
  const organic=svgNode('clipPath',{id:'memory-reveal',clipPathUnits:'userSpaceOnUse'}),edge=svgNode('path');
  aperture.append(counter);organic.append(edge);defs.append(aperture,organic);svg.append(defs);document.body.append(svg);
  const glow=svgNode('svg',{class:'memory-edge','aria-hidden':'true',preserveAspectRatio:'none'});
  const rim=svgNode('path',{id:'memory-rim',fill:'none'}),rimDefs=svgNode('defs');rimDefs.append(rim);glow.append(rimDefs);
  for(const [width,opacity,color] of [[16,.045,'#ff1820'],[8,.12,'#ff1820'],[3.5,.32,'#ff1f26'],[1.3,.95,'#ff6166']])glow.append(svgNode('use',{href:'#memory-rim',stroke:color,'stroke-width':width,opacity,fill:'none','stroke-linejoin':'round','stroke-linecap':'round'}));
  memoryChapter.append(glow);
  const phases=Array.from({length:5},()=>Math.random()*Math.PI*2);
  let frame=0,layout=null,anchor=null,portalActive=false,chapterHeld=false,footerReady=true,disposed=false,geometryDirty=true,edgeRunning=false,memoryPosition=0,lastEdge=-Infinity,lastScroll=NaN;
  const enabled=()=>!reduced.matches,full=()=>enabled()&&desktop.matches;
  function footerState(ready){if(ready!==footerReady){footerReady=ready;document.dispatchEvent(new CustomEvent('mtrp:footerreveal',{detail:{visible:ready}}));}}
  function portalState(active,held=active){if(active!==portalActive){portalActive=active;hero.classList.toggle('is-portal-active',active);}if(held!==chapterHeld){chapterHeld=held;document.dispatchEvent(new CustomEvent('mtrp:chapterstate',{detail:{active:held}}));}}
  function captureLetter(){
    // Measure once, then draw font outlines in a viewport-sized SVG. Never enlarge
    // a composited DOM text texture or create a giant offscreen bitmap.
    const box=heading.getBoundingClientRect(),heroBox=hero.getBoundingClientRect();
    const candidates=[],paths=[];
    for(const line of hero.querySelectorAll('.headline-line')){
      const text=line.firstChild;if(!text||text.nodeType!==3)continue;
      const style=getComputedStyle(line),unit=parseFloat(style.fontSize)/window.MT_PORTAL_SHAPES.O.em;
      const marker=document.createElement('span');marker.className='portal-baseline';marker.setAttribute('aria-hidden','true');line.append(marker);
      const baseline=marker.getBoundingClientRect().top;marker.remove();
      for(let index=0;index<text.length;index++){
        const char=text.textContent[index],outline=window.MT_HEADLINE_GLYPHS[char];if(!outline)continue;
        const selection=document.createRange();selection.setStart(text,index);selection.setEnd(text,index+1);
        const rect=selection.getBoundingClientRect();
        paths.push(svgNode('path',{d:outline,fill:style.color,transform:`translate(${rect.left-heroBox.left} ${baseline-heroBox.top}) scale(${unit})`}));
        if(!window.MT_PORTAL_SHAPES[char])continue;
        // Favor a counter near the centre of the phrase, rather than its first letter.
        const score=Math.abs(rect.left+rect.width/2-(box.left+box.width*.42))+Math.abs(rect.top+rect.height/2-(box.top+box.height*.5))*.8;
        candidates.push({char,rect,score,unit,baseline});
      }
    }
    const selected=candidates.sort((a,b)=>a.score-b.score)[0];
    if(!selected)return null;
    const {char,rect,unit,baseline}=selected,shape=window.MT_PORTAL_SHAPES[char];
    const x=rect.left+shape.cx*unit,y=baseline+shape.cy*unit;
    const result={shape,unit,x:x-heroBox.left,y:y-heroBox.top};
    counter.setAttribute('d',shape.hole);
    camera.replaceChildren(...paths);
    return result;
  }
  function measure(){
    if(disposed)return;
    root.classList.toggle('cinema-on',enabled());root.classList.toggle('cinema-desktop',full());
    const vh=innerHeight,vw=hero.clientWidth||innerWidth,hh=hero.offsetHeight,travel=vh*1.25;
    property(root,'--hero-size',`${hh}px`);property(root,'--hero-run',`${hh+travel}px`);
    property(stack,'--story-pin',`${Math.min(0,vh-stories.offsetHeight)}px`);
    edge.setAttribute('transform',`translate(0 ${Math.max(0,stories.offsetHeight-vh)})`);
    footer.classList.toggle('footer-tall',footer.offsetHeight>vh-40);
    const heroTop=heroChapter.getBoundingClientRect().top+scrollY,mark=footer.querySelector('.footer-wordmark');
    layout={vh,vw,hh,travel,heroTop,storyOffset:Math.max(0,stories.offsetHeight-vh),markOffset:mark.offsetTop,markHeight:mark.offsetHeight};
    vector.setAttribute('viewBox',`0 0 ${vw} ${hh}`);glow.setAttribute('viewBox',`0 0 ${innerWidth} ${vh+220}`);
    glow.style.height=`${vh+220}px`;
    anchor=null;
    if(!full()){portalState(false);footerState(true);hero.style.visibility='';hero.classList.remove('is-departed','has-vector','is-portrait-muted');edgeRunning=false;memoryChapter.classList.remove('has-reveal');}
    queue();
  }
  function revealMemories(top,vh,vw,now){
    const p=clamp((vh-top)/vh);
    property(memories,'--memory-pin',`${-Math.max(0,top)}px`);
    property(glow,'--memory-pin',`${-Math.max(0,top)}px`);
    memories.classList.toggle('is-revealing',p>0&&p<1);
    memories.classList.toggle('is-covered',p===0);
    stories.classList.toggle('is-revealing',p>0&&p<1);
    stories.classList.toggle('is-reveal-complete',p===1);
    edgeRunning=p>0&&p<1;memoryChapter.classList.toggle('has-reveal',edgeRunning);
    if(!edgeRunning)return;
    // Seeded phases drift continuously: organic motion without per-frame jumps.
    if(now-lastEdge<32&&!geometryDirty)return;
    lastEdge=now;
    const centre=(1-p)*(vh+220)-110,amplitude=Math.sin(Math.PI*p);
    let contour='';const time=now*.00022;
    for(let i=0;i<=144;i++){
      const t=i/144;
      const wave=52*Math.sin(t*11+phases[0]+time)+29*Math.sin(t*27+phases[1]-time*1.4)+15*Math.sin(t*63+phases[2]+time*.8)+7*Math.sin(t*147+phases[3]-time*1.7)+3*Math.sin(t*307+phases[4]+time);
      contour+=`${i?' L':'M'} ${(t*vw).toFixed(1)} ${(centre+wave*amplitude).toFixed(1)}`;
    }
    rim.setAttribute('d',contour);
    // Clip the stationary story layer above the edge, not the moving gallery.
    // The gallery keeps its own composited scrolling layer throughout the reveal.
    edge.setAttribute('d',`${contour} L ${vw+2} ${-layout.storyOffset-2} L -2 ${-layout.storyOffset-2} Z`);
  }
  function render(now=0){
    frame=0;if(!layout||!enabled()||document.hidden)return;
    // Wheel easing can update scrollY before the browser delivers its scroll event.
    // Never draw an idle edge frame using the previous scroll position.
    if(scrollY!==lastScroll)geometryDirty=true;
    if(!geometryDirty&&edgeRunning){revealMemories(memoryPosition,layout.vh,innerWidth,now);if(edgeRunning)queue(false);return;}
    const {vh,vw,hh,travel,heroTop}=layout;
    const connectBox=connect.getBoundingClientRect(),memoryTop=memoryChapter.getBoundingClientRect().top,footerTop=footer.getBoundingClientRect().top;
    if(full()){
      const p=clamp((scrollY-heroTop)/travel),q=range(p,.09,1);
      const active=q>0&&p<1;
      // Allow an in-flight portrait change to finish before measuring its text.
      const changing=hero.dataset.transitioning==='true';
      if(active&&!anchor&&!changing)anchor=captureLetter();
      portalState(active,p>.09);
      hero.classList.toggle('has-vector',active&&!!anchor);
      hero.classList.toggle('is-departed',p===1);
      const portrait=softFade(range(q,0,.48));
      property(hero,'--portrait-ink',1-portrait);
      property(hero,'--portrait-rise',`${portrait*24}px`);
      property(hero,'--portrait-scale',1-portrait*.035);
      // Hide the expensive portrait layers only once their fade is fully finished.
      hero.classList.toggle('is-portrait-muted',portrait===1);
      if(active&&anchor){
        const {shape,unit,x,y}=anchor;
        const target=Math.max(vw/shape.width,hh/shape.height)*4;
        const zoom=Math.pow(target/unit,smooth(q));
        const pan=smooth(range(q,0,.55));
        const dx=(vw/2-x)*pan,dy=(hh/2-y)*pan;
        camera.setAttribute('transform',`translate(${x+dx} ${y+dy}) scale(${zoom}) translate(${-x} ${-y})`);
        counter.setAttribute('transform',`translate(${x+dx} ${y+dy}) scale(${unit*zoom}) translate(${-shape.cx} ${-shape.cy})`);
        property(hero,'--portal-ink',smooth(range(q,.10,.27)));
        property(hero,'--hero-ink',1-smooth(range(q,0,.25)));
      }else if(!active){
        property(hero,'--portal-ink',0);property(hero,'--hero-ink',1);
        if(p===0||p<=.09)anchor=null;
      }
      hero.style.visibility=p===1?'hidden':'';
      memoryPosition=memoryTop;revealMemories(memoryTop,vh,innerWidth,now);
      const wordmarkBottom=footerTop+layout.markOffset+layout.markHeight;
      const coverBottom=partners?partners.getBoundingClientRect().bottom:evolution&&!evolution.hidden?evolution.getBoundingClientRect().bottom:connectBox.bottom;
      const reveal=smooth(clamp((wordmarkBottom-coverBottom)/Math.max(1,layout.markHeight)));
      property(footer,'--footer-ink',.3+.7*reveal);property(footer,'--footer-rise',`${(1-reveal)*22}px`);footerState(reveal>.55);
    }else{
      hero.style.visibility='';
      const departure=smooth(clamp((scrollY-heroTop)/hh));
      property(hero,'--lite-zoom',1+departure*.05);property(hero,'--lite-ink',1-departure*.3);
      const portrait=softFade(range((scrollY-heroTop)/hh,0,.7));
      property(hero,'--portrait-ink',1-portrait);property(hero,'--portrait-rise',`${portrait*16}px`);property(hero,'--portrait-scale',1-portrait*.025);
    }
    // A continuous, quiet arrival on the same background. No detached line,
    // sweeping outline or wait for the frame to finish before showing the ticket.
    const absoluteTop=connectBox.top+scrollY;
    const start=absoluteTop-vh*.94,end=Math.max(start+1,Math.min(absoluteTop-vh*.34,root.scrollHeight-vh));
    const arrival=smooth(range(scrollY,start,end));
    property(connect,'--ticket-ink',arrival);property(connect,'--ticket-rise',`${(1-arrival)*38}px`);
    property(connect,'--ticket-scale',.975+.025*arrival);
    property(connect,'--ticket-button',smooth(range(arrival,.15,.85)));
    lastScroll=scrollY;geometryDirty=false;if(edgeRunning)queue(false);
  }
  function queue(dirty=true){if(dirty!==false)geometryDirty=true;if(!frame&&!disposed)frame=requestAnimationFrame(render);}
  addEventListener('scroll',queue,{passive:true});addEventListener('resize',measure);addEventListener('hashchange',queue);
  document.addEventListener('mtrp:scenechange',()=>{anchor=null;queue();});
  document.addEventListener('focusin',event=>{
    if(full()&&memories.contains(event.target)&&memoryChapter.getBoundingClientRect().top>0){
      memoryChapter.scrollIntoView({behavior:'instant',block:'start'});queue();
    }
  });
  document.addEventListener('mtrp:introstate',queue);document.addEventListener('visibilitychange',queue);
  reduced.addEventListener('change',measure);desktop.addEventListener('change',measure);
  const sizing=new ResizeObserver(measure);[hero,stories,memories,connect,footer].forEach(node=>sizing.observe(node));
  if(evolution)sizing.observe(evolution);
  if(partners)sizing.observe(partners);
  document.fonts?.ready.then(measure);
  addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);frame=0;});
  addEventListener('pageshow',()=>{disposed=false;measure();});
  measure();
})();

;
/* ===== hero-cipher.js ===== */
(() => {
  'use strict';
  const hero=document.querySelector('#home');
  const targets=[...document.querySelectorAll('.headline-line,.story-eyebrow,.story-heading h2,.story-heading p,.memory-eyebrow,.memories-heading h2,.memories-intro p')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  const symbols=['+','*','-','_','?','/','\\',':','#','\u00d7'];
  const jobs=new Map(),sealed=new Set();let frame=0,heroBlocked=false,arrivalPlayed=false;
  const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
  function clear(target){const job=jobs.get(target);if(!job)return;job.overlay.remove();target.classList.remove('is-decoding');jobs.delete(target);}
  function stop(onlyHero=false){
    for(const [target,job] of jobs)if(!onlyHero||job.isHero)clear(target);
    if(!jobs.size){cancelAnimationFrame(frame);frame=0;}
  }
  function tick(now){
    frame=0;if(document.hidden){stop();return;}if(reduced.matches)return;
    for(const [target,job] of jobs){
      if(target.firstChild!==job.source||now-job.start>=job.duration||(job.isHero&&(heroBlocked||hero.dataset.transitioning==='true'))){clear(target);continue;}
      if(now<job.start)continue;
      if(now-job.last<(job.persistent?110:40))continue;job.last=now;
      const progress=job.persistent?0:Math.max(0,Math.min(1,((now-job.start)/job.duration-.20)/.72));
      const hidden=(100-progress*100).toFixed(2)+'%';
      job.resolved.style.clipPath=job.rtl?`inset(0 0 0 ${hidden})`:`inset(0 ${hidden} 0 0)`;
      for(const slot of job.glyphs){
        if(progress>=slot.threshold){slot.node.style.opacity='0';continue;}
        const next=symbols[Math.floor(Math.random()*symbols.length)];
        if(slot.node.textContent!==next)slot.node.textContent=next;
      }
    }
    if(jobs.size)frame=requestAnimationFrame(tick);
  }
  function begin(target,event={},options={}){
    const isHero=!!hero?.contains(target);
    if(jobs.get(target)?.automatic&&!options.automatic)return;
    if((!options.automatic&&!options.persistent&&(event.pointerType==='touch'||!fine.matches))||(reduced.matches&&!options.persistent)||document.hidden||(isHero&&(heroBlocked||hero.dataset.transitioning==='true'))||(!options.automatic&&document.body.classList.contains('intro-active'))||document.body.classList.contains('menu-open'))return;
    clear(target);
    const source=target.firstChild;if(!source)return;
    const bounds=target.getBoundingClientRect(),rtl=getComputedStyle(target).direction==='rtl',slots=[];
    const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let text;
    // Measure graphemes including nested emphasis, wrapped lines and Arabic marks.
    while((text=walker.nextNode())){
      const size=parseFloat(getComputedStyle(text.parentElement).fontSize);
      const chunks=segmenter?[...segmenter.segment(text.data)]:Array.from(text.data,(segment,index)=>({segment,index}));
      for(const {segment,index} of chunks){
        if(/^\s+$/.test(segment))continue;
        const range=document.createRange();range.setStart(text,index);range.setEnd(text,index+segment.length);
        const rect=range.getBoundingClientRect();if(!rect.width||!rect.height)continue;
        const left=rect.left-bounds.left;
        slots.push({left,top:rect.top-bounds.top,width:rect.width,height:rect.height,size,threshold:Math.max(0,Math.min(1,rtl?1-(left+rect.width/2)/bounds.width:(left+rect.width/2)/bounds.width))});
      }
    }
    if(!slots.length)return;
    const overlay=document.createElement('span');overlay.className=options.automatic?'cipher-overlay cipher-arrival':'cipher-overlay';overlay.setAttribute('aria-hidden','true');
    // Reveal a complete copy, not isolated Arabic letters: joining and diacritics
    // remain native to the browser's text shaping, including original <br>/<em>.
    const resolved=document.createElement('span');resolved.className='cipher-resolved';resolved.innerHTML=target.innerHTML;resolved.style.clipPath='inset(0 100% 0 0)';overlay.append(resolved);
    const glyphs=slots.map(slot=>{
      const node=document.createElement('span');node.className='cipher-glyph';
      Object.assign(node.style,{left:`${slot.left}px`,top:`${slot.top}px`,width:`${slot.width}px`,height:`${slot.height}px`,fontSize:`${slot.size*.77}px`});
      node.textContent=symbols[Math.floor(Math.random()*symbols.length)];overlay.append(node);return {node,threshold:slot.threshold};
    });
    target.append(overlay);target.classList.add('is-decoding');
    if(options.persistent)resolved.style.visibility='hidden';
    jobs.set(target,{source,overlay,resolved,glyphs,rtl,isHero,persistent:!!options.persistent,automatic:!!options.automatic,start:performance.now()+(options.delay||0),duration:options.persistent?Infinity:options.automatic?1700:900,last:-Infinity});
    if(!frame&&!reduced.matches)frame=requestAnimationFrame(tick);
  }
  function refreshSealed(){for(const target of sealed)begin(target,{}, {persistent:true});}
  document.addEventListener('mtrp:cipherseal',event=>{
    for(const target of event.detail.targets){
      if(event.detail.enabled){sealed.add(target);target.classList.add('cipher-target');begin(target,{}, {persistent:true});}
      else{sealed.delete(target);clear(target);}
    }
    if(!jobs.size){cancelAnimationFrame(frame);frame=0;}
  });
  targets.forEach(target=>{target.classList.add('cipher-target');target.addEventListener('pointerenter',event=>begin(target,event));});
  document.addEventListener('mtrp:introreveal',()=>{
    if(arrivalPlayed)return;arrivalPlayed=true;
    targets.filter(target=>hero?.contains(target)).forEach((target,index)=>begin(target,{}, {automatic:true,delay:index*85}));
  });
  document.addEventListener('mtrp:chapterstate',event=>{heroBlocked=event.detail.active;if(heroBlocked)stop(true);});
  document.addEventListener('mtrp:scenewillchange',()=>stop(true));
  document.addEventListener('mtrp:introstate',event=>{if(event.detail.active)stop();});
  document.addEventListener('mtrp:menuchange',event=>{if(event.detail.open)stop();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else refreshSealed();});
  reduced.addEventListener('change',()=>{stop();refreshSealed();});fine.addEventListener('change',()=>{stop();refreshSealed();});
  addEventListener('resize',()=>{stop();refreshSealed();});addEventListener('pagehide',()=>{stop();sealed.clear();});
})();

;
/* ===== character-electricity.js ===== */
(() => {
  'use strict';
  const dock=document.querySelector('.hero-bottom');if(!dock)return;
  const cards=[...dock.querySelectorAll('.character-choice')];
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const canvas=document.createElement('canvas');canvas.className='character-electricity';canvas.setAttribute('aria-hidden','true');dock.append(canvas);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  let frame=0,timer=0,visible=false,chapter=false,intro=document.body.classList.contains('intro-active'),menu=false,burst=null,lastPattern=0,paths=[],width=0,height=0;
  const allowed=()=>visible&&!document.hidden&&!motion.matches&&!chapter&&!intro&&!menu;
  const random=(a,b)=>a+Math.random()*(b-a);
  function clear(){cancelAnimationFrame(frame);clearTimeout(timer);frame=timer=0;burst=null;paths=[];ctx.clearRect(0,0,width,height);}
  function resize(){const rect=dock.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);width=rect.width+24;height=rect.height+24;canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  function schedule(){clearTimeout(timer);if(allowed())timer=setTimeout(()=>ignite(cards.find(card=>card.classList.contains('active'))),random(3600,6200));}
  function zigzag(x,y,dx,dy,length){
    const points=[[x,y]],steps=7;
    for(let i=1;i<=steps;i++){const t=i/steps,jitter=random(-7,7)*Math.sin(Math.PI*t);points.push([x+dx*length*t-dy*jitter,y+dy*length*t+dx*jitter]);}
    return points;
  }
  function build(){
    paths=[];const {x,y,w,h}=burst;
    for(let i=0;i<3;i++){
      const top=Math.random()>.5,edge=y+(top?2:h-2),dir=Math.random()>.5?1:-1,length=random(18,Math.min(62,w*.35));
      const start=x+(dir>0?random(12,w-length-12):random(length+12,w-12));
      const points=zigzag(start,edge,dir,top?-.08:.08,length);paths.push(points);
      const junction=points[3];paths.push(zigzag(junction[0],junction[1],dir*.45,top?-1:1,random(8,17)));
    }
  }
  function draw(now){
    frame=0;if(!allowed()||!burst){clear();return;}
    const age=now-burst.start;
    ctx.clearRect(0,0,width,height);
    if(age>430){burst=null;schedule();return;}
    if(now-lastPattern>65){build();lastPattern=now;}
    const envelope=Math.sin(Math.PI*Math.min(1,age/430));
    ctx.lineJoin='round';ctx.lineCap='round';
    for(const [stroke,lineWidth,alpha] of [['#ff0d15',7,.10],['#ff1f26',3,.35],['#ff9a9d',1,1]]){
      ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.globalAlpha=envelope*alpha;
      for(const points of paths){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
    }
    ctx.globalAlpha=envelope;ctx.fillStyle='#ffafb2';
    for(const points of paths){const [x,y]=points.at(-1);ctx.fillRect(x-1,y-1,1.5,1.5);}
    ctx.globalAlpha=1;frame=requestAnimationFrame(draw);
  }
  function ignite(card){
    if(!card||!allowed())return;
    clearTimeout(timer);const base=dock.getBoundingClientRect(),rect=card.getBoundingClientRect();
    burst={x:rect.left-base.left+12,y:rect.top-base.top+12,w:rect.width,h:rect.height,start:performance.now()};lastPattern=-Infinity;
    if(!frame)frame=requestAnimationFrame(draw);
  }
  function sync(){if(!allowed())clear();else schedule();}
  cards.forEach(card=>{card.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')ignite(card);});card.addEventListener('focus',()=>ignite(card));});
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{threshold:.4}).observe(dock);
  document.addEventListener('mtrp:scenechange',()=>ignite(cards.find(card=>card.classList.contains('active'))));
  document.addEventListener('mtrp:chapterstate',event=>{chapter=event.detail.active;sync();});
  document.addEventListener('mtrp:introstate',event=>{intro=event.detail.active;sync();});
  document.addEventListener('mtrp:menuchange',event=>{menu=event.detail.open;sync();});
  document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
  addEventListener('resize',()=>{clear();resize();sync();});addEventListener('pagehide',clear);addEventListener('pageshow',sync);
  resize();
})();

;
/* ===== dossiers.js ===== */
(() => {
  'use strict';
  const hero=document.querySelector('#home'),stage=hero?.querySelector('.character-stage'),files=window.MT_DOSSIERS;
  if(!stage||!files?.length)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  stage.removeAttribute('aria-hidden');
  const trigger=document.createElement('button');trigger.className='dossier-trigger';trigger.type='button';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','dossier-dialog');
  trigger.innerHTML='<span class="dossier-cue"><i aria-hidden="true">+</i><span>OPEN DOSSIER<small>كشف الملف</small></span><b aria-hidden="true">↗</b></span>';
  stage.append(trigger);
  const dialog=document.createElement('dialog');dialog.id='dossier-dialog';dialog.className='dossier-dialog';dialog.setAttribute('aria-labelledby','dossier-name');dialog.dir='ltr';
  dialog.innerHTML='<div class="dossier-sheet"><header class="dossier-top"><span><i aria-hidden="true"></i> RT — RESTRICTED ARCHIVE</span><button class="dossier-close" type="button" aria-label="إغلاق الملف">×</button></header><div class="dossier-body"></div><div class="dossier-bottom"><span>RULES TOWN / PERSONNEL</span><span class="dossier-file-number"></span></div></div>';
  document.body.append(dialog);
  const sheet=dialog.querySelector('.dossier-sheet'),body=dialog.querySelector('.dossier-body'),closeButton=dialog.querySelector('.dossier-close');
  let closing=false,animation=null,version=0,held=false,sealedTargets=[];
  function unseal(){if(sealedTargets.length)document.dispatchEvent(new CustomEvent('mtrp:cipherseal',{detail:{targets:sealedTargets,enabled:false}}));sealedTargets=[];}
  function sync(){trigger.disabled=held||hero.dataset.transitioning==='true';trigger.setAttribute('aria-label',`فتح ملف ${files[Number(hero.dataset.scene)||0].name}`);}
  function open(){
    if(trigger.disabled||dialog.open||document.body.classList.contains('intro-active'))return;
    const file=files[Number(hero.dataset.scene)||0];if(!file)return;
    version++;closing=false;unseal();sheet.style.setProperty('--dossier-tone',file.tone);
    sheet.style.setProperty('--dossier-mask',`url("assets/images/${file.image}")`);
    const anonymous=file.name==='ANONYMOUS';dialog.classList.toggle('is-anonymous',anonymous);
    body.innerHTML=`<div class="dossier-portrait"><span class="dossier-ghost" aria-hidden="true">${escape(file.code)}</span><div class="dossier-target" aria-hidden="true"><i></i><i></i><i></i><i></i></div><img src="assets/images/${escape(file.image)}" alt="${escape(file.name)}" width="1024" height="1536"><div class="dossier-scan" aria-hidden="true"></div><span class="dossier-portrait-id">${escape(file.code)} / SUBJECT RECORD</span></div><div class="dossier-copy"><div class="dossier-classification">${escape(file.classification)}</div><h2 id="dossier-name">${escape(file.name)}</h2><div class="dossier-unit" dir="rtl"><span>الجهة</span><strong>${escape(file.unit)}</strong></div><h3 dir="rtl">${escape(file.title)}</h3><p class="dossier-intro" dir="rtl">${escape(file.intro)}</p>${anonymous?'':`<div class="dossier-redactions" dir="rtl" aria-label="مفاتيح الملف">${file.words.map((word,i)=>`<span style="--reveal-delay:${900+i*240}ms">${escape(word)}</span>`).join('')}</div>`}<ol class="dossier-brief" dir="rtl">${file.brief.map((line,i)=>`<li style="--row-delay:${220+i*100}ms"><small>${String(i+1).padStart(2,'0')}</small><span>${escape(line)}</span></li>`).join('')}</ol><div class="dossier-quote">${escape(file.quote)}</div></div>`;
    dialog.querySelector('.dossier-file-number').textContent=`FILE / ${file.code}`;
    document.body.classList.add('dossier-open');dialog.showModal();
    if(anonymous){
      dialog.setAttribute('aria-label','ملف مجهول الهوية — بيانات مشفرة');dialog.removeAttribute('aria-labelledby');body.setAttribute('aria-hidden','true');
      sealedTargets=[...dialog.querySelectorAll('.dossier-top>span,.dossier-ghost,.dossier-portrait-id,.dossier-classification,.dossier-copy h2,.dossier-unit>span,.dossier-unit>strong,.dossier-copy h3,.dossier-intro,.dossier-redactions>span,.dossier-brief li>small,.dossier-brief li>span,.dossier-quote,.dossier-bottom>span')];
      document.dispatchEvent(new CustomEvent('mtrp:cipherseal',{detail:{targets:sealedTargets,enabled:true}}));
    }else{dialog.removeAttribute('aria-label');dialog.setAttribute('aria-labelledby','dossier-name');body.removeAttribute('aria-hidden');}
    document.dispatchEvent(new CustomEvent('mtrp:dossierstate',{detail:{open:true}}));
    if(!reduced.matches){
      const from=trigger.getBoundingClientRect(),to=sheet.getBoundingClientRect();
      const dx=Math.max(-180,Math.min(180,from.left+from.width/2-to.left-to.width/2));
      animation=sheet.animate([{opacity:0,transform:`translate(${dx}px,24px) scale(.9)`},{opacity:1,transform:'translate(0,0) scale(1)'}],{duration:680,easing:'cubic-bezier(.16,1,.3,1)'});
    }
    closeButton.focus({preventScroll:true});
  }
  async function close(){
    if(!dialog.open||closing)return;
    closing=true;const token=++version;animation?.cancel();
    if(!reduced.matches){animation=sheet.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(16px)'}],{duration:210,easing:'ease-in'});await animation.finished.catch(()=>{});}
    if(token!==version)return;
    dialog.close();unseal();animation?.cancel();animation=null;document.body.classList.remove('dossier-open');closing=false;
    document.dispatchEvent(new CustomEvent('mtrp:dossierstate',{detail:{open:false}}));
    if(!trigger.disabled)trigger.focus({preventScroll:true});
  }
  trigger.addEventListener('click',open);closeButton.addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  // Native modal focus handling plus restoration on a programmatic close.
  dialog.addEventListener('close',()=>{unseal();document.body.classList.remove('dossier-open');});
  document.addEventListener('mtrp:scenewillchange',sync);document.addEventListener('mtrp:scenechange',sync);
  document.addEventListener('mtrp:chapterstate',event=>{held=event.detail.active;sync();});
  reduced.addEventListener('change',()=>animation?.cancel());
  addEventListener('pagehide',()=>{version++;animation?.cancel();if(dialog.open)dialog.close();document.body.classList.remove('dossier-open');closing=false;});
  sync();
})();

;
/* ===== partners.js ===== */
(() => {
  const section=document.querySelector('#partners');if(!section)return;
  const grid=section.querySelector('.partners-grid'),marks=[...grid.querySelectorAll('.partner-mark')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let visible=false;
  for(const [index,items] of [marks.slice(0,6),marks.slice(6)].entries()){
    const row=document.createElement('div');row.className=`partner-row partner-row-${index+1}`;
    const track=document.createElement('div');track.className='partner-track';
    const run=document.createElement('div');run.className='partner-run';run.append(...items);
    const copy=run.cloneNode(true);copy.classList.add('partner-copy');copy.setAttribute('aria-hidden','true');
    copy.querySelectorAll('button').forEach(button=>button.tabIndex=-1);
    track.append(run,copy);row.append(track);grid.append(row);
  }
  section.querySelectorAll('.partner-mark').forEach(mark=>mark.addEventListener('click',()=>mark.setAttribute('aria-pressed',String(mark.getAttribute('aria-pressed')!=='true'))));
  function sync(){section.classList.toggle('partners-running',visible&&!document.hidden&&!reduced.matches&&!document.body.classList.contains('menu-open'));}
  const observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);if(visible)section.classList.add('is-visible');sync();},{threshold:.05});
  observer.observe(section);
  document.addEventListener('visibilitychange',sync);document.addEventListener('mtrp:menuchange',sync);reduced.addEventListener('change',sync);
  addEventListener('pagehide',()=>section.classList.remove('partners-running'));addEventListener('pageshow',sync);
})();

;
/* ===== timeline-electricity.js ===== */
(() => {
  'use strict';
  const rail=document.querySelector('#evolution .evolution-rail');if(!rail)return;
  const nav=document.querySelector('#evolution .evolution-nav'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const canvas=document.createElement('canvas');canvas.className='timeline-electricity';canvas.setAttribute('aria-hidden','true');rail.append(canvas);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  let width=0,visible=false,timer=0,frame=0,burst=null,last=0,paths=[];
  const random=(a,b)=>a+Math.random()*(b-a);
  const allowed=()=>visible&&!document.hidden&&!reduced.matches&&!document.body.classList.contains('menu-open')&&!document.querySelector('dialog[open]');
  function clear(){clearTimeout(timer);cancelAnimationFrame(frame);timer=frame=0;burst=null;ctx.clearRect(0,0,width,64);}
  function schedule(){clearTimeout(timer);if(allowed())timer=setTimeout(()=>ignite(),random(1900,3500));}
  function measure(){clear();width=rail.getBoundingClientRect().width;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.ceil(width*dpr);canvas.height=64*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);schedule();}
  function pattern(){
    paths=[];const center=burst.x,length=Math.min(width*.42,random(90,190)),start=Math.max(0,Math.min(width-length,center-length/2));
    const main=[];
    for(let i=0;i<=18;i++)main.push([start+i/18*length,32+(i===0||i===18?0:random(-5,5))]);
    paths.push(main);
    for(let branch=0;branch<3;branch++){const [x,y]=main[3+branch*5];paths.push([[x,y],[x+random(-6,6),y-6],[x+random(-8,8),y+random(-20,20)],[x+random(-13,13),y+random(-24,24)]]);}
  }
  function draw(now){
    frame=0;if(!allowed()){clear();return;}
    const age=now-burst.start;ctx.clearRect(0,0,width,64);
    if(age>=390){burst=null;schedule();return;}
    if(now-last>70){pattern();last=now;}
    const strength=Math.sin(Math.PI*age/390);ctx.lineJoin='round';ctx.lineCap='round';
    for(const [color,line,opacity] of [['#ff171f',7,.1],['#ff3f45',3,.4],['#ffb7b9',.9,1]]){
      ctx.strokeStyle=color;ctx.lineWidth=line;ctx.globalAlpha=strength*opacity;
      for(const path of paths){ctx.beginPath();path.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
    }
    ctx.globalAlpha=1;frame=requestAnimationFrame(draw);
  }
  function ignite(button){
    if(!allowed()||width<1)return;clearTimeout(timer);
    let x=random(width*.08,width*.92);
    if(button){const a=button.getBoundingClientRect(),b=rail.getBoundingClientRect();x=Math.max(0,Math.min(width,a.left+a.width/2-b.left));}
    burst={x,start:performance.now()};last=-Infinity;if(!frame)frame=requestAnimationFrame(draw);
  }
  function sync(){if(allowed())schedule();else clear();}
  nav.querySelectorAll('.era-jump').forEach(button=>{button.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')ignite(button);});button.addEventListener('focus',()=>ignite(button));button.addEventListener('click',()=>ignite(button));});
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{threshold:0}).observe(nav);
  new ResizeObserver(measure).observe(rail);
  document.addEventListener('visibilitychange',sync);document.addEventListener('mtrp:menuchange',sync);document.addEventListener('close',sync,true);reduced.addEventListener('change',sync);
  addEventListener('pagehide',clear);addEventListener('pageshow',sync);measure();
})();

