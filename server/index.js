'use strict';
/**
 * Control server — bridge between the web UI and the existing RMA automation
 * engine (material-entry/browser-test.js).
 *
 *   UI  <— HTTP/SSE —>  this server  <— spawn/stdout/stdin —>  automation engine
 *
 * No external dependencies (Node >= 18).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ENGINE_DIR = path.join(ROOT, 'material-entry');
const ENGINE = path.join(ENGINE_DIR, 'browser-test.js'); // the real automation engine (automation.js)
const UI_DIST = path.join(ROOT, 'ui', 'dist');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const EVENT_MARK = '@@RMA_EVENT@@';
const PORT = Number(process.env.RMA_SERVER_PORT || 8787);

// ─────────────────────────────────────────────────────────────────────────────
// Settings (persisted to server/settings.json)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  rmaUrl: 'http://43.204.255.198:8095/Transaction/RMAEntry/AddRma/0',
  chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  dataFolder: path.join(ENGINE_DIR, 'data'),
  masterExcelFile: path.join(ENGINE_DIR, 'data', 'MASTER_PRODUCT_LIST.xlsx'),
  reportsFolder: path.join(ENGINE_DIR, 'output'),
  username: '',
  password: '',
  autoSave: false,            // never enabled — final Save stays manual
  confirmBeforeStart: true,
  masterFileUploaded: false,
  masterFileName: '',
  companyDocsUploaded: false,
  companyDocsName: '',
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
  } catch (e) { console.error('settings.json read failed:', e.message); }
  return { ...DEFAULT_SETTINGS };
}
function saveSettings(s) {
  // autoSave is a safety lock — it can never be turned on from the UI
  s.autoSave = false;
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
}
let settings = loadSettings();

// ─────────────────────────────────────────────────────────────────────────────
// SSE event hub
// ─────────────────────────────────────────────────────────────────────────────
const sseClients = new Set();
const eventBuffer = [];
const MAX_BUFFER = 800;

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  eventBuffer.push(payload);
  if (eventBuffer.length > MAX_BUFFER) eventBuffer.shift();
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) { sseClients.delete(res); }
  }
}
function uiLog(message, level = 'info') {
  broadcast({ type: 'log', entry: { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }), message, level } });
}
function setStatus(status) {
  state.status = status;
  broadcast({ type: 'status', status });
}

// ─────────────────────────────────────────────────────────────────────────────
// Automation child process
// ─────────────────────────────────────────────────────────────────────────────
const state = {
  status: 'idle',            // idle | running | paused | stopped | completed | error
  child: null,
  filePath: null,
  filePayload: null,         // last file-loaded payload (UI preview data)
  pendingPrompt: null,
  stateDir: null,
  lastReport: null,
};

function engineEnv() {
  const env = { ...process.env, RMA_UI_EVENTS: '1', RMA_STATE_DIR: state.stateDir };
  if (settings.rmaUrl) env.RMA_BASE_URL = settings.rmaUrl;
  if (settings.chromePath) env.RMA_CHROME_PATH = settings.chromePath;
  if (settings.masterExcelFile) env.RMA_MASTER_FILE = settings.masterExcelFile;
  if (settings.reportsFolder) env.RMA_OUT_DIR = settings.reportsFolder;
  if (settings.username) env.RMA_USER = settings.username;
  if (settings.password) env.RMA_PASS = settings.password; // env only — never logged
  return env;
}

function runEngine(args, onEvent, onExit) {
  const child = spawn(process.execPath, [ENGINE, ...args], {
    cwd: ENGINE_DIR, env: engineEnv(), stdio: ['pipe', 'pipe', 'pipe'],
  });
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      if (line.startsWith(EVENT_MARK)) {
        try { onEvent(JSON.parse(line.slice(EVENT_MARK.length))); } catch (_) { /* ignore */ }
      } else if (line.trim()) {
        onEvent({ type: 'console', level: 'info', message: line.replace(/\r$/, '') });
      }
    }
  });
  let errBuf = '';
  child.stderr.on('data', (d) => {
    errBuf += d.toString();
    let idx;
    while ((idx = errBuf.indexOf('\n')) >= 0) {
      const line = errBuf.slice(0, idx); errBuf = errBuf.slice(idx + 1);
      if (line.trim()) onEvent({ type: 'console', level: 'error', message: line.replace(/\r$/, '') });
    }
  });
  child.on('exit', (code, sig) => onExit(code, sig));
  child.on('error', (e) => onEvent({ type: 'console', level: 'error', message: 'Failed to start automation engine: ' + e.message }));
  return child;
}

