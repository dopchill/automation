import { useState, useRef } from 'react';
import {
  Settings as SettingsIcon, Shield, Cpu, Lock,
  UploadCloud, CheckCircle2, AlertCircle, Lock as LockIcon, Unlock,
  Globe, HardDrive, FolderOpen, FileCheck2, User, Eye, EyeOff,
} from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from './ToastProvider';
import { useConfig } from './ConfigContext';
import { automationService } from '@/services/automation-service';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

function SectionHeader({ icon: Icon, title, desc }: { icon: typeof Cpu; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-6 first:mt-0">
      <div className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-pink-500" />
      </div>
      <div>
        <h3 className="text-xs font-bold text-navy-800 uppercase tracking-wide leading-none">{title}</h3>
        <p className="text-[10px] text-navy-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function Field({ label, children, configured }: { label: string; children: React.ReactNode; configured?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-navy-500">{label}</label>
        {configured && (
          <span className="flex items-center gap-1 text-[10px] text-success-600 font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Set
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function FileUploadButton({
  label,
  fileName,
  accept,
  configured,
  locked,
  onFile,
}: {
  label: string;
  fileName: string;
  accept: string;
  configured: boolean;
  locked: boolean;
  onFile: (name: string, file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="text-xs font-medium text-navy-500 mb-1.5 block">{label}</label>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f.name, f);
        }}
      />
      {configured ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-success-50 border border-success-100">
          <FileCheck2 className="w-4 h-4 text-success-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-navy-700 flex-1 truncate">{fileName}</span>
          {locked ? (
            <LockIcon className="w-3.5 h-3.5 text-navy-300 flex-shrink-0" />
          ) : (
            <button
              onClick={() => ref.current?.click()}
              className="text-[10px] font-semibold text-pink-500 hover:text-pink-600"
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          disabled={locked}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-navy-200 text-navy-400 hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50/30 transition-all duration-300 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UploadCloud className="w-4 h-4" />
          Click to upload
        </button>
      )}
    </div>
  );
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { notify } = useToast();
  const { settings, locked, items, configuredCount, totalCount, update, save, lock, unlock } = useConfig();
  const [showPassword, setShowPassword] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [validating, setValidating] = useState(false);

  const allConfigured = configuredCount === totalCount;

  const handleSaveLock = () => {
    if (!allConfigured) {
      notify('Please configure all required items before locking', 'warning');
      return;
    }
    setValidating(true);
    save()
      .then(() => {
        setValidating(false);
        lock();
        notify('Configuration saved and locked — System is ready', 'success');
      })
      .catch((e) => {
        setValidating(false);
        notify(`Could not save configuration: ${e.message}`, 'error');
      });
  };

  const handleUnlock = () => {
    setShowUnlockConfirm(false);
    unlock();
    notify('Configuration unlocked for editing', 'info');
  };

  const lockedIndicator = (key: string) => {
    const item = items.find((i) => i.key === key);
    return item?.configured;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configuration Center"
      icon={
        <div className="w-9 h-9 rounded-xl bg-gradient-pink-blue flex items-center justify-center shadow-glow-pink">
          <SettingsIcon className="w-4 h-4 text-white" />
        </div>
      }
      maxWidth="max-w-2xl"
    >
      {/* Status banner */}
      {locked ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-navy-900 text-white animate-slide-down mb-2">
          <div className="flex items-center gap-2.5">
            <LockIcon className="w-4 h-4 text-pink-400" />
            <div>
              <p className="text-sm font-bold">CONFIGURATION LOCKED</p>
              <p className="text-[11px] text-navy-300">Status: Ready · {configuredCount}/{totalCount} items configured</p>
            </div>
          </div>
          <button
            onClick={() => setShowUnlockConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition-all duration-300"
          >
            <Unlock className="w-3.5 h-3.5" />
            Unlock
          </button>
        </div>
      ) : (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl mb-2 animate-slide-down ${
          allConfigured ? 'bg-success-50 border border-success-100' : 'bg-warning-50 border border-warning-100'
        }`}>
          {allConfigured ? (
            <CheckCircle2 className="w-4 h-4 text-success-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-warning-500" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-bold ${allConfigured ? 'text-success-700' : 'text-warning-700'}`}>
              {allConfigured ? 'Configuration Complete' : `${configuredCount} of ${totalCount} items configured`}
            </p>
            <p className={`text-[11px] ${allConfigured ? 'text-success-600' : 'text-warning-600'}`}>
              {allConfigured ? 'All required settings are ready. Click Save & Lock to finalize.' : 'Complete all required fields to enable Save & Lock.'}
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-24 h-2 bg-white rounded-full overflow-hidden flex-shrink-0">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allConfigured ? 'bg-success-500' : 'bg-gradient-pink-blue'}`}
              style={{ width: `${(configuredCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Config items checklist (visible when locked) */}
      {locked && (
        <div className="grid grid-cols-2 gap-2 mb-4 animate-fade-in">
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-navy-50">
              <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${item.configured ? 'text-success-500' : 'text-navy-300'}`} />
              <span className="text-[11px] text-navy-600 font-medium truncate">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className={`space-y-0 ${locked ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Automation */}
        <SectionHeader icon={Cpu} title="Automation" desc="RMA website and browser configuration" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="RMA Website URL" configured={lockedIndicator('rmaUrl')}>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
              <input
                type="text"
                value={settings.rmaUrl}
                onChange={(e) => update('rmaUrl', e.target.value)}
                placeholder="https://rma.example.com"
                className="input-field pl-9"
              />
            </div>
          </Field>
          <Field label="Chrome Path" configured={lockedIndicator('chromePath')}>
            <div className="relative">
              <HardDrive className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
              <input
                type="text"
                value={settings.chromePath}
                onChange={(e) => update('chromePath', e.target.value)}
                placeholder="C:\Program Files\Chrome\chrome.exe"
                className="input-field pl-9"
              />
            </div>
          </Field>
        </div>

        {/* Folders & Files */}
        <SectionHeader icon={FolderOpen} title="Folders & Files" desc="Data, master, and report locations" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Daily Excel / Data Folder" configured={lockedIndicator('dataFolder')}>
            <input
              type="text"
              value={settings.dataFolder}
              onChange={(e) => update('dataFolder', e.target.value)}
              className="input-field"
            />
          </Field>
          <Field label="Reports Folder" configured={lockedIndicator('reportsFolder')}>
            <input
              type="text"
              value={settings.reportsFolder}
              onChange={(e) => update('reportsFolder', e.target.value)}
              className="input-field"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <FileUploadButton
            label="Master Product Excel"
            fileName={settings.masterFileName || settings.masterExcelFile}
            accept=".xlsx,.xls"
            configured={settings.masterFileUploaded}
            locked={false}
            onFile={(name, file) => {
              automationService.uploadMaster(file)
                .then(() => {
                  update('masterFileUploaded', true);
                  update('masterFileName', name);
                  notify('Master product Excel uploaded', 'success');
                })
                .catch((e) => notify(`Upload failed: ${e.message}`, 'error'));
            }}
          />
          <FileUploadButton
            label="Company Documents / Reference Files"
            fileName={settings.companyDocsName}
            accept=".pdf,.doc,.docx,.xlsx"
            configured={settings.companyDocsUploaded}
            locked={false}
            onFile={(name, file) => {
              automationService.uploadDocs(file)
                .then(() => {
                  update('companyDocsUploaded', true);
                  update('companyDocsName', name);
                  notify('Company documents uploaded', 'success');
                })
                .catch((e) => notify(`Upload failed: ${e.message}`, 'error'));
            }}
          />
        </div>

        {/* Login */}
        <SectionHeader icon={User} title="Login Credentials" desc="RMA website authentication" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username" configured={lockedIndicator('login')}>
            <input
              type="text"
              value={settings.username}
              onChange={(e) => update('username', e.target.value)}
              placeholder="RMA username"
              className="input-field"
            />
          </Field>
          <Field label="Password" configured={lockedIndicator('login')}>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={settings.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="RMA password"
                className="input-field pr-9"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-500"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
        </div>
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-warning-50 border border-warning-100 mt-3">
          <Shield className="w-3.5 h-3.5 text-warning-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-navy-500 leading-relaxed">
            Credentials are stored securely in local configuration only — never in source code.
          </p>
        </div>

        {/* Safety */}
        <SectionHeader icon={Shield} title="Safety" desc="Automation safety controls" />
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-navy-700">Auto-Save</p>
            <p className="text-xs text-navy-400 mt-0.5">Automatically click final Save on RMA website</p>
          </div>
          <span className="badge bg-danger-100 text-danger-600">
            <Shield className="w-3 h-3" />
            LOCKED — DISABLED
          </span>
        </div>
        <div className="flex items-center justify-between py-1 mt-2">
          <div>
            <p className="text-sm font-medium text-navy-700">Confirm Before Start</p>
            <p className="text-xs text-navy-400 mt-0.5">Show confirmation dialog before starting automation</p>
          </div>
          <button
            onClick={() => update('confirmBeforeStart', !settings.confirmBeforeStart)}
            className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
              settings.confirmBeforeStart ? 'bg-gradient-pink-blue shadow-glow-pink' : 'bg-navy-200'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
              settings.confirmBeforeStart ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-navy-100">
        <button onClick={onClose} className="btn-secondary">
          Close
        </button>
        {!locked && (
          <button
            onClick={handleSaveLock}
            disabled={!allConfigured || validating}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {validating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Save & Lock Configuration
              </>
            )}
          </button>
        )}
      </div>

      {/* Unlock confirmation */}
      {showUnlockConfirm && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl animate-fade-in">
          <div className="card p-5 w-full max-w-xs animate-scale-in">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-warning-100 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-warning-500" />
              </div>
              <h3 className="text-sm font-bold text-navy-900">Unlock Configuration?</h3>
            </div>
            <p className="text-xs text-navy-500 mb-4">
              This will allow editing of all settings. The system will no longer be in "Ready" state until you save and lock again.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowUnlockConfirm(false)} className="btn-secondary flex-1 text-xs">
                Cancel
              </button>
              <button onClick={handleUnlock} className="btn-danger flex-1 text-xs">
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
