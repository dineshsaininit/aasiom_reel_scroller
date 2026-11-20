(() => {
  const DWELL = 8000; // ms per reel
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let running = false;
  const seen = new Set();

  const btn = document.createElement('button');
  btn.textContent = '▶ Find tools';
  btn.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#7c5cff;color:#fff;border:0;border-radius:10px;padding:10px 14px;font:600 14px system-ui;cursor:pointer;box-shadow:0 4px 14px #0006';
  document.documentElement.appendChild(btn);
  btn.onclick = () => {
    running = !running;
    btn.textContent = running ? '⏸ Stop' : '▶ Find tools';
    if (running) loop();
  };

  function activeVideo() {
    let best = null, area = 0;
    for (const v of document.querySelectorAll('video')) {
      const b = v.getBoundingClientRect();
      const a = Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0)) * b.width;
      if (a > area) { area = a; best = v; }
    }
    return best;
  }

  function readText() {
    const v = activeVideo(); if (!v) return '';
    let el = v, out = '';
    while (el.parentElement && el.parentElement !== document.body) {
      const p = el.parentElement;
      if (p.querySelectorAll('video').length > 1) break;
      el = p; out = el.innerText || out;
    }
    return out.replace(/\n{2,}/g, '\n').trim();
  }

  function next() {
    const b = document.querySelector('[aria-label="Navigate to next Reel"],[aria-label="Next"]');
    if (b) { (b.closest('button,[role=button]') || b).click(); return; }
    // fallback: scroll the reels container
    let el = activeVideo();
    while (el && el !== document.body) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 10) { el.scrollBy({ top: el.clientHeight, behavior: 'smooth' }); return; }
      el = el.parentElement;
    }
    window.scrollBy({ top: innerHeight, behavior: 'smooth' });
  }

  async function loop() {
    while (running) {
      if (!/^\/(reels?)\//.test(location.pathname)) {
        btn.textContent = '⚠ open instagram.com/reels'; await sleep(2000); continue;
      }
      btn.textContent = '⏸ Stop (scanning)';
      const url = location.href, text = readText();
      const key = /\/reels?\/[\w-]{5,}/.test(url) ? url : text.slice(0, 100) || 'x' + Date.now();
      if (activeVideo() && !seen.has(key)) {
        seen.add(key);
        const shots = [];
        for (let i = 0; i < 3 && running; i++) {
          await sleep(DWELL / 3);
          const r = await chrome.runtime.sendMessage({ type: 'shot' }).catch(() => null);
          if (r?.data) shots.push(r.data);
        }
        chrome.runtime.sendMessage({ type: 'analyze', payload: { url, text, shots } }); // don't wait
      } else await sleep(DWELL / 2);
      next();
      await sleep(1500);
    }
  }
})();
