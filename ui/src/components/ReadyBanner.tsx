import { CheckCircle2, Lock, Database, Cpu, ShieldCheck, Settings } from 'lucide-react';
import { useConfig } from './ConfigContext';

interface ReadyBannerProps {
  onOpenSettings: () => void;
}

interface ReadyItem {
  icon: typeof CheckCircle2;
  label: string;
  done: boolean;
}

export function ReadyBanner({ onOpenSettings }: ReadyBannerProps) {
  const { locked, configuredCount, totalCount, items } = useConfig();

  const allConfigured = configuredCount === totalCount;
  const masterLoaded = items.find((i) => i.key === 'masterExcel')?.configured ?? false;

  const readyItems: ReadyItem[] = [
    { icon: Cpu, label: 'System Ready', done: true },
    { icon: Database, label: 'Master Data Loaded', done: masterLoaded },
    { icon: Lock, label: 'Configuration Locked', done: locked },
    { icon: ShieldCheck, label: 'Automation Ready', done: locked && allConfigured },
  ];

  // Not configured at all — show setup prompt
  if (configuredCount === 0) {
    return (
      <div className="px-6 pt-4">
        <div className="card p-4 flex items-center justify-between gap-4 animate-fade-in-down border-warning-200 bg-gradient-to-r from-warning-50/80 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning-100 flex items-center justify-center flex-shrink-0">
              <Settings className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-navy-900">Initial Setup Required</p>
              <p className="text-xs text-navy-500 mt-0.5">
                Configure your settings and upload master files to get started.
              </p>
            </div>
          </div>
          <button onClick={onOpenSettings} className="btn-primary text-sm">
            <Settings className="w-4 h-4" />
            Open Configuration
          </button>
        </div>
      </div>
    );
  }

  // Locked and ready — show full ready state
  if (locked && allConfigured) {
    return (
      <div className="px-6 pt-4">
        <div className="card p-3.5 flex items-center gap-4 animate-fade-in-down border-success-200 bg-gradient-to-r from-success-50/60 via-white to-white">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-success-500 flex items-center justify-center shadow-glow-success">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-bold text-success-700 hidden sm:inline">SYSTEM READY</span>
          </div>
          <div className="h-6 w-px bg-navy-100 hidden sm:block" />
          <div className="flex items-center gap-3 flex-wrap flex-1">
            {readyItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 animate-fade-in"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    item.done ? 'bg-success-100' : 'bg-navy-100'
                  }`}>
                    <Icon className={`w-3 h-3 ${item.done ? 'text-success-500' : 'text-navy-300'}`} />
                  </div>
                  <span className={`text-[11px] font-semibold ${item.done ? 'text-navy-700' : 'text-navy-400'}`}>
                    {item.label}
                  </span>
                  {item.done && (
                    <CheckCircle2 className="w-3 h-3 text-success-400 animate-check-pop" />
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={onOpenSettings}
            className="text-navy-400 hover:text-pink-500 transition-colors flex-shrink-0"
            title="View configuration"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Partial configuration — show progress
  return (
    <div className="px-6 pt-4">
      <div className="card p-4 flex items-center justify-between gap-4 animate-fade-in-down border-pink-200 bg-gradient-to-r from-pink-50/60 via-white to-white">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0">
            <Settings className="w-5 h-5 text-pink-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-bold text-navy-900">Configuration In Progress</p>
              <span className="text-xs text-navy-400 font-medium tabular-nums">{configuredCount}/{totalCount}</span>
            </div>
            <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden max-w-xs">
              <div
                className="h-full bg-gradient-pink-blue rounded-full transition-all duration-500"
                style={{ width: `${(configuredCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <button onClick={onOpenSettings} className="btn-secondary text-sm whitespace-nowrap">
          <Settings className="w-4 h-4" />
          Continue Setup
        </button>
      </div>
    </div>
  );
}
