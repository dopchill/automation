# CRM-Automation — CYBERX RMA Automation

One application: a web UI control panel that drives the existing Playwright
automation engine.

```
UI (ui/, React + Vite + Tailwind)
   ↕  HTTP + SSE  (/api/*)
server/index.js — control server (spawn/stop/pause + settings + file upload)
   ↕  child process stdout/stdin
material-entry/browser-test.js — the existing RMA automation engine (automation.js)
   ↓  Playwright
Chrome → RMA website
```

## Quick start

```bash
npm run setup        # install root + UI deps and build the UI once
npm start            # → http://localhost:8787  (one app: UI + engine)
```

For UI development with hot reload (two terminals):

```bash
npm run server       # API + engine control on :8787
npm run ui:dev       # Vite dev server (proxies /api → :8787)
```

## Running the engine standalone (unchanged)

```bash
node material-entry/browser-test.js --dry-run                  # parse Excel only
node material-entry/browser-test.js --file data\DAY_1_ENTRY.xlsx
node material-entry/browser-test.js --sheet "D.M. Computer"    # one party
node material-entry/browser-test.js --inspect                  # dump form controls
node material-entry/browser-test.js --header-only              # header fields only
```

## How the pieces connect

- **Events**: with `RMA_UI_EVENTS=1` (the server sets this) the engine writes
  `@@RMA_EVENT@@{json}` lines to stdout next to the normal CMD output. The
  server parses them and streams them to the UI over SSE (`/api/events`).
  Without the flag the engine behaves exactly as before.
- **Control**: the server writes to the child stdin (ENTER / `yes` / `q`) for
  interactive prompts, and drops `STOP` / `PAUSE` marker files in a per-run
  state dir (`RMA_STATE_DIR`) which the engine checks between products/entries.
- **Settings**: `server/settings.json` (managed from the UI Settings screen) is
  injected as env vars (`RMA_BASE_URL`, `RMA_CHROME_PATH`, `RMA_MASTER_FILE`,
  `RMA_OUT_DIR`, `RMA_USER`, `RMA_PASS`). `credentials.json` in
  `material-entry/` or the project root still works as a fallback.
- **Safety preserved**: the engine never clicks final Save; prepared entries
  stay open in Chrome tabs for manual review; Auto-Save is locked OFF.

## Project layout

- `ui/` — control panel (React + TypeScript + Tailwind)
- `server/` — zero-dependency Node control server
- `material-entry/` — automation engine + `data/` (Excel in) + `output/` (reports)
- `material-entry/browser-test.js` — **the engine** (originally `automation.js`)
- `test.js`, `tests/` — older experiments / Playwright test scaffold (untouched)
