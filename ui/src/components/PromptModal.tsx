import { useState } from 'react';
import { LogIn, Users, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import type { InteractivePrompt, PromptResponse, PartnerCandidate } from '@/types';

interface PromptModalProps {
  prompt: InteractivePrompt | null;
  onRespond: (response: PromptResponse) => void;
}

export function PromptModal({ prompt, onRespond }: PromptModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);

  if (!prompt) return null;

  const handleClose = () => {
    onRespond({ promptId: prompt.id, data: { type: 'cancelled' } });
    reset();
  };

  const reset = () => {
    setUsername('');
    setPassword('');
    setSelectedCandidate(null);
  };

  // Login prompt
  if (prompt.type === 'login') {
    return (
      <Modal
        open
        onClose={handleClose}
        title={prompt.title}
        icon={
          <div className="w-9 h-9 rounded-xl bg-gradient-blue flex items-center justify-center shadow-glow-blue">
            <LogIn className="w-4 h-4 text-white" />
          </div>
        }
      >
        <p className="text-sm text-navy-500 mb-4">{prompt.message}</p>
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-navy-500 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter RMA username"
              className="input-field"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-navy-500 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter RMA password"
              className="input-field"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && username && password) {
                  onRespond({ promptId: prompt.id, data: { type: 'login', username, password } });
                  reset();
                }
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => {
              if (username && password) {
                onRespond({ promptId: prompt.id, data: { type: 'login', username, password } });
                reset();
              }
            }}
            disabled={!username || !password}
            className="btn-blue flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Login & Continue
          </button>
        </div>
      </Modal>
    );
  }

  // Partner match prompt
  if (prompt.type === 'partner-match') {
    return (
      <Modal
        open
        onClose={handleClose}
        title={prompt.title}
        icon={
          <div className="w-9 h-9 rounded-xl bg-gradient-pink flex items-center justify-center shadow-glow-pink">
            <Users className="w-4 h-4 text-white" />
          </div>
        }
      >
        <p className="text-sm text-navy-500 mb-2">{prompt.message}</p>
        <div className="px-3 py-2 rounded-lg bg-pink-50 border border-pink-100 mb-4">
          <p className="text-xs text-pink-400 font-semibold">Party</p>
          <p className="text-sm font-bold text-navy-900">{prompt.partyName}</p>
        </div>
        <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-2">
          Possible Matches
        </p>
        <div className="space-y-2 mb-5">
          {prompt.candidates.map((c: PartnerCandidate, i: number) => (
            <button
              key={i}
              onClick={() => setSelectedCandidate(i)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-300 ${
                selectedCandidate === i
                  ? 'border-pink-400 bg-pink-50 shadow-glow-pink'
                  : 'border-navy-100 bg-white hover:border-pink-200 hover:bg-pink-50/30'
              }`}
            >
              <p className="text-sm font-semibold text-navy-900">{c.name}</p>
              <p className="text-xs text-navy-400 mt-0.5">
                {c.city}, {c.state} — {c.pin}
              </p>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedCandidate !== null) {
                onRespond({
                  promptId: prompt.id,
                  data: { type: 'partner-match', selectedCandidate: prompt.candidates[selectedCandidate] },
                });
                reset();
              }
            }}
            disabled={selectedCandidate === null}
            className="btn-pink flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Select
          </button>
        </div>
      </Modal>
    );
  }

  // Confirm prompt
  if (prompt.type === 'confirm') {
    return (
      <Modal
        open
        onClose={handleClose}
        title={prompt.title}
        icon={
          <div className="w-9 h-9 rounded-xl bg-warning-100 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-warning-500" />
          </div>
        }
      >
        <p className="text-sm text-navy-500 mb-2">{prompt.message}</p>
        {prompt.detail && (
          <p className="text-sm text-navy-600 font-medium mb-5 px-3 py-2 rounded-lg bg-navy-50">
            {prompt.detail}
          </p>
        )}
        <div className="flex items-center gap-3 mt-5">
          <button onClick={handleClose} className="btn-secondary flex-1">
            {prompt.cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={() => {
              onRespond({ promptId: prompt.id, data: { type: 'confirm', confirmed: true } });
              reset();
            }}
            className={prompt.kind === 'finished' ? 'btn-danger flex-1' : 'btn-pink flex-1'}
          >
            {prompt.confirmLabel || 'Confirm'}
          </button>
        </div>
      </Modal>
    );
  }

  return null;
}