/** Synchronous-ish plan fetch used by file select/upload. */
function inspectExcel(filePath) {
  return new Promise((resolve, reject) => {
    let payload = null;
    const child = spawn(process.execPath, [ENGINE, '--plan-json', '--file', filePath], {
      cwd: ENGINE_DIR, env: { ...process.env },
    });
    let buf = '', err = '';
    child.stdout.on('data', (d) => {
      buf += d.toString();
      const i = buf.indexOf(EVENT_MARK);
      if (i >= 0) {
        const nl = buf.indexOf('\n', i);
        const line = nl >= 0 ? buf.slice(i, nl) : buf.slice(i);
        try { payload = JSON.parse(line.slice(EVENT_MARK.length)); } catch (_) { /* keep waiting */ }
      }
    });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('exit', (code) => {
      if (payload) resolve(payload);
      else reject(new Error(err.trim() || `Excel inspection failed (exit ${code})`));
    });
    child.on('error', reject);
  });
}

function startAutomation(filePath) {
  if (state.child) return { error: 'Automation is already running' };
  if (!fs.existsSync(filePath)) return { error: 'Excel file not found: ' + filePath };

  state.stateDir = fs.mkdtempSync(path.join(__dirname, '.run-'));
  state.filePath = filePath;
  state.pendingPrompt = null;
  setStatus('running');
  uiLog('Automation started', 'action');

  const child = runEngine(['--file', filePath], (ev) => {
    // ── translate engine events → UI events ──
    if (ev.type === 'console') {
      uiLog(ev.message, ev.level);
      return;
    }
    if (ev.type === 'prompt') {
      state.pendingPrompt = translatePrompt(ev.prompt);
      broadcast({ type: 'prompt', prompt: state.pendingPrompt });
      return;
    }
    if (ev.type === 'prompt-resolved') {
      state.pendingPrompt = null;
      broadcast({ type: 'prompt-resolved' });
      return;
    }
    if (ev.type === 'status') { setStatus(ev.status); return; }
    if (ev.type === 'file-loaded') {
      state.filePayload = ev;
      broadcast(ev); // UI consumes this as 'file-loaded'
      return;
    }
    if (ev.type === 'warning') { uiLog(ev.message, 'warning'); broadcast({ type: 'warning', message: ev.message }); return; }
    if (ev.type === 'error') { uiLog(ev.message, 'error'); broadcast({ type: 'error', message: ev.message }); return; }
    if (ev.type === 'login-required') { return; } // the paired 'prompt' event carries the UI modal
    if (ev.type === 'complete') {
      if (ev.summary && ev.summary.reportPath) state.lastReport = ev.summary.reportPath;
      broadcast(ev);
      return;
    }
    broadcast(ev); // party-*, product-*, progress, step-update, partner-*, stopped, ...
  }, (code, sig) => {
    state.child = null;
    const was = state.status;
    if (was === 'running' || was === 'paused') {
      // exited without a terminal event (crash / killed)
      setStatus('error');
      uiLog(`Automation process exited unexpectedly (code ${code}${sig ? ', signal ' + sig : ''})`, 'error');
      broadcast({ type: 'error', message: `Automation exited unexpectedly (code ${code})` });
    } else {
      uiLog('Automation process closed.', 'info');
    }
    if (state.stateDir) { try { fs.rmSync(state.stateDir, { recursive: true, force: true }); } catch (_) { /* ignore */ } state.stateDir = null; }
    state.pendingPrompt = null;
  });
  state.child = child;
  return { ok: true };
}

function translatePrompt(p) {
  const base = { id: p.id, type: 'confirm', title: p.title, message: p.message, detail: p.detail, kind: p.kind };
  switch (p.kind) {
    case 'login-required':
      return { ...base, title: 'Login Required', confirmLabel: 'Continue — I logged in', cancelLabel: 'Stop Automation' };
    case 'next-entry':
      return { ...base, confirmLabel: 'Continue to Next Entry', cancelLabel: 'Stop Here' };
    case 'finished':
      return { ...base, confirmLabel: 'Close Automation Browser', cancelLabel: 'Keep Browser Open' };
    default:
      return { ...base, confirmLabel: 'Continue', cancelLabel: 'Cancel' };
  }
}

function stopAutomation() {
  if (!state.child) return { error: 'No automation is running' };
  try { if (state.stateDir) fs.writeFileSync(path.join(state.stateDir, 'STOP'), ''); } catch (_) { /* ignore */ }
  // If the engine is waiting at the between-entries prompt, answer "q" so it
  // exits the loop gracefully instead of sitting on stdin.
  if (state.pendingPrompt && state.pendingPrompt.kind === 'next-entry') writeToEngine('q');
  if (state.pendingPrompt && state.pendingPrompt.kind === 'login-required') writeToEngine('q');
  uiLog('Stop requested — finishing the current step safely…', 'warning');
  return { ok: true };
}

