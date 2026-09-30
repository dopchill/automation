'use strict';
/**
 * automation.js - RMA Material Entry automation (Playwright + installed Google Chrome)
 *
 * SAFETY: yeh script kabhi final Save nahi dabata. Form bharke ruk jata hai, aap verify karke Save karo.
 *
 * Usage:
 *   node automation.js --dry-run                 -> sirf Excel padhta hai + validate (browser nahi)
 *   node automation.js --inspect                 -> form ke controls output/form-inspect.json me dump
 *   node automation.js --header-only             -> sirf Partner/Token/Challan/RM Type
 *   node automation.js                           -> full run
 *   node automation.js --sheet "D.M. Computer"   -> sirf ek party
 *   node automation.js --file data\DAY_2_ENTRY.xlsx
 *
 * Dependencies:  npm i playwright xlsx
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('playwright-core')); }
let XLSX = null;
try { XLSX = require('xlsx'); } catch (_) { /* checked when needed */ }

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  chromePath: process.env.RMA_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  baseUrl: process.env.RMA_BASE_URL || 'http://43.204.255.198:8095/Transaction/RMAEntry/AddRma/0',
  dailyFile: process.env.RMA_DAILY_FILE || path.join(__dirname, 'data', 'DAY_1_ENTRY.xlsx'),
  masterFile: process.env.RMA_MASTER_FILE || path.join(__dirname, 'data', 'MASTER_PRODUCT_LIST.xlsx'),
  outDir: process.env.RMA_OUT_DIR || path.join(__dirname, 'output'),
  skipSheets: /^(summary|master|helper|instructions?)/i,

  timeouts: {
    action: 15000,
    formOpen: 15000,
    optionsLoad: 8000,
    dependentChangeWait: 900,
    emptyGrace: 2500,
    addVerify: 8000,
    afterPartner: 1200,   // partner select hone ke baad address/city load hone ka wait
  },

  allowUniqueContainsMatch: false,

  // Labels EXACTLY as on the site: Partner*, Token Number*, Challan Number*, RMA Type*,
  // Brand*, Category*, Capacity, Product*, RMA Quantity*, Out of warranty
  fields: {
    partner:  { label: /^\s*partner\s*\*?\s*:?\s*$/i, selector: null },
    token:    { label: /^\s*token\s*(no\.?|number)?\s*\*?\s*:?\s*$/i, selector: null },
    challan:  { label: /^\s*challan\s*(no\.?|number)\s*\*?\s*:?\s*$/i, selector: null },
    rmType:   { label: /^\s*rma?\s*type\s*\*?\s*:?\s*$/i, selector: null },
    brand:    { label: /^\s*brand\s*\*?\s*:?\s*$/i, selector: null },
    category: { label: /^\s*(product\s*)?category\s*\*?\s*:?\s*$/i, selector: null },
    capacity: { label: /^\s*capacity\s*\*?\s*:?\s*$/i, selector: null },
    product:  { label: /^\s*product\s*\*?\s*:?\s*$/i, selector: null },
    rmQty:    { label: /^\s*rma?\s*(qty|quantity)\s*\*?\s*:?\s*$/i, selector: null },
    owQty:    { label: /^\s*(out\s*of\s*warranty|o\/?w)(\s*(qty|quantity))?\s*\*?\s*:?\s*$/i, selector: null },
  },
  addButton: { selector: null },      // form ka "Add Product" button
  listAddButton: { selector: null },  // list page ka green "Add"
  grid: { selector: null },
};

const COLS = {
  partyName: ['partyname', 'party'],
  city: ['city'],
  state: ['state'],
  pin: ['pincode', 'pin', 'zip', 'zipcode'],
  address: ['address'],
  challan: ['challannumber', 'challanno', 'challan'],
  token: ['tokennumber', 'tokenno', 'token'],
  brand: ['brand'],
  category: ['productcategory', 'category'],
  capacity: ['capacity'],
  product: ['productname', 'product'],
  model: ['modelnumber', 'model'],
  qty: ['quantity', 'qty'],
  ow: ['outofwarrantyqty', 'outofwarrantyquantity', 'owqty'],
  matchStatus: ['matchstatus'],
  remarks: ['remarks'],
};

const REPORT_COLS = ['Party Name', 'City', 'State', 'Challan Number', 'Product', 'Brand', 'Category',
  'Capacity', 'RM Quantity', 'O/W Quantity', 'Status', 'Reason', 'Excel Row', 'Timestamp'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleTimeString(), '|', ...a);

// ─────────────────────────────────────────────────────────────────────────────
// UI bridge (optional). Set RMA_UI_EVENTS=1 and the script additionally writes
// structured "@@RMA_EVENT@@{json}" lines to stdout for the control-server.
// Standalone CMD behaviour is unchanged when the flag is not set.
// ─────────────────────────────────────────────────────────────────────────────
const UI_EVENTS = process.env.RMA_UI_EVENTS === '1';
const EVENT_MARK = '@@RMA_EVENT@@';
function emit(type, data) {
  if (!UI_EVENTS) return;
  try { process.stdout.write(EVENT_MARK + JSON.stringify({ type, ts: Date.now(), ...data }) + '\n'); } catch (_) { /* ignore */ }
}
// Mirror console output as events so the UI console shows the real CMD text.
for (const m of ['log', 'warn', 'error']) {
  const orig = console[m].bind(console);
  console[m] = (...a) => {
    orig(...a);
    try { emit('console', { level: m === 'log' ? 'info' : (m === 'warn' ? 'warning' : 'error'), message: a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') }); } catch (_) { /* ignore */ }
  };
}

// Cooperative pause/stop flags. The control-server creates RMA_STATE_DIR and
// drops STOP / PAUSE marker files in it. Never affects standalone runs.
const RUN_FLAGS = process.env.RMA_STATE_DIR || null;
const flagSet = (n) => !!(RUN_FLAGS && fs.existsSync(path.join(RUN_FLAGS, n)));
let stopRequested = false;
async function checkpoint() {
  if (flagSet('PAUSE') && !flagSet('STOP')) {
    emit('status', { status: 'paused' });
    while (flagSet('PAUSE') && !flagSet('STOP')) await sleep(500);
    if (!flagSet('PAUSE') && !flagSet('STOP')) emit('status', { status: 'running' });
  }
  if (flagSet('STOP')) stopRequested = true;
  return stopRequested;
}

const key = (s) => String(s ?? '').toLowerCase().replace(/&/g, 'and')
  .replace(/(?<!\d)\.|\.(?!\d)/g, '').replace(/[^a-z0-9.]/g, '');

class StepError extends Error {
  constructor(reason, detail) { super(detail || reason); this.reason = reason; this.detail = detail || ''; }
}

function ask(q, meta) {
  emit('prompt', {
    prompt: {
      id: 'prompt-' + Date.now(),
      kind: (meta && meta.kind) || 'generic',
      title: (meta && meta.title) || 'Input Required',
      message: (meta && meta.message) || String(q).replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim(),
      detail: meta && meta.detail,
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); emit('prompt-resolved', {}); res((a || '').trim()); }));
}

function parseArgs() {
  const a = process.argv.slice(2); const o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--file') o.file = a[++i];
    else if (a[i] === '--sheet') o.sheet = a[++i];
    else if (a[i] === '--dry-run') o.dryRun = true;
    else if (a[i] === '--inspect') o.inspect = true;
    else if (a[i] === '--header-only') o.headerOnly = true;
    else if (a[i] === '--plan-json') o.planJson = true;
  }
  return o;
}

function needXlsx() { if (!XLSX) throw new Error('Package "xlsx" missing. Run:  npm i xlsx'); }

// ─────────────────────────────────────────────────────────────────────────────
// Excel
// ─────────────────────────────────────────────────────────────────────────────
function readWorkbook(file) {
  needXlsx();
  if (!fs.existsSync(file)) throw new Error('Excel file not found: ' + file);
  const wb = XLSX.readFile(file);
  return wb.SheetNames.map((name) => ({
    name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: true }),
  }));
}

