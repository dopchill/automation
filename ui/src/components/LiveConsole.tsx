import { useEffect, useRef } from 'react';
import { Trash2, Copy, Download, Activity } from 'lucide-react';
import type { LogEntry, LogLevel } from '@/types';

interface LiveConsoleProps {
  entries: LogEntry[];
  onClear: () => void;
}

const levelConfig: Record<LogLevel, { icon: string; color: string; bg: string }> = {
  success: { icon: '✓', color: 'text-success-600', bg: 'bg-success-50' },
  error: { icon: '✕', color: 'text-danger-600', bg: 'bg-danger-50' },
  warning: { icon: '⚠', color: 'text-warning-600', bg: 'bg-warning-50' },
  action: { icon: '→', color: 'text-pink-600', bg: 'bg-pink-50' },
  info: { icon: '●', color: 'text-blue-500', bg: 'bg-blue-50' },
};

export function LiveConsole({ entries, onClear }: LiveConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const handleCopy = () => {
    const text = entries.map((e) => `${e.timestamp} ${e.message}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  const handleExport = () => {
    const text = entries.map((e) => `[${e.timestamp}] ${e.level.toUpperCase()} — ${e.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyberx-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-navy-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-pink-500" />
          <h3 className="text-sm font-bold text-navy-900">Live Activity</h3>
          {entries.length > 0 && (
            <span className="text-[10px] text-navy-400 font-medium px-1.5 py-0.5 rounded bg-navy-50">
              {entries.length}
            </span>
          )}
        </div>
        {entries.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="w-7 h-7 rounded-lg text-navy-400 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center transition-all duration-300"
              title="Copy log"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleExport}
              className="w-7 h-7 rounded-lg text-navy-400 hover:text-pink-500 hover:bg-pink-50 flex items-center justify-center transition-all duration-300"
              title="Export log"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClear}
              className="w-7 h-7 rounded-lg text-navy-400 hover:text-danger-500 hover:bg-danger-50 flex items-center justify-center transition-all duration-300"
              title="Clear log"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Console body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 bg-navy-50/30 font-mono">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-10 h-10 rounded-xl bg-navy-100 flex items-center justify-center mb-2">
              <Activity className="w-5 h-5 text-navy-300" />
            </div>
            <p className="text-xs text-navy-400 font-medium">No activity yet</p>
            <p className="text-[11px] text-navy-300 mt-0.5">Messages will appear here when automation runs</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {entries.map((entry) => {
              const cfg = levelConfig[entry.level];
              return (
                <div
                  key={entry.id}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-lg ${cfg.bg} animate-fade-in`}
                >
                  <span className={`text-xs font-bold ${cfg.color} flex-shrink-0 w-4 text-center`}>
                    {cfg.icon}
                  </span>
                  <span className="text-[11px] text-navy-400 tabular-nums flex-shrink-0">
                    {entry.timestamp}
                  </span>
                  <span className="text-xs text-navy-700 leading-snug">{entry.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