function writeToEngine(input) {
  try { state.child && state.child.stdin.write(input + '\n'); } catch (_) { /* ignore */ }
}

function safeUploadPath(dir, fileName) {
  fs.mkdirSync(dir, { recursive: true });
  const clean = path.basename(fileName).replace(/[^\w.\-() ]/g, '_');
  let p = path.join(dir, clean);
  const masterAbs = path.resolve(settings.masterExcelFile || '');
  if (fs.existsSync(p) || path.resolve(p) === masterAbs) {
    const ext = path.extname(clean);
    p = path.join(dir, `${clean.slice(0, clean.length - ext.length)}.${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}${ext}`);
  }
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function readBody(req, limitBytes = 80 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limitBytes) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv': 'text/csv' };

function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const file = path.join(UI_DIST, p);
  if (!file.startsWith(UI_DIST)) { sendJson(res, 403, { error: 'forbidden' }); return; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    // SPA fallback
    const index = path.join(UI_DIST, 'index.html');
    if (fs.existsSync(index)) { res.writeHead(200, { 'Content-Type': 'text/html' }); fs.createReadStream(index).pipe(res); return; }
    sendJson(res, 503, { error: 'UI not built. Run: npm run ui:build (or use npm run ui:dev during development).' });
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = u.pathname;
  try {
    // SSE stream
    if (p === '/api/events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
      res.write(`data: ${JSON.stringify({ type: 'status', status: state.status })}\n\n`);
      for (const payload of eventBuffer) res.write(payload);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (p === '/api/state' && req.method === 'GET') {
      sendJson(res, 200, { status: state.status, file: state.filePayload, running: !!state.child, pendingPrompt: state.pendingPrompt });
      return;
    }

    // ── settings ──
    if (p === '/api/settings' && req.method === 'GET') { sendJson(res, 200, { settings }); return; }
    if (p === '/api/settings' && req.method === 'PUT') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const allowed = Object.keys(DEFAULT_SETTINGS).filter((k) => k !== 'autoSave');
      for (const k of allowed) if (k in body) settings[k] = body[k];
      saveSettings(settings);
      sendJson(res, 200, { ok: true, settings });
      return;
    }

    // ── excel files ──
    if (p === '/api/files' && req.method === 'GET') {
      const dir = settings.dataFolder;
      const masterName = path.basename(settings.masterExcelFile || '').toLowerCase();
      const files = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((f) => /\.xlsx?$/i.test(f) && f.toLowerCase() !== masterName).map((f) => {
            const st = fs.statSync(path.join(dir, f));
            return { name: f, path: path.join(dir, f), size: st.size, modified: st.mtime };
          }).sort((a, b) => b.modified - a.modified)
        : [];
      sendJson(res, 200, { files });
      return;
    }
    if (p === '/api/files/select' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const fp = path.resolve(body.path || '');
      const dataDir = path.resolve(settings.dataFolder);
      if (!fp.startsWith(dataDir)) { sendJson(res, 403, { error: 'File must be inside the data folder' }); return; }
      const payload = await inspectExcel(fp);
      state.filePayload = payload; state.filePath = fp;
      sendJson(res, 200, { ok: true, path: fp, payload });
      return;
    }
    if (p === '/api/upload' && req.method === 'POST') {
      const name = req.headers['x-file-name'] || u.searchParams.get('name') || 'upload.xlsx';
      if (!/\.xlsx?$/i.test(name)) { sendJson(res, 400, { error: 'Only .xlsx/.xls files are accepted' }); return; }
      const data = await readBody(req);
      const dest = safeUploadPath(settings.dataFolder, name);
      fs.writeFileSync(dest, data);
      const payload = await inspectExcel(dest);
      state.filePayload = payload; state.filePath = dest;
      sendJson(res, 200, { ok: true, path: dest, payload });
      return;
    }
    if (p === '/api/upload-master' && req.method === 'POST') {
      const name = req.headers['x-file-name'] || 'MASTER_PRODUCT_LIST.xlsx';
      const data = await readBody(req);
      const dest = path.join(settings.dataFolder, path.basename(name));
      fs.mkdirSync(settings.dataFolder, { recursive: true });
      fs.writeFileSync(dest, data);
      settings.masterExcelFile = dest;
      settings.masterFileUploaded = true;
      settings.masterFileName = path.basename(name);
      saveSettings(settings);
      sendJson(res, 200, { ok: true, path: dest });
      return;
    }
    if (p === '/api/upload-docs' && req.method === 'POST') {
      const name = req.headers['x-file-name'] || 'document.bin';
      const dir = path.join(settings.dataFolder, 'docs');
      const data = await readBody(req);
      const dest = safeUploadPath(dir, name);
      fs.writeFileSync(dest, data);
      settings.companyDocsUploaded = true;
      settings.companyDocsName = path.basename(dest);
      saveSettings(settings);
      sendJson(res, 200, { ok: true, path: dest });
      return;
    }

    // ── automation control ──
    if (p === '/api/automation/start' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const fp = body.filePath || state.filePath;
      if (!fp) { sendJson(res, 400, { error: 'No Excel file selected' }); return; }
      const r = startAutomation(fp);
      sendJson(res, r.error ? 409 : 200, r);
      return;
    }
    if (p === '/api/automation/stop' && req.method === 'POST') { sendJson(res, 200, stopAutomation()); return; }
    if (p === '/api/automation/pause' && req.method === 'POST') {
      if (!state.child) { sendJson(res, 409, { error: 'No automation is running' }); return; }
      try { fs.writeFileSync(path.join(state.stateDir, 'PAUSE'), ''); } catch (_) { /* ignore */ }
      sendJson(res, 200, { ok: true });
      return;
    }
    if (p === '/api/automation/resume' && req.method === 'POST') {
      try { fs.rmSync(path.join(state.stateDir || '', 'PAUSE'), { force: true }); } catch (_) { /* ignore */ }
      sendJson(res, 200, { ok: true });
      return;
    }
    if (p === '/api/automation/respond' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const kind = body.kind || (state.pendingPrompt && state.pendingPrompt.kind) || 'generic';
      const confirmed = body.confirmed !== false;
      if (kind === 'next-entry') writeToEngine(confirmed ? 'yes' : 'q');
      else if (kind === 'finished' && !confirmed) { state.pendingPrompt = null; sendJson(res, 200, { ok: true, held: true }); return; }
      else writeToEngine(confirmed ? '' : 'q');
      sendJson(res, 200, { ok: true });
      return;
    }

    // ── reports ──
    if (p === '/api/reports' && req.method === 'GET') {
      const dir = settings.reportsFolder;
      const files = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((f) => /^RMA_REPORT_.*\.(xlsx|csv)$/i.test(f)).map((f) => {
            const st = fs.statSync(path.join(dir, f));
            return { name: f, size: st.size, modified: st.mtime };
          }).sort((a, b) => b.modified - a.modified)
        : [];
      sendJson(res, 200, { files });
      return;
    }
    if (p === '/api/reports/download' && req.method === 'GET') {
      const name = u.searchParams.get('file');
      const dir = settings.reportsFolder;
      let file = name ? path.join(dir, path.basename(name)) : null;
      if (!file && fs.existsSync(dir)) {
        const latest = fs.readdirSync(dir).filter((f) => /^RMA_REPORT_.*\.(xlsx)$/i.test(f)).map((f) => path.join(dir, f)).sort().pop();
        file = latest || null;
      }
      if (!file || !fs.existsSync(file) || !path.resolve(file).startsWith(path.resolve(dir))) { sendJson(res, 404, { error: 'No report found' }); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${path.basename(file)}"` });
      fs.createReadStream(file).pipe(res);
      return;
    }

    // ── misc ──
    if (p === '/api/open-browser' && req.method === 'POST') {
      try { spawn('cmd', ['/c', 'start', '', settings.rmaUrl], { detached: true, stdio: 'ignore' }).unref(); } catch (_) { /* ignore */ }
      sendJson(res, 200, { ok: true });
      return;
    }
    if (p === '/api/health' && req.method === 'GET') { sendJson(res, 200, { ok: true, engine: fs.existsSync(ENGINE) }); return; }

    if (p.startsWith('/api/')) { sendJson(res, 404, { error: 'Unknown endpoint' }); return; }
    serveStatic(req, res, p);
  } catch (e) {
    sendJson(res, 500, { error: e.message || String(e) });
  }
});

server.listen(PORT, () => {
  console.log(`CRM-Automation control server: http://localhost:${PORT}`);
  console.log(`Engine: ${fs.existsSync(ENGINE) ? ENGINE : 'MISSING - ' + ENGINE}`);
  console.log(`UI dist: ${fs.existsSync(UI_DIST) ? 'built' : 'not built (npm run ui:build, or npm run ui:dev for development)'}`);
});
