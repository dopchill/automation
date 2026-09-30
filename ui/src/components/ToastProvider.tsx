import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'warning' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  notify: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const toastConfig: Record<ToastType, { icon: typeof CheckCircle2; bg: string; border: string; text: string }> = {
  success: { icon: CheckCircle2, bg: 'bg-success-500', border: 'border-success-600', text: 'text-white' },
  warning: { icon: AlertTriangle, bg: 'bg-warning-500', border: 'border-warning-600', text: 'text-white' },
  error: { icon: XCircle, bg: 'bg-danger-500', border: 'border-danger-600', text: 'text-white' },
  info: { icon: Info, bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-80 pointer-events-none">
        {toasts.map((toast) => {
          const cfg = toastConfig[toast.type];
          const Icon = cfg.icon;
          return (
            <div
              key={toast.id}
              className={`${cfg.bg} ${cfg.border} ${cfg.text} border rounded-xl px-4 py-3.5 flex items-start gap-3 animate-slide-in-right pointer-events-auto shadow-lg`}
            >
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                className="opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
