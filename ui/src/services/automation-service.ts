import type {
  AutomationEvent,
  AutomationEventListener,
  AutomationStatus,
  LogEntry,
  LogLevel,
  ExcelFileInfo,
  PartySummary,
  ProductSummary,
  ValidationResult,
  PromptResponse,
  AppSettings,
} from '@/types';

type Listener = (event: AutomationEvent) => void;

// ============================================================
// AutomationService — bridge between the UI and the real
// automation engine via the local control server (server/index.js).
//
// Events arrive over SSE at /api/events and are re-dispatched to
// subscribers with the same AutomationEvent contract the UI uses.
// Control calls (start/pause/stop/respond) go to REST endpoints.
// ============================================================

const API = '/api';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data as T;
}

async function apiUpload<T>(path: string, file: File): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload failed: ${res.status}`);
  return data as T;
}

export interface FileListItem { name: string; path: string; size: number; modified: string }
export interface FileLoadedPayload {
  info: ExcelFileInfo;
  parties: PartySummary[];
  products: ProductSummary[];
  validation: ValidationResult;
}

class AutomationService {
  private listeners = new Set<Listener>();
  private _status: AutomationStatus = 'idle';
  private _fileInfo: ExcelFileInfo | null = null;
  private _parties: PartySummary[] = [];
  private _products: ProductSummary[] = [];
  private _validation: ValidationResult | null = null;
  private _filePath: string | null = null;
  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  get status(): AutomationStatus { return this._status; }
  get fileInfo(): ExcelFileInfo | null { return this._fileInfo; }
  get parties(): PartySummary[] { return this._parties; }
  get products(): ProductSummary[] { return this._products; }
  get validation(): ValidationResult | null { return this._validation; }
  get filePath(): string | null { return this._filePath; }

  on(listener: AutomationEventListener): () => void {
    this.listeners.add(listener);
    this.connect();
    return () => this.listeners.delete(listener);
  }

  off(listener: AutomationEventListener): void {
    this.listeners.delete(listener);
  }

  private emit(event: AutomationEvent): void {
    this.listeners.forEach((l) => l(event));
  }

  private setStatus(status: AutomationStatus): void {
    this._status = status;
    this.emit({ type: 'status', status });
  }

  // ============================================================
  // SSE connection — real engine events
  // ============================================================

  private connect(): void {
    if (this.started) return;
    this.started = true;
    this.openStream();
    // pick up state if a run is already in progress when the UI opens
    apiGet<{ status: AutomationStatus; file?: { info: ExcelFileInfo; parties: PartySummary[]; products: ProductSummary[]; validation: ValidationResult } | null }>('/state')
      .then((s) => {
        this.setStatus(s.status);
        if (s.file) this.applyFilePayload(s.file, null);
      })
      .catch(() => { this.log('Control server not reachable — start it with: npm start', 'error'); });
  }

  private openStream(): void {
    try { this.eventSource?.close(); } catch { /* ignore */ }
    const es = new EventSource(`${API}/events`);
    this.eventSource = es;
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as AutomationEvent;
        if (event.type === 'status') this._status = event.status;
        if (event.type === 'prompt') this.lastPrompt = event.prompt;
        if (event.type === 'prompt-resolved') this.lastPrompt = null;
        this.emit(event);
      } catch { /* ignore malformed */ }
    };
    es.onerror = () => {
      es.close();
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.openStream(); }, 3000);
      }
    };
  }

  private log(message: string, level: LogLevel = 'info'): void {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      message,
      level,
    };
    this.emit({ type: 'log', entry });
  }

  // ============================================================
  // File loading — upload to server, engine parses the real Excel
  // ============================================================

  private applyFilePayload(payload: FileLoadedPayload, filePath: string | null): void {
    this._fileInfo = payload.info;
    this._parties = payload.parties;
    this._products = payload.products;
    this._validation = payload.validation;
    this._filePath = filePath ?? this._filePath;
    this.emit({
      type: 'file-loaded',
      info: payload.info,
      parties: payload.parties,
      products: payload.products,
      validation: payload.validation,
    });
  }

  /** Upload a user-picked Excel to the server data folder, then inspect it. */
  async loadFile(file: File): Promise<void> {
    this.log(`Uploading Excel file: ${file.name}...`, 'info');
    const res = await apiUpload<{ path: string; payload: FileLoadedPayload }>('/upload', file);
    this.applyFilePayload(res.payload, res.path);
    this.log(`Excel loaded: ${res.payload.info.fileName} — ${res.payload.info.partyCount} parties, ${res.payload.info.productRowCount} products`, 'success');
  }

  /** Inspect an Excel file that already exists inside the data folder. */
  async selectExisting(filePath: string): Promise<void> {
    this.log('Reading Excel from data folder...', 'info');
    const res = await apiPost<{ path: string; payload: FileLoadedPayload }>('/files/select', { path: filePath });
    this.applyFilePayload(res.payload, res.path);
    this.log(`Excel loaded: ${res.payload.info.fileName} — ${res.payload.info.partyCount} parties, ${res.payload.info.productRowCount} products`, 'success');
  }

  async listFiles(): Promise<FileListItem[]> {
    const res = await apiGet<{ files: FileListItem[] }>('/files');
    return res.files;
  }

  clearFile(): void {
    this._fileInfo = null;
    this._parties = [];
    this._products = [];
    this._validation = null;
    this._filePath = null;
  }

  // ============================================================
  // Control API — drives the real engine
  // ============================================================

  async start(): Promise<void> {
    if (this._status === 'running' || !this._filePath) return;
    await apiPost('/automation/start', { filePath: this._filePath });
    // status arrives over SSE
  }

  async pause(): Promise<void> {
    await apiPost('/automation/pause');
  }

  async resume(): Promise<void> {
    await apiPost('/automation/resume');
  }

  async stop(): Promise<void> {
    await apiPost('/automation/stop');
  }

  respondToPrompt(response: PromptResponse): void {
    const prompt = this.lastPrompt;
    const kind = prompt?.type === 'confirm' ? prompt.kind : undefined;
    const confirmed = response.data.type === 'confirm' ? response.data.confirmed : response.data.type !== 'cancelled';
    apiPost('/automation/respond', { kind, confirmed })
      .catch((e) => this.log(`Could not send response: ${e.message}`, 'error'));
    this.lastPrompt = null;
  }

  // Current engine prompt — tracked from SSE 'prompt' / 'prompt-resolved' events
  private lastPrompt: import('@/types').InteractivePrompt | null = null;

  // ============================================================
  // Reports / browser helpers
  // ============================================================

  async openBrowser(): Promise<void> {
    await apiPost('/open-browser');
  }

  reportDownloadUrl(file?: string): string {
    return file ? `${API}/reports/download?file=${encodeURIComponent(file)}` : `${API}/reports/download`;
  }

  // ============================================================
  // Settings — persisted server-side, consumed by the engine env
  // ============================================================

  async getSettings(): Promise<AppSettings> {
    const res = await apiGet<{ settings: AppSettings }>('/settings');
    return res.settings;
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    const r = await fetch(`${API}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Save failed');
    return data.settings as AppSettings;
  }

  async uploadMaster(file: File): Promise<void> {
    await apiUpload('/upload-master', file);
  }

  async uploadDocs(file: File): Promise<void> {
    await apiUpload('/upload-docs', file);
  }

  emitEvent(event: AutomationEvent): void { this.emit(event); }
  emitLog(message: string, level: LogLevel = 'info'): void { this.log(message, level); }
}

export const automationService = new AutomationService();
