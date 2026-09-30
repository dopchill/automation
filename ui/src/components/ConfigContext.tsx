import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { automationService } from '@/services/automation-service';
import type { AppSettings, ConfigItem, ConfigStatus } from '@/types';

const defaultSettings: AppSettings = {
  rmaUrl: '',
  chromePath: '',
  dataFolder: './data',
  masterExcelFile: 'MASTER_PRODUCT_LIST.xlsx',
  reportsFolder: './reports',
  username: '',
  password: '',
  autoSave: false,
  confirmBeforeStart: true,
  masterFileUploaded: false,
  masterFileName: '',
  companyDocsUploaded: false,
  companyDocsName: '',
};

function buildItems(settings: AppSettings): ConfigItem[] {
  return [
    { key: 'rmaUrl', label: 'RMA Website URL', configured: !!settings.rmaUrl },
    { key: 'chromePath', label: 'Chrome Path', configured: !!settings.chromePath },
    { key: 'dataFolder', label: 'Data Folder', configured: !!settings.dataFolder },
    { key: 'masterExcel', label: 'Master Product Excel', configured: !!settings.masterExcelFile && settings.masterFileUploaded },
    { key: 'reportsFolder', label: 'Reports Folder', configured: !!settings.reportsFolder },
    { key: 'login', label: 'Login Credentials', configured: !!settings.username && !!settings.password },
    { key: 'companyDocs', label: 'Company Documents', configured: settings.companyDocsUploaded },
  ];
}

interface ConfigContextValue {
  settings: AppSettings;
  locked: boolean;
  items: ConfigItem[];
  status: ConfigStatus;
  configuredCount: number;
  totalCount: number;
  loaded: boolean;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  save: () => Promise<void>;
  lock: () => void;
  unlock: () => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [locked, setLocked] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load persisted settings from the control server (shared with the engine)
  useEffect(() => {
    automationService.getSettings()
      .then((s) => {
        setSettings({ ...defaultSettings, ...s });
        // previously saved+locked config loads in the locked state
        if (s.rmaUrl && s.chromePath && s.username) setLocked(true);
      })
      .catch(() => { /* server offline — UI still renders with defaults */ })
      .finally(() => setLoaded(true));
  }, []);

  const items = useMemo(() => buildItems(settings), [settings]);
  const configuredCount = items.filter((i) => i.configured).length;
  const totalCount = items.length;

  const status: ConfigStatus = useMemo(() => {
    if (locked && configuredCount === totalCount) return 'ready';
    if (configuredCount === 0) return 'not-configured';
    return 'partial';
  }, [locked, configuredCount, totalCount]);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    const saved = await automationService.saveSettings(settings);
    setSettings(saved);
  }, [settings]);

  const lock = useCallback(() => setLocked(true), []);
  const unlock = useCallback(() => setLocked(false), []);

  const value: ConfigContextValue = {
    settings,
    locked,
    items,
    status,
    configuredCount,
    totalCount,
    loaded,
    update,
    save,
    lock,
    unlock,
  };

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}
