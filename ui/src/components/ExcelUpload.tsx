import { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, X, FileCheck2, FolderOpen } from 'lucide-react';
import { automationService, type FileListItem } from '@/services/automation-service';
import type { ExcelFileInfo, ValidationResult, PartySummary, ProductSummary } from '@/types';

interface ExcelUploadProps {
  fileInfo: ExcelFileInfo | null;
  validation: ValidationResult | null;
  parties: PartySummary[];
  products: ProductSummary[];
  onFileSelected: (file: File) => void;
  onExistingSelected: (path: string) => void;
  onClearFile: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExcelUpload({
  fileInfo,
  validation,
  products,
  onFileSelected,
  onExistingSelected,
  onClearFile,
}: ExcelUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [existingFiles, setExistingFiles] = useState<FileListItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel files already present in the server's data folder
  useEffect(() => {
    automationService.listFiles().then(setExistingFiles).catch(() => setExistingFiles([]));
  }, [fileInfo]);

  const handleFile = useCallback(
    (file: File) => {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        onFileSelected(file);
      }
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  if (fileInfo) {
    const readyProducts = products.filter((p) => p.status === 'ready').length;
    const reviewProducts = products.filter((p) => p.status === 'review').length;

    return (
      <div className="card p-5 animate-scale-in overflow-hidden relative">
        {/* Decorative gradient corner */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-pink-50/50 blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4 mb-4 relative">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-pink flex items-center justify-center shadow-glow-pink flex-shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-navy-900 truncate">{fileInfo.fileName}</p>
              <p className="text-xs text-navy-400 mt-0.5">
                {formatFileSize(fileInfo.fileSize)} · Modified {fileInfo.modifiedDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClearFile}
            className="w-8 h-8 rounded-lg bg-navy-50 hover:bg-danger-50 text-navy-400 hover:text-danger-500 flex items-center justify-center transition-all duration-300 active:scale-90 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2.5 mb-4">
          {[
            { val: fileInfo.sheetCount, label: 'Sheets', bg: 'bg-navy-50', txt: 'text-navy-900' },
            { val: fileInfo.partyCount, label: 'Parties', bg: 'bg-pink-50', txt: 'text-pink-600' },
            { val: fileInfo.productRowCount, label: 'Products', bg: 'bg-blue-50', txt: 'text-blue-600' },
            { val: readyProducts, label: 'Ready', bg: 'bg-success-50', txt: 'text-success-600' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`${stat.bg} rounded-xl px-3 py-2.5 text-center animate-fade-in-up`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <p className={`text-xl font-bold ${stat.txt} tabular-nums`}>{stat.val}</p>
              <p className="text-[10px] text-navy-400 font-medium mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Validation */}
        {validation && (
          <div className="space-y-1.5">
            {validation.checks.map((check, i) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs animate-fade-in ${
                  check.status === 'pass'
                    ? 'bg-success-50 text-success-700'
                    : check.status === 'warn'
                    ? 'bg-warning-50 text-warning-700'
                    : 'bg-danger-50 text-danger-700'
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {check.status === 'pass' ? (
                  <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0 animate-check-pop" />
                ) : check.status === 'warn' ? (
                  <span className="text-warning-500 font-bold flex-shrink-0">!</span>
                ) : (
                  <X className="w-4 h-4 text-danger-500 flex-shrink-0" />
                )}
                <span className="font-medium">{check.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* File ready badge */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-navy-100">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success-500 text-white shadow-glow-success">
            <FileCheck2 className="w-4 h-4" />
            <span className="text-xs font-bold tracking-wide">FILE READY</span>
          </div>
          {reviewProducts > 0 && (
            <span className="text-xs text-warning-600 font-medium">
              {reviewProducts} product{reviewProducts > 1 ? 's' : ''} require review
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 overflow-hidden relative">
        <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-blue-50/40 blur-2xl pointer-events-none" />
        <div className="mb-3 relative">
        <h3 className="text-sm font-bold text-navy-900">Daily RMA Entry</h3>
        <p className="text-xs text-navy-400 mt-0.5">Upload today's Excel file to begin automation.</p>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-10 px-6 ${
          isDragging
            ? 'border-pink-400 bg-pink-50 scale-[1.02]'
            : isHovering
            ? 'border-pink-300 bg-pink-50/30'
            : 'border-navy-200 bg-navy-50/40'
        }`}
      >
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 ${
            isDragging ? 'bg-gradient-pink scale-110 shadow-glow-pink' : 'bg-white border border-navy-100'
          }`}
        >
          <UploadCloud className={`w-7 h-7 transition-colors duration-300 ${isDragging ? 'text-white' : 'text-pink-400'}`} />
        </div>
        <p className="text-sm font-semibold text-navy-700 mb-1">
          {isDragging ? 'Drop your file here' : 'Drop Daily Excel Here'}
        </p>
        <p className="text-xs text-navy-400">or click to browse · .xlsx files only</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }}
        />
      </div>

      {/* Files already inside the automation data folder */}
      {existingFiles.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] text-navy-400 font-bold tracking-wide uppercase mb-1.5 flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3" />
            Or pick from data folder
          </p>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {existingFiles.map((f) => (
              <button
                key={f.path}
                onClick={() => onExistingSelected(f.path)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-50/60 hover:bg-pink-50 border border-transparent hover:border-pink-200 text-left transition-all duration-200"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                <span className="text-xs font-medium text-navy-700 truncate flex-1">{f.name}</span>
                <span className="text-[10px] text-navy-300 tabular-nums">{formatFileSize(f.size)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
