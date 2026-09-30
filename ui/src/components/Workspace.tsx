import { useState, useEffect, useCallback } from 'react';
import { automationService } from '@/services/automation-service';
import { useConfig } from '@/components/ConfigContext';
import { useToast } from '@/components/ToastProvider';
import { ExcelUpload } from '@/components/ExcelUpload';
import { AutomationPanel } from '@/components/AutomationPanel';
import { LiveConsole } from '@/components/LiveConsole';
import { PromptModal } from '@/components/PromptModal';
import { SettingsModal } from '@/components/SettingsModal';
import { StartConfirmModal } from '@/components/StartConfirmModal';
import { StopConfirmModal } from '@/components/StopConfirmModal';
import type {
  AutomationStatus,
  LogEntry,
  PartySummary,
  ProductSummary,
  ExcelFileInfo,
  ValidationResult,
  InteractivePrompt,
  PromptResponse,
  RunSummary,
} from '@/types';

export function Workspace() {
  const { notify } = useToast();
  const { settings } = useConfig();

  const [status, setStatus] = useState<AutomationStatus>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentParty, setCurrentParty] = useState('');
  const [currentProduct, setCurrentProduct] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [fileInfo, setFileInfo] = useState<ExcelFileInfo | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [prompt, setPrompt] = useState<InteractivePrompt | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // Subscribe to automation events
  useEffect(() => {
    const unsubscribe = automationService.on((event) => {
      switch (event.type) {
        case 'status':
          setStatus(event.status);
          if (event.status === 'completed') {
            notify('Automation completed successfully', 'success');
          } else if (event.status === 'error') {
            notify('Automation encountered an error', 'error');
          } else if (event.status === 'stopped') {
            notify('Automation stopped', 'warning');
          }
          break;
        case 'log':
          setLogs((prev) => [...prev, event.entry]);
          break;
        case 'progress':
          setProgress(event.overall);
          setCurrentParty(event.currentParty);
          setCurrentProduct(event.currentProduct);
          setCurrentStep(event.currentStep);
          break;
        case 'party-start':
          setParties((prev) =>
            prev.map((p) => (p.id === event.partyId ? { ...p, status: 'processing' } : p)),
          );
          break;
        case 'party-update':
          setParties((prev) =>
            prev.map((p) =>
              p.id === event.partyId
                ? { ...p, completed: event.completed, skipped: event.skipped, errors: event.errors, progress: event.progress, status: event.status }
                : p,
            ),
          );
          break;
        case 'party-complete':
          setParties((prev) =>
            prev.map((p) =>
              p.id === event.partyId
                ? { ...p, status: 'completed', completed: event.completed, skipped: event.skipped, errors: event.errors, progress: 100 }
                : p,
            ),
          );
          break;
        case 'file-loaded':
          setFileInfo(event.info);
          setParties(event.parties);
          setProducts(event.products);
          setValidation(event.validation);
          notify(`Excel loaded: ${event.info.partyCount} parties, ${event.info.productRowCount} products`, 'success');
          break;
        case 'complete':
          setRunSummary(event.summary);
          setProgress(100);
          break;
        case 'prompt':
          setPrompt(event.prompt);
          break;
        case 'prompt-resolved':
          setPrompt(null);
          break;
        case 'warning':
          notify(event.message, 'warning');
          break;
        case 'stopped':
          notify('Automation stopped by operator', 'warning');
          break;
        case 'error':
          notify(event.message, 'error');
          break;
      }
    });
    return unsubscribe;
  }, [notify]);

  const handleFileSelected = useCallback(
    (file: File) => {
      setRunSummary(null);
      setLogs([]);
      setProgress(0);
      automationService.loadFile(file).catch((e) => notify(`Could not read Excel: ${e.message}`, 'error'));
    },
    [notify],
  );

  const handleExistingSelected = useCallback(
    (path: string) => {
      setRunSummary(null);
      setLogs([]);
      setProgress(0);
      automationService.selectExisting(path).catch((e) => notify(`Could not read Excel: ${e.message}`, 'error'));
    },
    [notify],
  );

  const handleClearFile = useCallback(() => {
    automationService.clearFile();
    setFileInfo(null);
    setParties([]);
    setProducts([]);
    setValidation(null);
    setLogs([]);
    setProgress(0);
    setRunSummary(null);
    notify('File removed', 'info');
  }, [notify]);

  const handleStartClick = useCallback(() => {
    if (parties.length === 0) return;
    if (settings.confirmBeforeStart) setShowStartConfirm(true);
    else handleStartConfirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parties.length, settings.confirmBeforeStart]);

  const handleStartConfirm = useCallback(() => {
    setShowStartConfirm(false);
    setRunSummary(null);
    setLogs([]);
    setParties((prev) => prev.map((p) => ({ ...p, status: 'pending' as const, completed: 0, skipped: 0, errors: 0, progress: 0 })));
    automationService.start().catch((e) => notify(`Could not start: ${e.message}`, 'error'));
  }, [notify]);

  const handlePause = useCallback(() => {
    automationService.pause();
  }, []);

  const handleResume = useCallback(() => {
    automationService.resume();
  }, []);

  const handleStopClick = useCallback(() => {
    setShowStopConfirm(true);
  }, []);

  const handleStopConfirm = useCallback(() => {
    setShowStopConfirm(false);
    automationService.stop();
  }, []);

  const handlePromptRespond = useCallback(
    (response: PromptResponse) => {
      setPrompt(null);
      automationService.respondToPrompt(response);
    },
    [],
  );

  const handleClearLog = useCallback(() => {
    setLogs([]);
  }, []);

  const reviewCount = products.filter((p) => p.status === 'review').length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        {/* Top row: Upload + Automation Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: Upload / File info */}
          <div>
            <ExcelUpload
              fileInfo={fileInfo}
              validation={validation}
              parties={parties}
              products={products}
              onFileSelected={handleFileSelected}
              onExistingSelected={handleExistingSelected}
              onClearFile={handleClearFile}
            />
          </div>

          {/* Right: Automation panel */}
          <div>
            <AutomationPanel
              status={status}
              progress={progress}
              currentParty={currentParty}
              currentProduct={currentProduct}
              currentStep={currentStep}
              parties={parties}
              runSummary={runSummary}
              hasFile={!!fileInfo}
              onStart={handleStartClick}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStopClick}
              onOpenBrowser={() => {
                automationService.openBrowser().catch(() => notify('Could not open browser', 'error'));
              }}
              onViewReport={() => {
                window.open(automationService.reportDownloadUrl(), '_blank');
              }}
            />
          </div>
        </div>

        {/* Bottom: Live Console — full width */}
        <div className="h-[280px]">
          <LiveConsole entries={logs} onClear={handleClearLog} />
        </div>
      </div>

      {/* Modals */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <StartConfirmModal
        open={showStartConfirm}
        partyCount={parties.length}
        productCount={products.length}
        reviewCount={reviewCount}
        onCancel={() => setShowStartConfirm(false)}
        onConfirm={handleStartConfirm}
      />
      <StopConfirmModal
        open={showStopConfirm}
        onCancel={() => setShowStopConfirm(false)}
        onConfirm={handleStopConfirm}
      />
      <PromptModal prompt={prompt} onRespond={handlePromptRespond} />
    </div>
  );
}
