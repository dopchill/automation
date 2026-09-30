import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface StopConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function StopConfirmModal({ open, onCancel, onConfirm }: StopConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Stop Automation?"
      icon={
        <div className="w-9 h-9 rounded-xl bg-danger-100 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-danger-500" />
        </div>
      }
    >
      <p className="text-sm text-navy-500 mb-3">
        Are you sure you want to stop the automation?
      </p>
      <div className="px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-100 mb-5">
        <p className="text-xs text-navy-600 leading-relaxed">
          Current browser tabs will remain open for manual review. Any products not yet processed will be skipped.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button onClick={onConfirm} className="btn-danger flex-1">
          Stop Automation
        </button>
      </div>
    </Modal>
  );
}
