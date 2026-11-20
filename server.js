// Run: node server.js  -> dashboard http://localhost:3000 ; the Chrome extension posts reels to /api/analyze
const http = require('http');
const fs = require('fs');
const path = require('path');

try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
const KEY = process.env.GOOGLE_API_KEY;
const MODEL = process.env.MODEL || 'gemini-2.5-flash';
const PORT = process.env.PORT || 3000;
const RESULTS = path.join(__dirname, 'results.json');

const state = { status: 'Waiting for the extension…', scanned: 0, reels: [] };
try { state.reels = JSON.parse(fs.readFileSync(RESULTS, 'utf8')); } catch {}

async function analyze(url, text, shots = []) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text:
        'You get screenshots (frames) of one Instagram reel plus its visible text (may be empty). Even if there is NO caption, look at the frames: on-screen text, UI, logos, websites, screen recordings, and recognise the AI tool, web tool, app, SaaS, or AI company/product being shown or demonstrated. Name the best-matching tools; if unsure, give your best guess and say so in "what". ' +
        'Reply ONLY JSON: {"relevant":boolean,"tools":[{"name":string,"what":"what it does, short","use_case":"where/when to use it, short","url":"official website if you know it else empty"}],"summary":"one sentence about the reel"}. ' +
        'relevant=false and tools=[] if the reel is not about tools.' }] },
      contents: [{ role: 'user', parts: [
        ...shots.map(b => ({ inlineData: { mimeType: 'image/jpeg', data: b } })),
        { text: `Reel: ${url}\n\nVisible text:\n${text.slice(0, 4000) || '(none)'}` },
      ] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'Gemini error');
  const t = j.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(o)); };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (u.pathname === '/api/state') return json(res, 200, state);
  if (u.pathname === '/api/analyze' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { url, text = '', shots = [] } = JSON.parse(body);
        state.status = 'Scanning reels…'; state.scanned++;
        const entry = { id: Date.now(), url, text: text.slice(0, 300), tools: [], relevant: false };
        try { Object.assign(entry, await analyze(url, text, shots)); } catch (e) { entry.error = e.message; }
        state.reels.unshift(entry); state.reels = state.reels.slice(0, 500);
        fs.writeFile(RESULTS, JSON.stringify(state.reels), () => {});
        json(res, 200, entry);
      } catch (e) { json(res, 400, { error: e.message }); }
    });
    return;
  }
  fs.readFile(path.join(__dirname, 'public', 'index.html'), (e, d) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(d); });
}).listen(PORT, () => console.log(`Dashboard: http://localhost:${PORT}`));
if (!KEY) console.log('GOOGLE_API_KEY missing in .env');