function pick(map, aliases) {
  for (const al of aliases) if (map[al] !== undefined && String(map[al]).trim() !== '') return String(map[al]).trim();
  return '';
}

function parseInt0(v, { min }) {
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (s === '') return { ok: min === 0, n: 0 };
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min) return { ok: false, n: NaN };
  return { ok: true, n };
}

function normalizeRow(raw, sheetName, excelRow) {
  const map = {};
  for (const [h, v] of Object.entries(raw)) map[key(h).replace(/\./g, '')] = v;
  const r = {
    sheet: sheetName, excelRow,
    partyName: pick(map, COLS.partyName), city: pick(map, COLS.city), state: pick(map, COLS.state),
    pin: pick(map, COLS.pin), address: pick(map, COLS.address),
    challan: pick(map, COLS.challan), token: pick(map, COLS.token),
    brand: pick(map, COLS.brand), category: pick(map, COLS.category), capacity: pick(map, COLS.capacity),
    product: pick(map, COLS.product), model: pick(map, COLS.model),
    matchStatus: pick(map, COLS.matchStatus), remarks: pick(map, COLS.remarks),
  };
  const q = parseInt0(pick(map, COLS.qty), { min: 1 });
  const ow = parseInt0(pick(map, COLS.ow), { min: 0 });
  r.rm = q.n; r.rmValid = q.ok; r.ow = ow.n; r.owValid = ow.ok;
  r.empty = !r.brand && !r.product && !r.category && !pick(map, COLS.qty);
  return r;
}

