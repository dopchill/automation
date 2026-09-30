import { Play, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';

interface StartConfirmModalProps {
  open: boolean;
  partyCount: number;
  productCount: number;
  reviewCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function StartConfirmModal({
  open,
  partyCount,
  productCount,
  reviewCount,
  onCancel,
  onConfirm,
}: StartConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Start RMA Automation?"
      icon={
        <div className="w-9 h-9 rounded-xl bg-gradient-pink-blue flex items-center justify-center shadow-glow-pink">
          <Play className="w-4 h-4 text-white" />
        </div>
      }
    >
      <p className="text-sm text-navy-500 mb-4">
        Ready to process the following data? The automation will open Chrome and handle each party automatically.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-pink-50 rounded-xl px-3 py-3 text-center">
          <p className="text-2xl font-bold text-pink-600 tabular-nums">{partyCount}</p>
          <p className="text-[10px] text-pink-400 font-medium mt-0.5">Parties</p>
        </div>
        <div className="bg-blue-50 rounded-xl px-3 py-3 text-center">
          <p className="text-2xl font-bold text-blue-600 tabular-nums">{productCount}</p>
          <p className="text-[10px] text-blue-400 font-medium mt-0.5">Products</p>
        </div>
        <div className="bg-warning-50 rounded-xl px-3 py-3 text-center">
          <p className="text-2xl font-bold text-warning-600 tabular-nums">{reviewCount}</p>
          <p className="text-[10px] text-warning-400 font-medium mt-0.5">Review Items</p>
        </div>
      </div>

      {reviewCount > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-warning-50 border border-warning-100 mb-4">
          <AlertCircle className="w-4 h-4 text-warning-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-navy-600 leading-relaxed">
            {reviewCount} product{reviewCount > 1 ? 's' : ''} will likely be skipped during automation. You can review them afterward.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button onClick={onConfirm} className="btn-primary flex-1">
          <Play className="w-4 h-4" />
          Start Automation
        </button>
      </div>
    </Modal>
  );
}
