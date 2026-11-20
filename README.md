# aasiom_reel_scroller
Scrolls Instagram Reels **in the background** (headless Playwright, no Instagram tab needed) and finds AI tools in them via Gemini.

1. `npm install && npx playwright install chromium`
2. Copy `.env.example` to `.env`, set `GOOGLE_API_KEY`
3. `npm run login` — log in to Instagram once, close the window
4. `npm start` (dashboard on http://localhost:3000), then in another terminal `npm run scroll`

The old Chrome extension (`extension/`) is still there as an alternative.
