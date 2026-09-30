import { type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, icon, children, maxWidth = 'max-w-md' }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-navy-950/30 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      <div className={`relative card p-6 w-full ${maxWidth} animate-slide-in-up max-h-[90vh] overflow-y-auto shadow-premium`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon}
            <h2 className="text-base font-bold text-navy-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 flex items-center justify-center transition-all duration-300 active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
