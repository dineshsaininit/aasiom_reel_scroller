// Background reel scroller (no visible browser, no extra tab).
//   node scroller.js --login   -> opens a visible browser once so you can log in to Instagram
//   node scroller.js           -> scrolls reels headlessly in the background, posts to the server
const { chromium } = require('playwright');
const path = require('path');

const LOGIN = process.argv.includes('--login');
const SERVER = process.env.SERVER || 'http://localhost:3000';
const DWELL = +process.env.DWELL || 8000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await chromium.launchPersistentContext(path.join(__dirname, 'profile'), {
    headless: !LOGIN,
    viewport: { width: 430, height: 900 },
    args: ['--mute-audio'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://www.instagram.com/reels/', { waitUntil: 'domcontentloaded' });
  if (LOGIN) {
    console.log('Log in to Instagram in the opened window, then close it.');
    await new Promise(r => ctx.on('close', r));
    return;
  }
  console.log('Scrolling reels in background. Ctrl+C to stop.');
  const seen = new Set();
  const readText = () => page.evaluate(() => {
    let best = null, area = 0;
    for (const v of document.querySelectorAll('video')) {
      const b = v.getBoundingClientRect();
      const a = Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0)) * b.width;
      if (a > area) { area = a; best = v; }
    }
    if (!best) return null;
    let el = best, out = '';
    while (el.parentElement && el.parentElement !== document.body) {
      const p = el.parentElement;
      if (p.querySelectorAll('video').length > 1) break;
      el = p; out = el.innerText || out;
    }
    return out.replace(/\n{2,}/g, '\n').trim();
  });

  while (true) {
    try {
      if (/\/accounts\/login|\/challenge/.test(page.url())) { console.log('Not logged in — run: node scroller.js --login'); break; }
      const text = await readText();
      if (text !== null) {
        const url = page.url();
        const key = /\/reels?\/[\w-]{5,}/.test(url) ? url : text.slice(0, 100);
        if (!seen.has(key)) {
          seen.add(key);
          const shots = [];
          for (let i = 0; i < 3; i++) {
            await sleep(DWELL / 3);
            shots.push((await page.screenshot({ type: 'jpeg', quality: 60 })).toString('base64'));
          }
          fetch(`${SERVER}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url, text, shots }) })
            .then(r => r.json()).then(e => console.log(url, '->', (e.tools || []).map(t => t.name).join(', ') || 'no tools'))
            .catch(e => console.log('server error:', e.message));
        } else await sleep(DWELL / 2);
      } else await sleep(2000);
      await page.keyboard.press('ArrowDown');
      await sleep(1500);
    } catch (e) { console.log('error:', e.message); await sleep(3000); }
  }
  await ctx.close();
})();
