// ============================================================
// Core domain types for CYBERX RMA Automation
// Single-workspace architecture — the UI and automation engine
// communicate through typed events and interactive prompts.
// ============================================================

export type AutomationStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'error';

export type PartyStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'skipped'
  | 'error';

export type ProductStatus =
  | 'matched'
  | 'review'
  | 'not-found'
  | 'ready'
  | 'skipped'
  | 'error'
  | 'added';

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'action';

export type AutomationStepName =
  | 'selecting-brand'
  | 'selecting-category'
  | 'selecting-capacity'
  | 'selecting-product'
  | 'entering-quantity'
  | 'adding-product';

// ============================================================
// Excel / data structures
// ============================================================

export interface ExcelFileInfo {
  fileName: string;
  fileSize: number;
  modifiedDate: string;
  sheetCount: number;
  partyCount: number;
  productRowCount: number;
}

export interface ValidationCheck {
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface ValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
}

export interface PartySummary {
  id: string;
  name: string;
  city: string;
  state: string;
  productCount: number;
  owItemCount: number;
  partnerMatch: boolean;
  status: PartyStatus;
  completed: number;
  skipped: number;
  errors: number;
  progress: number;
}

export interface ProductSummary {
  id: string;
  partyId: string;
  brand: string;
  category: string;
  capacity: string;
  productName: string;
  rmQuantity: number;
  owQuantity: number;
  status: ProductStatus;
}

// ============================================================
// Automation run-time structures
// ============================================================

export interface AutomationStep {
  name: AutomationStepName;
  label: string;
  status: 'pending' | 'active' | 'done' | 'skipped';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: LogLevel;
}

export interface RunSummary {
  partyCount: number;
  productCount: number;
  completed: number;
  skipped: number;
  review: number;
  failed: number;
  duration: string;
  reportPath?: string;
}

// ============================================================
// Interactive prompts — when automation needs user input
// ============================================================

export interface PartnerCandidate {
  name: string;
  city: string;
  state: string;
  pin: string;
}

export type InteractivePrompt =
  | {
      id: string;
      type: 'login';
      title: string;
      message: string;
    }
  | {
      id: string;
      type: 'partner-match';
      title: string;
      message: string;
      partyName: string;
      candidates: PartnerCandidate[];
    }
  | {
      id: string;
      type: 'confirm';
      title: string;
      message: string;
      detail?: string;
      /** engine-side prompt classification */
      kind?: 'next-entry' | 'login-required' | 'finished' | 'generic';
      confirmLabel?: string;
      cancelLabel?: string;
    };

export interface PromptResponse {
  promptId: string;
  data:
    | { type: 'login'; username: string; password: string }
    | { type: 'partner-match'; selectedCandidate: PartnerCandidate }
    | { type: 'confirm'; confirmed: boolean }
    | { type: 'cancelled' };
}

// ============================================================
// App settings
// ============================================================

export interface AppSettings {
  rmaUrl: string;
  chromePath: string;
  dataFolder: string;
  masterExcelFile: string;
  reportsFolder: string;
  username: string;
  password: string;
  autoSave: boolean;
  confirmBeforeStart: boolean;
  masterFileUploaded: boolean;
  masterFileName: string;
  companyDocsUploaded: boolean;
  companyDocsName: string;
}

export type ConfigItemStatus = 'pending' | 'configured';

export interface ConfigItem {
  key: string;
  label: string;
  configured: boolean;
}

export interface ConfigState {
  settings: AppSettings;
  locked: boolean;
  items: ConfigItem[];
}

export type ConfigStatus = 'not-configured' | 'partial' | 'ready';

// ============================================================
// Automation events — emitted by the service, consumed by UI
// ============================================================

export type AutomationEvent =
  | { type: 'status'; status: AutomationStatus }
  | { type: 'log'; entry: LogEntry }
  | { type: 'progress'; overall: number; currentParty: string; currentProduct: string; currentStep: string }
  | { type: 'party-start'; partyId: string; partyName: string }
  | { type: 'party-update'; partyId: string; completed: number; skipped: number; errors: number; progress: number; status: PartyStatus }
  | { type: 'party-complete'; partyId: string; completed: number; skipped: number; errors: number }
  | { type: 'product-start'; partyId: string; productName: string }
  | { type: 'product-success'; partyId: string; productName: string }
  | { type: 'product-skipped'; partyId: string; productName: string; reason: string }
  | { type: 'product-error'; partyId: string; productName: string; reason: string }
  | { type: 'step-update'; step: AutomationStepName; label: string }
  | { type: 'complete'; summary: RunSummary }
  | { type: 'stopped'; reason: string }
  | { type: 'error'; message: string }
  | { type: 'warning'; message: string }
  | { type: 'prompt'; prompt: InteractivePrompt }
  | { type: 'prompt-resolved' }
  | { type: 'file-loaded'; info: ExcelFileInfo; parties: PartySummary[]; products: ProductSummary[]; validation: ValidationResult };

export type AutomationEventListener = (event: AutomationEvent) => void;
