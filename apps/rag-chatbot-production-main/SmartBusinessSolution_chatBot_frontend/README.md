# SmartBusinessSolution_chatBot_frontend

The chat widget for SmartBusiness Solutions. Plain HTML/CSS/JS: **no Docker, no build, no install.**
It talks to the backend project (`SmartBusinessSolution_chatBot_backend`).

```
SmartBusinessSolution_chatBot_frontend/
├── widget/
│   ├── index.html    demo page + the one setting (backend URL)
│   ├── widget.js     the widget (looks, texts, chat logic)
│   └── widget.css    styling
└── README.md
```

## Run it
1. Start the backend first (see its README) so http://localhost:8000 works.
2. Serve this folder (the browser needs http, not a double-click):
```powershell
cd widget
python -m http.server 8080
```
(or in VS Code: right-click `index.html` → **Open with Live Server**)
3. Open **http://localhost:8080** and click the purple chat button.

## The only setting: backend URL
In `widget/index.html`:
```html
<script>
  window.RAG_CHAT_CONFIG = {
    apiBase: "http://localhost:8000"   // no trailing slash
  };
</script>
```
For production use your public https backend URL, e.g. `https://chat-api.yourdomain.com`.
Optional extras: `debug: true` (dev only, shows retrieved chunks in the browser console) and
`turnstileSiteKey: "..."` (only if the backend uses Cloudflare Turnstile).

The SmartBusiness look and texts (title, welcome message, quick-reply questions, colour) are built into the top of
`widget.js` (the `BRAND` block), so you don't need any settings for them.

## Put it on your website
Upload the three files in `widget/` (`widget.js`, `widget.css`, plus your config) to your site or any static host
(Netlify, Cloudflare Pages, S3...), then add before `</body>`:
```html
<script>window.RAG_CHAT_CONFIG = { apiBase: "https://chat-api.yourdomain.com" };</script>
<script src="https://YOUR-HOST/widget.js"></script>
```
`widget.js` loads `widget.css` from the same folder automatically.

**Production checklist**
- [ ] `apiBase` is the public **https** backend URL
- [ ] Backend `.env` → `CORS_ORIGINS=https://your-website.com` (not `*`)
- [ ] `debug` is not set
- [ ] In the `BRAND` block of `widget.js`: the badge text ("Federal Reserve Check 21 & MICR Certified") is true, or set `badge: ""`; set `badgeLinkUrl` to your real pricing page (the "Plans" link only shows when a URL is set)
- [ ] Turnstile site key set if the backend uses `TURNSTILE_SECRET`

## Test checklist
Open DevTools (F12) → Console + Network.
- [ ] Chat button opens the panel; header, welcome message and 4 question chips show
- [ ] First open creates a session (`POST /v1/session` → 200)
- [ ] Clicking a chip sends it and the chips disappear
- [ ] Answer streams in; bullets and bold look right; timestamps show
- [ ] ↻ starts a new conversation, × closes the panel
- [ ] 21 messages in a minute → friendly "slow down" message
- [ ] Phone width (DevTools device toolbar): panel fits the screen
- [ ] Backend stopped → friendly "something went wrong reaching the server" message

Note: the chips "Are checks compliant with Federal Reserve MICR standards?" and "What are the pricing tiers for high
volume?" only get real answers after you ingest documents that cover them. Without that the bot says it isn't sure.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `//v1/session` 404 | trailing slash in `apiBase` (the widget strips it, but remove it) |
| CORS error in the console | add this page's address (e.g. `http://localhost:8080`) to the backend `CORS_ORIGINS`, restart the backend |
| No chat button | `widget.js` not found (Network tab) or a JS error in the Console |
| Unstyled panel | `widget.css` must sit next to `widget.js` |
| Every answer is "rate-limited by an upstream service" | backend/LLM problem, read the **backend** logs |