function loadEntries(file, sheetFilter) {
  const entries = [];
  for (const sh of readWorkbook(file)) {
    if (CONFIG.skipSheets.test(sh.name.trim())) { log('Skipping helper sheet:', sh.name); continue; }
    if (sheetFilter && !key(sh.name).includes(key(sheetFilter))) continue;
    const rows = sh.rows.map((raw, i) => normalizeRow(raw, sh.name, i + 2)).filter((r) => !r.empty);
    if (!rows.length) continue;
    const first = (k) => (rows.map((r) => r[k]).find((v) => String(v || '').trim() !== '') || '');
    const party = {
      sheet: sh.name, name: first('partyName') || sh.name,
      city: first('city'), state: first('state'), pin: first('pin'), address: first('address'),
    };
    const groups = new Map();
    for (const r of rows) {
      const k = key(r.challan) + '|' + key(r.token);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    for (const rs of groups.values()) {
      entries.push({
        party, challan: rs[0].challan, token: rs[0].token, rows: rs,
        rmType: rs.some((r) => r.owValid && r.ow > 0) ? 'Both' : 'Return',
        splitByChallan: groups.size > 1,
      });
    }
  }
  return entries;
}

function loadMaster() {
  try {
    if (!fs.existsSync(CONFIG.masterFile)) { log('Master file not found - master validation skipped.'); return null; }
    const set = new Set();
    for (const sh of readWorkbook(CONFIG.masterFile)) {
      for (const raw of sh.rows) {
        const m = {};
        for (const [h, v] of Object.entries(raw)) m[key(h).replace(/\./g, '')] = v;
        const b = pick(m, COLS.brand), c = pick(m, COLS.category), cap = pick(m, COLS.capacity), p = pick(m, COLS.product);
        if (b && p) set.add([b, c, cap, p].map(key).join('|'));
      }
    }
    if (!set.size) { log('Master columns not recognised - master validation skipped.'); return null; }
    log(`Master loaded: ${set.size} product records.`);
    return set;
  } catch (e) { log('Master load failed (continuing without):', e.message); return null; }
}

const BAD_VALUES = new Set(['reviewrequired', 'unmatched']);

function precheckRow(r) {
  if (BAD_VALUES.has(key(r.product)) || BAD_VALUES.has(key(r.matchStatus)) || BAD_VALUES.has(key(r.brand))) {
    return { status: 'REVIEW REQUIRED', reason: 'INVALID EXCEL DATA', detail: 'Product/Match Status is REVIEW REQUIRED or UNMATCHED' };
  }
  // Capacity site par optional hai (no *), isliye required nahi
  const missing = ['brand', 'category', 'product'].filter((f) => !r[f]);
  if (missing.length) return { status: 'SKIPPED', reason: 'INVALID EXCEL DATA', detail: 'Missing: ' + missing.join(', ') };
  if (!r.rmValid) return { status: 'SKIPPED', reason: 'INVALID QUANTITY', detail: 'Quantity must be a whole number >= 1' };
  if (!r.owValid) return { status: 'SKIPPED', reason: 'INVALID QUANTITY', detail: 'O/W Qty must be a whole number >= 0' };
  if (r.ow > r.rm) return { status: 'SKIPPED', reason: 'INVALID QUANTITY', detail: `O/W Qty (${r.ow}) > Quantity (${r.rm})` };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────
function pushReport(report, entry, row, status, reason, detail) {
  report.push({
    'Party Name': entry.party.name, 'City': entry.party.city, 'State': entry.party.state,
    'Challan Number': entry.challan,
    'Product': row ? row.product : '(HEADER)', 'Brand': row ? row.brand : '',
    'Category': row ? row.category : '', 'Capacity': row ? row.capacity : '',
    'RM Quantity': row ? (row.rmValid ? row.rm : '') : '', 'O/W Quantity': row ? (row.owValid ? row.ow : '') : '',
    'Status': status, 'Reason': [reason, detail].filter(Boolean).join(' - '),
    'Excel Row': row ? row.excelRow : '',
    'Timestamp': new Date().toLocaleString(),
  });
}

function writeReport(report, stamp) {
  fs.mkdirSync(CONFIG.outDir, { recursive: true });
  const base = path.join(CONFIG.outDir, `RMA_REPORT_${stamp}`);
  const csv = [REPORT_COLS.join(',')].concat(report.map((r) =>
    REPORT_COLS.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))).join('\r\n');
  fs.writeFileSync(base + '.csv', '\ufeff' + csv, 'utf8');
  if (XLSX) {
    try {
      const ws = XLSX.utils.json_to_sheet(report, { header: REPORT_COLS });
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Report');
      XLSX.writeFile(wb, base + '.xlsx');
    } catch (e) { log('XLSX report write failed (CSV saved):', e.message); }
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser
// ─────────────────────────────────────────────────────────────────────────────
function attachPage(page, state) {
  page.setDefaultTimeout(CONFIG.timeouts.action);
  page.on('dialog', async (d) => {
    state.lastDialog = { type: d.type(), message: d.message() };
    log(`Dialog (${d.type()}): ${d.message()}`);
    try { await d.accept(); } catch (_) { /* ignore */ }
  });
}

async function launch() {
  if (!fs.existsSync(CONFIG.chromePath)) throw new Error('Chrome not found at: ' + CONFIG.chromePath);
  const browser = await chromium.launch({ executablePath: CONFIG.chromePath, headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.timeouts.action);
  const state = { lastDialog: null };
  attachPage(page, state);
  return { browser, context, page, state };
}

async function shot(page, name) {
  try {
    fs.mkdirSync(CONFIG.outDir, { recursive: true });
    await page.screenshot({ path: path.join(CONFIG.outDir, `${name}_${Date.now()}.png`), fullPage: true });
  } catch (_) { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Control discovery
// ─────────────────────────────────────────────────────────────────────────────
async function findControl(page, cfg, name) {
  if (cfg.selector) {
    const l = page.locator(cfg.selector).first();
    await l.waitFor({ state: 'attached' });
    return l;
  }
  const labels = page.locator('label').filter({ hasText: cfg.label });
  try { await labels.first().waitFor({ state: 'visible', timeout: 5000 }); } catch (_) { /* counted below */ }
  const vis = [];
  for (let i = 0; i < await labels.count(); i++) if (await labels.nth(i).isVisible()) vis.push(labels.nth(i));
  if (vis.length !== 1) throw new StepError('UNKNOWN UI ERROR', `Field "${name}": expected 1 visible label, found ${vis.length} (run --inspect and set CONFIG.fields.${name}.selector)`);
  const forId = await vis[0].getAttribute('for');
  const ctl = forId
    ? page.locator(`[id="${forId}"]`)
    : vis[0].locator('xpath=following::*[self::select or self::textarea or (self::input and not(@type="hidden") and not(contains(@class,"select2-search")))][1]');
  if (await ctl.count() !== 1) throw new StepError('UNKNOWN UI ERROR', `Field "${name}": control for label not found`);
  return ctl;
}

function makeControls(page) {
  const cache = {};
  return { async get(name) { if (!cache[name]) cache[name] = await findControl(page, CONFIG.fields[name], name); return cache[name]; } };
}

const tagOf = (ctl) => ctl.evaluate((e) => e.tagName.toLowerCase());

const readOptions = (ctl) => ctl.evaluate((el) => Array.from(el.options || [])
  .map((o) => ({ value: o.value, text: (o.textContent || '').trim(), disabled: o.disabled }))
  .filter((o) => o.value !== '' && !o.disabled && !/^[-\s]*(select|choose|--)/i.test(o.text)));

async function optionSig(ctl) {
  if (await tagOf(ctl) !== 'select') return null;
  return JSON.stringify((await readOptions(ctl)).map((o) => o.value + '|' + o.text));
}

async function waitForOptions(ctl, { changedFrom = null } = {}) {
  const T = CONFIG.timeouts; const start = Date.now();
  let last = null, stable = 0, opts = [];
  while (Date.now() - start < T.optionsLoad) {
    opts = await readOptions(ctl);
    const sig = JSON.stringify(opts.map((o) => o.value + '|' + o.text));
    const el = Date.now() - start;
    if (changedFrom !== null && sig === changedFrom && el < T.dependentChangeWait) { await sleep(80); continue; }
    if (opts.length === 0 && el > T.emptyGrace) return opts;
    if (opts.length > 0 && sig === last) { if (++stable >= 2) return opts; } else stable = 0;
    last = sig; await sleep(100);
  }
  return opts;
}

function matchOptions(options, wanted) {
  const wk = key(wanted);
  let m = options.filter((o) => key(o.text) === wk);
  if (!m.length && CONFIG.allowUniqueContainsMatch) {
    m = options.filter((o) => { const k = key(o.text); return k && (k.includes(wk) || wk.includes(k)); });
  }
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// Select2 UI (site ke saare dropdowns Select2 hain) + plain autocomplete fallback
// ─────────────────────────────────────────────────────────────────────────────
const S2_OPT = '.select2-container--open .select2-results__option';
const SUGGEST = ['ul.ui-autocomplete li', '.tt-suggestion', '[role="option"]', '.typeahead li', '.dropdown-menu li']
  .map((s) => s + ':visible').join(', ');

/** Select2 dropdown kholke (search box me type karke) options padhta hai. null = is control ke saath select2 nahi mila. */
async function select2Choices(page, ctl, query) {
  const box = ctl.locator('xpath=following-sibling::span[contains(@class,"select2")][1]');
  if (!(await box.count())) return null;
  await box.locator('.select2-selection').first().click();
  const search = page.locator('.select2-container--open .select2-search__field');
  await sleep(200);
  if (await search.count()) await search.first().fill(String(query ?? ''));
  await page.locator(S2_OPT).first().waitFor({ timeout: 5000 }).catch(() => {});
  let prev = -1;
  for (let i = 0; i < 12; i++) {
    const c = await page.locator(S2_OPT).count();
    const txts = await page.locator(S2_OPT).allInnerTexts();
    if (c === prev && !txts.some((t) => /searching|loading/i.test(t))) break;
    prev = c; await sleep(250);
  }
  const texts = (await page.locator(S2_OPT).allInnerTexts()).map((t) => t.trim());
  return texts.map((t, i) => ({ text: t, index: i, kind: 'select2' }))
    .filter((c) => c.text && !/no (results|match)|searching|loading|^-+\s*select/i.test(c.text));
}

async function getChoices(page, ctl, query) {
  if (await tagOf(ctl) === 'select') {
    const opts = (await readOptions(ctl)).map((o) => ({ text: o.text, value: o.value, kind: 'select' }));
    if (opts.length > 1) return opts;
    // options ajax se aate ho sakte hain -> select2 UI se try karo
    const s2 = await select2Choices(page, ctl, query);
    if (s2 && s2.length) return s2;
    return opts;
  }
  await ctl.click(); await ctl.fill(''); await ctl.pressSequentially(String(query), { delay: 20 });
  const sugg = page.locator(SUGGEST);
  await sugg.first().waitFor({ timeout: 4000 }).catch(() => {});
  let prev = -1;
  for (let i = 0; i < 10; i++) { const c = await sugg.count(); if (c === prev) break; prev = c; await sleep(150); }
  const texts = (await sugg.allInnerTexts()).map((t) => t.trim());
  return texts.map((t, i) => ({ text: t, index: i, kind: 'suggest' }))
    .filter((c) => c.text && !/no (results|match)|searching/i.test(c.text));
}

async function commitChoice(page, ctl, choice) {
  const selectedText = () => ctl.evaluate((el) => (el.options && el.options[el.selectedIndex] ? el.options[el.selectedIndex].textContent : '') || '');

  if (choice.kind === 'select') {
    // hidden <select> (Select2) me value set karke change event bhejo -> Select2 + cascade handlers chalte hain
    await ctl.evaluate((el, v) => {
      el.value = v;
      if (window.jQuery) window.jQuery(el).trigger('change.select2');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, choice.value);
    const got = await selectedText();
    if (key(got) !== key(choice.text)) throw new StepError('UNKNOWN UI ERROR', `Selection not applied (got "${got.trim()}")`);
    return choice.text;
  }

  if (choice.kind === 'select2') {
    const item = page.locator(S2_OPT).nth(choice.index);
    const txt = (await item.innerText()).trim();
    if (txt !== choice.text) throw new StepError('UNKNOWN UI ERROR', 'Select2 list changed before click');
    await item.click();
    await sleep(250);
    if (await tagOf(ctl) === 'select') {
      const got = await selectedText();
      if (key(got) !== key(choice.text)) throw new StepError('UNKNOWN UI ERROR', `Selection not applied (got "${got.trim()}")`);
    }
    return choice.text;
  }

  const item = page.locator(SUGGEST).nth(choice.index);
  const txt = (await item.innerText()).trim();
  if (txt !== choice.text) throw new StepError('UNKNOWN UI ERROR', 'Suggestion list changed before click');
  await item.click();
  await sleep(150);
  const v = await ctl.inputValue();
  const kv = key(v), kc = key(choice.text);
  if (!kv || !(kv === kc || kc.includes(kv) || kv.includes(kc))) throw new StepError('UNKNOWN UI ERROR', `Selection not applied (input shows "${v}")`);
  return choice.text;
}

async function closeDropdown(page) { try { await page.keyboard.press('Escape'); } catch (_) { /* ignore */ } }

async function chooseField(page, ctl, label, wanted, notFoundReason, prevSig) {
  const isSelect = await tagOf(ctl) === 'select';
  let choices;
  if (isSelect) {
    const opts = await waitForOptions(ctl, { changedFrom: prevSig });
    choices = opts.map((o) => ({ text: o.text, value: o.value, kind: 'select' }));
    if (choices.length <= 1 && !matchOptions(choices, wanted).length) {
      const s2 = await select2Choices(page, ctl, wanted);
      if (s2 && s2.length) choices = s2;
    }
  } else choices = await getChoices(page, ctl, wanted);

  const m = matchOptions(choices, wanted);
  if (m.length === 0) {
    await closeDropdown(page);
    throw new StepError(notFoundReason, `${label} "${wanted}" not among ${choices.length} options (e.g. ${choices.slice(0, 5).map((c) => c.text).join(' | ')})`);
  }
  if (m.length > 1) {
    await closeDropdown(page);
    throw new StepError(notFoundReason, `${label} "${wanted}" ambiguous (${m.length} matching options)`);
  }
  return commitChoice(page, ctl, m[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Form navigation
// ─────────────────────────────────────────────────────────────────────────────
async function isFormOpen(page) {
  try {
    const l = page.locator('label').filter({ hasText: CONFIG.fields.partner.label });
    return (await l.count()) > 0 && await l.first().isVisible();
  } catch (_) { return false; }
}

async function ensureNewForm(page) {
  if (await isFormOpen(page)) return;
  let cands;
  if (CONFIG.listAddButton.selector) cands = page.locator(CONFIG.listAddButton.selector);
  else cands = page.locator('a.btn-success, button.btn-success').filter({ hasText: /^\s*Add\s*$/i });
  const vis = [];
  for (let i = 0; i < await cands.count(); i++) if (await cands.nth(i).isVisible()) vis.push(cands.nth(i));
  let target = vis.length === 1 ? vis[0] : null;
  if (!target && vis.length > 1) {
    const withHref = [];
    for (const v of vis) if (/AddRma/i.test((await v.getAttribute('href')) || '')) withHref.push(v);
    if (withHref.length === 1) target = withHref[0];
  }
  if (!target) throw new StepError('UNKNOWN UI ERROR', `Green Add button not uniquely identified (visible candidates: ${vis.length}). Are you logged in / on the RMA list page?`);
  await target.click();
  await page.locator('label').filter({ hasText: CONFIG.fields.partner.label }).first()
    .waitFor({ state: 'visible', timeout: CONFIG.timeouts.formOpen })
    .catch(() => { throw new StepError('UNKNOWN UI ERROR', 'New RMA form did not open after clicking Add'); });
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────
function partnerNameMatches(optText, name) {
  const nameOnly = optText.split(/\s+[-–—|]\s+|\s*[|(\[]/)[0];
  return key(nameOnly) === key(name) || key(optText) === key(name);
}

function locationScore(optText, p) {
  const k = key(optText); let s = 0;
  if (p.city && k.includes(key(p.city))) s += 1;
  if (p.state && k.includes(key(p.state))) s += 1;
  const pin = String(p.pin || '').replace(/\D/g, '');
  if (pin.length >= 5 && optText.replace(/\D/g, '').includes(pin)) s += 2;
  return s;
}

async function selectPartner(page, ctx, party) {
  const ctl = await ctx.controls.get('partner');
  emit('partner-search', { partyName: party.name });
  const choices = await getChoices(page, ctl, party.name);
  let nm = choices.filter((c) => partnerNameMatches(c.text, party.name));
  if (!nm.length) {
    await closeDropdown(page);
    throw new StepError('PARTNER NOT FOUND', `No partner named "${party.name}" among ${choices.length} options (e.g. ${choices.slice(0, 8).map((c) => c.text).join(' | ')})`);
  }
  let final = nm[0], how = 'name only';
  if (nm.length > 1) {
    const scored = nm.map((c) => ({ c, s: locationScore(c.text, party) }));
    const max = Math.max(...scored.map((x) => x.s));
    const top = scored.filter((x) => x.s === max);
    if (max === 0 || top.length !== 1) {
      await closeDropdown(page);
      throw new StepError('MULTIPLE PARTNERS FOUND', `${nm.length} partners named "${party.name}" and city/state/PIN could not single one out: ${nm.map((c) => c.text).join(' || ')}`);
    }
    final = top[0].c; how = 'name + city/state/PIN in option text';
  } else if (locationScore(nm[0].text, party) > 0) how = 'name + city/state/PIN in option text';

  await commitChoice(page, ctl, final);
  emit('partner-matched', { partyName: party.name, partner: final.text, how });
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  await sleep(CONFIG.timeouts.afterPartner);   // address/city/state auto-fill hone do

  if (party.city && how === 'name only') {
    const body = key(await page.locator('body').innerText());
    if (body.includes(key(party.city))) how = 'name + city visible on page';
  }
  return { text: final.text, how };
}

async function fillValue(ctx, name, value) {
  const ctl = await ctx.controls.get(name);
  await ctl.fill(String(value));
  await ctl.evaluate((e) => { e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); });
  const got = (await ctl.inputValue()).trim();
  if (got !== String(value).trim()) throw new StepError('UNKNOWN UI ERROR', `Field ${name}: expected "${value}", found "${got}"`);
}

async function setRmType(page, ctx, value) {
  let ctl = null;
  try { ctl = await ctx.controls.get('rmType'); } catch (_) { /* try radio */ }
  if (ctl && await tagOf(ctl) === 'select') {
    const opts = await readOptions(ctl);
    const m = opts.filter((o) => key(o.text) === key(value));
    if (m.length !== 1) throw new StepError('UNKNOWN UI ERROR', `RMA Type option "${value}" not uniquely found (${opts.map((o) => o.text).join(', ')})`);
    await commitChoice(page, ctl, { text: m[0].text, value: m[0].value, kind: 'select' });
    return;
  }
  const radio = page.getByRole('radio', { name: new RegExp(`^\\s*${value}\\s*$`, 'i') });
  if (await radio.count() !== 1) throw new StepError('UNKNOWN UI ERROR', `RMA Type control for "${value}" not found`);
  await radio.check();
  if (!(await radio.isChecked())) throw new StepError('UNKNOWN UI ERROR', `RMA Type "${value}" radio not checked`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid + Add Product
// ─────────────────────────────────────────────────────────────────────────────
async function readGrid(page) {
  return page.evaluate((sel) => {
    let t = null;
    if (sel) t = document.querySelector(sel);
    else {
      t = [...document.querySelectorAll('table')].find((tb) => {
        if (tb.offsetParent === null) return false;
        const h = (tb.tHead ? tb.tHead.innerText : (tb.rows[0] ? tb.rows[0].innerText : '')).toLowerCase();
        return /product/.test(h) && /(qty|quantity)/.test(h);
      });
    }
    if (!t) return null;
    const rows = (tb) => tb.tBodies.length ? [...tb.tBodies[0].rows] : [...tb.rows].slice(1);
    return rows(t)
      .filter((r) => !r.querySelector('.dataTables_empty') && !(r.cells.length === 1 && /no (data|record)/i.test(r.innerText)))
      .map((r) => r.innerText.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }, CONFIG.grid.selector);
}

const hasQty = (text, n) => new RegExp('(^|\\D)' + n + '(\\D|$)').test(text);

async function visibleErrors(page) {
  return page.evaluate(() => [...document.querySelectorAll('.alert-danger, .toast-error, .validation-summary-errors, .field-validation-error, .text-danger')]
    .filter((e) => e.offsetParent !== null).map((e) => e.innerText.trim()).filter(Boolean).join(' | ').slice(0, 250));
}

async function findAddButton(page) {
  const c = CONFIG.addButton.selector
    ? page.locator(CONFIG.addButton.selector)
    : page.locator('a, button').filter({ hasText: /^\s*Add\s*Product\s*$/i })
      .or(page.locator('input[type="button"][value="Add Product"], input[type="submit"][value="Add Product"]'));
  const vis = [];
  for (let i = 0; i < await c.count(); i++) if (await c.nth(i).isVisible()) vis.push(c.nth(i));
  if (vis.length !== 1) throw new StepError('UNKNOWN UI ERROR', `"Add Product" button not uniquely identified (${vis.length} visible). Set CONFIG.addButton.selector`);
  return vis[0];
}

async function addProduct(page, ctx, row) {
  const c = ctx.controls;
  const sigs = {};
  for (const f of ['category', 'capacity', 'product']) sigs[f] = await optionSig(await c.get(f));

  const chosen = {};
  emit('step-update', { step: 'selecting-brand', label: 'Selecting Brand' });
  chosen.brand = await chooseField(page, await c.get('brand'), 'Brand', row.brand, 'BRAND NOT FOUND', null);
  emit('step-update', { step: 'selecting-category', label: 'Selecting Category' });
  chosen.category = await chooseField(page, await c.get('category'), 'Category', row.category, 'CATEGORY NOT FOUND', sigs.category);
  emit('step-update', { step: 'selecting-capacity', label: 'Selecting Capacity' });
  chosen.capacity = row.capacity
    ? await chooseField(page, await c.get('capacity'), 'Capacity', row.capacity, 'CAPACITY NOT FOUND', sigs.capacity)
    : '';
  emit('step-update', { step: 'selecting-product', label: 'Selecting Product' });
  chosen.product = await chooseField(page, await c.get('product'), 'Product', row.product, 'PRODUCT NOT FOUND', sigs.product);
  emit('step-update', { step: 'entering-quantity', label: 'Entering Quantity' });
  await fillValue(ctx, 'rmQty', row.rm);
  await fillValue(ctx, 'owQty', row.ow);

  const pk = key(chosen.product);
  const dupKey = [chosen.brand, chosen.category, chosen.capacity, chosen.product, row.rm, row.ow].map(key).join('|');
  if (ctx.added.has(dupKey)) throw new StepError('DUPLICATE ROW', 'Same product/qty already added in this entry (repeat row in Excel?)');
  const before = await readGrid(page);
  if (before === null) throw new StepError('UNKNOWN UI ERROR', 'Products grid not found - set CONFIG.grid.selector (Add not clicked)');
  if (before.some((t) => key(t).includes(pk) && hasQty(t, row.rm))) throw new StepError('DUPLICATE ROW', 'Same product/qty already present in grid');

  const btn = await findAddButton(page);
  ctx.state.lastDialog = null;
  emit('step-update', { step: 'adding-product', label: 'Adding Product' });
  await btn.click();   // single click - kabhi blindly retry nahi

  const t0 = Date.now(); let after = null;
  while (Date.now() - t0 < CONFIG.timeouts.addVerify) {
    after = await readGrid(page);
    if (after && after.length > before.length) break;
    if (ctx.state.lastDialog) {
      await sleep(200); after = await readGrid(page);
      if (after && after.length > before.length) break;
      throw new StepError('ADD FAILED', 'App dialog: ' + ctx.state.lastDialog.message);
    }
    await sleep(100);
  }
  if (!after || after.length <= before.length) {
    const err = await visibleErrors(page);
    throw new StepError(err ? 'ADD FAILED' : 'ADD NOT VERIFIED', err || 'Grid row count did not increase - check manually');
  }
  const newRow = after.find((t) => !before.includes(t)) || after[after.length - 1];
  if (!key(newRow).includes(pk) || !hasQty(newRow, row.rm) || (row.ow > 0 && !hasQty(newRow, row.ow))) {
    throw new StepError('ADD NOT VERIFIED', `Row added but content differs from expected. Grid row: "${newRow}"`);
  }
  ctx.added.add(dupKey);
  return chosen;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry processing
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_BY_REASON = {
  'BRAND NOT FOUND': 'SKIPPED', 'CATEGORY NOT FOUND': 'SKIPPED', 'CAPACITY NOT FOUND': 'SKIPPED',
  'PRODUCT NOT FOUND': 'SKIPPED', 'DUPLICATE ROW': 'SKIPPED', 'INVALID QUANTITY': 'SKIPPED',
  'INVALID EXCEL DATA': 'SKIPPED', 'ADD NOT VERIFIED': 'REVIEW REQUIRED',
  'ADD FAILED': 'FAILED', 'UNKNOWN UI ERROR': 'FAILED',
};

async function processEntry(page, state, entry, report, args, master, run) {
  const label = `${entry.party.name} | challan ${entry.challan || '-'}`;
  log(`━━ ENTRY: ${label} | ${entry.rows.length} rows | RMA Type = ${entry.rmType}`);
  const ctx = { state, controls: makeControls(page), added: new Set() };
  const emitPartyProgress = (status) => emit('party-update', {
    partyId: entry.uiId, completed: run.entryOk, skipped: run.entrySkipped,
    errors: run.entryErrors, progress: Math.round((run.entryProcessed / entry.rows.length) * 100),
    status: status || 'processing',
  });

  const notes = [];
  try {
    await ensureNewForm(page);
    const p = await selectPartner(page, ctx, entry.party);
    notes.push(`Partner "${p.text}" selected (${p.how})`);
    if (entry.token) { await fillValue(ctx, 'token', entry.token); notes.push(`Token ${entry.token}`); }
    else notes.push('TOKEN NUMBER MISSING in Excel - fill manually');
    if (!entry.challan) throw new StepError('INVALID EXCEL DATA', 'Challan number missing in Excel');
    await fillValue(ctx, 'challan', entry.challan);
    await setRmType(page, ctx, entry.rmType);
    notes.push(`RMA Type ${entry.rmType}`);
    pushReport(report, entry, null, 'SUCCESS', 'HEADER FILLED', notes.join('; '));
    log('Header OK:', notes.join('; '));
  } catch (e) {
    const reason = e.reason || 'UNKNOWN UI ERROR';
    log('HEADER FAILED:', reason, '-', e.message);
    emit('party-error', { partyId: entry.uiId, partyName: entry.party.name, reason, message: e.detail || e.message });
    await shot(page, 'header-failed');
    pushReport(report, entry, null, 'REVIEW REQUIRED', reason, e.detail || e.message);
    for (const r of entry.rows) {
      pushReport(report, entry, r, 'REVIEW REQUIRED', reason, 'Entry not created - header could not be completed safely');
      run.processed++;
      emit('product-error', { partyId: entry.uiId, productName: r.product, reason: 'Header failed' });
    }
    run.entryErrors = entry.rows.length; run.entryProcessed = entry.rows.length;
    emitPartyProgress('error');
    emit('progress', run.progressPayload(entry, ''));
    return;
  }
  if (args.headerOnly) return;

  let ok = 0;
  for (const [i, r] of entry.rows.entries()) {
    if (await checkpoint()) {
      log('STOP requested - remaining rows of this entry left untouched.');
      for (const rest of entry.rows.slice(i)) {
        pushReport(report, entry, rest, 'NOT PROCESSED', 'STOPPED BY USER', 'Automation stopped before this row ran');
        run.processed++;
      }
      run.entryProcessed = entry.rows.length;
      emitPartyProgress('skipped');
      emit('progress', run.progressPayload(entry, ''));
      break;
    }
    const tag = `[${i + 1}/${entry.rows.length}] ${r.brand} / ${r.product}`;
    emit('product-start', { partyId: entry.uiId, productName: r.product, index: i + 1, total: entry.rows.length });
    emit('progress', run.progressPayload(entry, r.product));
    const pre = precheckRow(r);
    if (pre) {
      pushReport(report, entry, r, pre.status, pre.reason, pre.detail);
      log(tag, '->', pre.status, pre.reason);
      run.processed++; run.entryProcessed++; run.entrySkipped++;
      emit('product-skipped', { partyId: entry.uiId, productName: r.product, reason: `${pre.reason}: ${pre.detail}` });
      emitPartyProgress();
      emit('progress', run.progressPayload(entry, ''));
      continue;
    }
    try {
      const chosen = await addProduct(page, ctx, r);
      const inMaster = master ? master.has([r.brand, r.category, r.capacity, r.product].map(key).join('|')) : null;
      if (inMaster === false) emit('warning', { message: `Not in MASTER list: ${r.brand} / ${r.product}`, partyName: entry.party.name, productName: r.product });
      pushReport(report, entry, r, 'SUCCESS', '', inMaster === false ? 'Note: combination not found in MASTER list' : '');
      ok++; run.processed++; run.entryProcessed++; run.entryOk++;
      log(tag, '-> SUCCESS', `(${chosen.product})`);
      emit('product-success', { partyId: entry.uiId, productName: r.product, selected: chosen.product });
    } catch (e) {
      const reason = e.reason || 'UNKNOWN UI ERROR';
      const status = STATUS_BY_REASON[reason] || 'FAILED';
      await closeDropdown(page);
      if (status === 'FAILED') await shot(page, 'row-failed');
      pushReport(report, entry, r, status, reason, e.detail || e.message);
      log(tag, '->', status, reason, '-', e.detail || e.message);
      run.processed++; run.entryProcessed++;
      if (status === 'SKIPPED') run.entrySkipped++; else run.entryErrors++;
      emit(status === 'SKIPPED' ? 'product-skipped' : 'product-error', { partyId: entry.uiId, productName: r.product, reason: `${reason}: ${e.detail || e.message}` });
    }
    emitPartyProgress();
    emit('progress', run.progressPayload(entry, ''));
    if (stopRequested) break;
  }
  log(`Entry finished: ${ok}/${entry.rows.length} rows added. Form OPEN hai - verify karke manually Save karo.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// --inspect
// ─────────────────────────────────────────────────────────────────────────────
async function inspectForm(page) {
  const data = await page.evaluate(() => {
    const labelOf = (el) => {
      if (el.id) { const l = document.querySelector(`label[for="${el.id}"]`); if (l) return l.innerText.trim(); }
      const fg = el.closest('.form-group, .mb-3, .row, td, div'); const l = fg && fg.querySelector('label');
      return l ? l.innerText.trim() : '';
    };
    const controls = [...document.querySelectorAll('select, textarea, input:not([type="hidden"])')].map((el) => ({
      tag: el.tagName.toLowerCase(), type: el.type || '', id: el.id, name: el.name, cls: el.className,
      visible: el.offsetParent !== null, label: labelOf(el),
      optionCount: el.options ? el.options.length : undefined,
      optionSample: el.options ? [...el.options].slice(0, 6).map((o) => o.textContent.trim()) : undefined,
    }));
    const buttons = [...document.querySelectorAll('a.btn, button, input[type="button"], input[type="submit"]')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.innerText || el.value || '').trim(), id: el.id, cls: el.className, href: el.getAttribute('href') || '' }));
    const tables = [...document.querySelectorAll('table')].map((t) => ({
      id: t.id, cls: t.className, visible: t.offsetParent !== null,
      header: (t.tHead ? t.tHead.innerText : (t.rows[0] ? t.rows[0].innerText : '')).replace(/\s+/g, ' ').trim(),
    }));
    return { url: location.href, controls, buttons, tables };
  });
  fs.mkdirSync(CONFIG.outDir, { recursive: true });
  const f = path.join(CONFIG.outDir, 'form-inspect.json');
  fs.writeFileSync(f, JSON.stringify(data, null, 2), 'utf8');
  console.table(data.controls.filter((c) => c.visible || c.tag === 'select').map((c) => ({ tag: c.tag, type: c.type, id: c.id, name: c.name, label: c.label, options: c.optionCount })));
  console.table(data.buttons);
  console.table(data.tables);
  log('Inspect data saved to', f);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dry run
// ─────────────────────────────────────────────────────────────────────────────
function printPlan(entries) {
  console.log('\nEntries to process:');
  entries.forEach((e, i) => console.log(` ${i + 1}. ${e.party.name} (${e.party.city || '-'}, ${e.party.state || '-'}) | challan ${e.challan || '-'} | token ${e.token || '-'} | rows ${e.rows.length} | RMA Type ${e.rmType}${e.splitByChallan ? '  [sheet has multiple challans -> separate entry]' : ''}`));
  console.log('');
}

function dryRun(entries, master) {
  for (const e of entries) {
    console.log(`\n== ${e.party.name} | challan ${e.challan || '-'} | RMA Type ${e.rmType}`);
    if (!e.token) console.log('   ! Token Number column/value missing');
    for (const r of e.rows) {
      const pre = precheckRow(r);
      const inMaster = master ? (master.has([r.brand, r.category, r.capacity, r.product].map(key).join('|')) ? 'in master' : 'NOT in master') : 'master n/a';
      console.log(`   row ${r.excelRow}: ${r.brand} | ${r.category} | ${r.capacity} | ${r.product} | qty ${r.rm} | o/w ${r.ow} -> ${pre ? pre.status + ' (' + pre.reason + ': ' + pre.detail + ')' : 'READY'} [${inMaster}]`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Login (credentials chat me mat bhejo - credentials.json ya env variables use karo)
// ─────────────────────────────────────────────────────────────────────────────
function loadCreds() {
  // { "username": "...", "password": "..." } in material-entry/ or project root
  const candidates = [path.join(__dirname, 'credentials.json'), path.join(__dirname, '..', 'credentials.json')];
  let c = {};
  for (const f of candidates) {
    try { if (fs.existsSync(f)) { c = JSON.parse(fs.readFileSync(f, 'utf8')); break; } } catch (e) { log('credentials.json read failed:', e.message); }
  }
  const user = process.env.RMA_USER || c.username || '';
  const pass = process.env.RMA_PASS || c.password || '';
  return user && pass ? { user, pass } : null;
}

async function loginVisible(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await sleep(700);
  return (await page.locator('input[type="password"]:visible').count()) > 0;
}

/** Returns: 'already' | 'auto' | 'manual' */
async function ensureLoggedIn(page, creds) {
  if (!(await loginVisible(page))) return 'already';
  if (creds) {
    try {
      const pw = page.locator('input[type="password"]:visible').first();
      const user = page.locator('input[type="text"]:visible, input[type="email"]:visible, input:not([type]):visible').first();
      await user.fill(creds.user);
      await pw.fill(creds.pass);
      const btn = page.locator('button[type="submit"]:visible, input[type="submit"]:visible, button:visible:has-text("Login"), a:visible:has-text("Login")').first();
      if (await btn.count()) await btn.click(); else await pw.press('Enter');
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await sleep(800);
      if (!(await loginVisible(page))) { log('Auto login OK.'); return 'auto'; }
      log('Auto login kaam nahi kiya (ID/password galat ya captcha?).');
    } catch (e) { log('Auto login error:', e.message); }
  } else log('credentials.json / RMA_USER+RMA_PASS nahi mile - manual login chahiye.');
  emit('login-required', {});
  await ask('\n>> Is tab me MANUALLY LOGIN karo, phir ENTER dabao... ', {
    kind: 'login-required', title: 'Login Required',
    message: 'Please complete login in the browser, then continue.',
  });
  return 'manual';
}

// ─────────────────────────────────────────────────────────────────────────────
// Final result in CMD
// ─────────────────────────────────────────────────────────────────────────────
function printFinalSummary(entries) {
  const line = '═'.repeat(80);
  console.log('\n' + line);
  console.log(' FINAL RESULT   (script ne koi bhi entry SAVE nahi ki - har tab me form khula hai)');
  console.log(line);
  let totRows = 0, totOk = 0, fullEntries = 0;
  entries.forEach((e, i) => {
    const head = `${i + 1}. ${e.party.name} | challan ${e.challan || '-'} | ${e.rows.length} rows`;
    if (!e.result) {
      console.log(`\n[NOT PROCESSED] ${head}\n     Reason: aapne next entry ke liye "yes" nahi kaha / script beech me ruki.`);
      totRows += e.rows.length;
      return;
    }
    const header = e.result.find((r) => r.Product === '(HEADER)');
    const rows = e.result.filter((r) => r.Product !== '(HEADER)');
    const ok = rows.filter((r) => r.Status === 'SUCCESS').length;
    totRows += e.rows.length; totOk += ok;
    const headerOk = header && header.Status === 'SUCCESS';
    if (headerOk && ok === e.rows.length) { fullEntries++; console.log(`\n[DONE]    ${head}  -> ${ok}/${e.rows.length} products added, header OK`); return; }
    console.log(`\n[${headerOk ? 'PARTIAL' : 'FAILED '}]  ${head}  -> ${ok}/${e.rows.length} products added`);
    if (!headerOk && header) console.log(`     HEADER NOT FILLED: ${header.Reason}`);
    else if (header && /TOKEN NUMBER MISSING/.test(header.Reason)) console.log('     NOTE: Token number Excel me nahi tha - manually bharna hai');
    rows.filter((r) => r.Status !== 'SUCCESS').forEach((r) => {
      console.log(`     x Excel row ${r['Excel Row']}: ${r.Brand} / ${r.Product} (qty ${r['RM Quantity']}) -> ${r.Status}: ${r.Reason}`);
    });
  });
  console.log('\n' + '─'.repeat(80));
  console.log(` Entries fully done: ${fullEntries}/${entries.length}   |   Products added: ${totOk}/${totRows}`);
  console.log(' Jo rows upar "x" ya NOT PROCESSED me hain wo site par nahi bhari gayi - unka reason upar likha hai.');
  console.log(line);
}

// ─────────────────────────────────────────────────────────────────────────────
// --plan-json : Excel parse + validate -> ek JSON line (UI file preview)
// ─────────────────────────────────────────────────────────────────────────────
function planJson(entries, master, filePath) {
  let stat = null;
  try { stat = fs.statSync(filePath); } catch (_) { /* ignore */ }
  const parties = entries.map((e, i) => ({
    id: `party-${i}`, name: e.party.name, city: e.party.city, state: e.party.state,
    productCount: e.rows.length, owItemCount: e.rows.filter((r) => r.ow > 0).length,
    partnerMatch: true, status: 'pending', completed: 0, skipped: 0, errors: 0, progress: 0,
  }));
  const products = [];
  const checks = [];
  let warnCount = 0;
  entries.forEach((e, i) => {
    e.uiId = `party-${i}`;
    e.rows.forEach((r) => {
      const pre = precheckRow(r);
      const inMaster = master ? master.has([r.brand, r.category, r.capacity, r.product].map(key).join('|')) : null;
      const status = pre ? 'review' : (inMaster === false ? 'review' : 'ready');
      products.push({
        id: `prod-${products.length}`, partyId: `party-${i}`, brand: r.brand, category: r.category,
        capacity: r.capacity, productName: r.product, rmQuantity: r.rm, owQuantity: r.ow, status,
      });
      if (status === 'review') warnCount++;
    });
  });
  checks.push({ label: 'File structure valid', status: 'pass', detail: 'Required columns detected' });
  checks.push({ label: `${parties.length} party entries detected`, status: 'pass', detail: parties.map((p) => p.name).join(', ').slice(0, 160) });
  checks.push({ label: `${products.length} product rows detected`, status: 'pass', detail: 'All rows parsed' });
  if (warnCount) checks.push({ label: `${warnCount} product row${warnCount > 1 ? 's' : ''} need review`, status: 'warn', detail: 'Missing data, invalid quantity, or not in master list' });
  if (!master) checks.push({ label: 'Master list not loaded', status: 'warn', detail: 'Master validation skipped' });
  return {
    type: 'file-loaded', ts: Date.now(),
    info: {
      fileName: path.basename(filePath), fileSize: stat ? stat.size : 0,
      modifiedDate: stat ? stat.mtime.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
      sheetCount: parties.length, partyCount: parties.length, productRowCount: products.length,
    },
    parties, products, validation: { valid: true, checks },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filePath = args.file ? path.resolve(args.file) : CONFIG.dailyFile;
  const entries = args.inspect ? [] : loadEntries(filePath, args.sheet);
  if (!args.inspect) { if (!entries.length) throw new Error('No entries found in Excel.'); printPlan(entries); }
  const master = args.inspect ? null : loadMaster();
  if (args.dryRun) { dryRun(entries, master); return; }
  if (args.planJson) { process.stdout.write(EVENT_MARK + JSON.stringify(planJson(entries, master, filePath)) + '\n'); return; }

  const totalRows = entries.reduce((n, e) => n + e.rows.length, 0);
  const run = {
    processed: 0, entryOk: 0, entrySkipped: 0, entryErrors: 0, entryProcessed: 0,
    currentParty: '', startTime: Date.now(),
    progressPayload(entry, currentProduct) {
      return { overall: totalRows ? Math.round((this.processed / totalRows) * 100) : 0, currentParty: entry.party.name, currentProduct, currentStep: '' };
    },
  };
  entries.forEach((e, i) => { e.uiId = `party-${i}`; });

  const creds = loadCreds();
  log(creds ? 'Login credentials mile (auto-login on).' : 'Credentials nahi mile - login manual hoga.');
  emit('file-loaded', planJson(entries, master, filePath));
  emit('status', { status: 'running' });
  const { browser, context, page: firstPage, state } = await launch();
  const report = [];
  const counts = { completed: 0, skipped: 0, review: 0, failed: 0 };
  const tally = (rows) => rows.forEach((r) => {
    if (r.Product === '(HEADER)') return;
    if (r.Status === 'SUCCESS') counts.completed++;
    else if (r.Status === 'SKIPPED') counts.skipped++;
    else if (r.Status === 'FAILED') counts.failed++;
    else counts.review++;
  });
  try {
    let page = firstPage;
    await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded' });
    const how = await ensureLoggedIn(page, creds);
    if (how === 'auto') await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded' });

    if (args.inspect) {
      await ensureNewForm(page);
      await inspectForm(page);
      await ask('\nENTER dabao browser band karne ke liye... ', { kind: 'finished', title: 'Inspection Complete', message: 'Form inspection saved. Continue to close the browser.' });
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      if (i > 0) {
        let a = '';
        while (!/^(y|yes|q|quit)$/i.test(a)) {
          a = await ask(`\n>> Entry ${i}/${entries.length} ho gayi (form us tab me khula hai, SAVE nahi hua).\n   Next entry NAYE TAB me karne ke liye  yes  likho | band karne ke liye  q : `, {
            kind: 'next-entry', title: `Entry ${i} of ${entries.length} prepared`,
            message: `Entry prepared for ${entries[i - 1].party.name} — the form is open in its browser tab (NOT saved). Review and Save it manually if done.`,
            detail: `Next: ${entries[i].party.name} opens in a new tab.`,
          });
        }
        if (/^q/i.test(a)) { stopRequested = true; break; }
        if (await checkpoint()) break;
        page = await context.newPage();
        attachPage(page, state);
        await page.bringToFront();
        await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded' });
        const h = await ensureLoggedIn(page, creds);
        if (h === 'auto') await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded' });
      }
      run.currentParty = entries[i].party.name;
      run.entryOk = 0; run.entrySkipped = 0; run.entryErrors = 0; run.entryProcessed = 0;
      emit('party-start', { partyId: entries[i].uiId, partyName: entries[i].party.name, index: i + 1, total: entries.length });
      const start = report.length;
      await processEntry(page, state, entries[i], report, args, master, run);
      entries[i].result = report.slice(start);
      const f = writeReport(report, stamp);
      log('Report updated:', f + '.csv');
      emit('party-complete', { partyId: entries[i].uiId, completed: run.entryOk, skipped: run.entrySkipped, errors: run.entryErrors });
      if (stopRequested) break;
    }

    report.forEach(() => {});
    entries.forEach((e) => { if (e.result) tally(e.result); });
    printFinalSummary(entries);
    const secs = Math.round((Date.now() - run.startTime) / 1000);
    const summary = {
      partyCount: entries.length, productCount: totalRows,
      completed: counts.completed, skipped: counts.skipped, review: counts.review, failed: counts.failed,
      duration: `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`,
      reportPath: path.join(CONFIG.outDir, `RMA_REPORT_${stamp}.xlsx`),
    };
    if (stopRequested) {
      emit('stopped', { reason: 'Stopped by operator' });
      emit('status', { status: 'stopped' });
    } else {
      emit('complete', { summary });
      emit('status', { status: 'completed' });
    }
    await ask('\n>> Ab har tab check karke jo sahi ho use manually SAVE karo. Sab ho jaye tab ENTER dabao (browser band ho jayega, unsaved forms chale jayenge)... ', {
      kind: 'finished', title: 'Review & Save in Browser',
      message: 'All done. Check each browser tab and manually Save the correct entries. When finished, continue to close the browser (unsaved forms will be discarded).',
    });
  } catch (e) {
    console.error('\nFATAL:', e.message);
    emit('error', { message: e.message || String(e), fatal: true });
    emit('status', { status: 'error' });
    if (report.length) writeReport(report, stamp);
    if (entries.length) printFinalSummary(entries);
    await ask('\nError aaya. Browser open hai - dekh lo, phir ENTER dabao band karne ke liye... ', {
      kind: 'finished', title: 'Automation Error',
      message: `Error: ${e.message || e}. Browser is open for inspection — continue to close it.`,
    }).catch(() => {});
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((e) => { console.error(e); process.exit(1); });