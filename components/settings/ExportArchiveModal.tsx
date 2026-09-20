'use client';

import React, { useState, useEffect, useId } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Download,
  FileCheck,
  Database,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  Upload,
  Layers,
  FileText,
  X,
  ShieldAlert,
} from 'lucide-react';
import type { User as StaffUser } from '@/lib/types';
import {
  getDatabaseOverallStats,
  createDatabaseDump,
  createEncryptedArchive,
  decryptBackupArchive,
  downloadBackupFile,
  logBackupAuditEvent,
  ALL_DATABASE_TABLES,
  type DatabaseOverallStats,
  type TableName,
  type EncryptedBackupArchive,
  type DatabaseDump,
} from '@/lib/services/backupService';
import { sound } from '@/lib/audio';

interface ExportArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StaffUser;
  allUsers: StaffUser[];
  onBackupExported?: () => void;
}

export const ExportArchiveModal: React.FC<ExportArchiveModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  onBackupExported,
}) => {
  const [activeTab, setActiveTab] = useState<'EXPORT' | 'VERIFY'>('EXPORT');
  const [dbStats, setDbStats] = useState<DatabaseOverallStats | null>(null);
  const [selectedTables, setSelectedTables] = useState<TableName[]>([...ALL_DATABASE_TABLES]);
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [backupNote, setBackupNote] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStep, setExportStep] = useState<string | null>(null);
  const [successPayload, setSuccessPayload] = useState<{
    filename: string;
    jsonString: string;
    totalRecords: number;
    checksum: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Manager PIN Verification Gate (if current user is not already Admin/Manager)
  const isAuthorizedManager = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';
  const [managerPinInput, setManagerPinInput] = useState('');
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);

  const isPinAuthenticated = isAuthorizedManager || isPinUnlocked;

  // Verification Tab State
  const [verifyFileContent, setVerifyFileContent] = useState('');
  const [verifyPassphrase, setVerifyPassphrase] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    dump?: DatabaseDump;
    metadata?: any;
    error?: string;
  } | null>(null);

  const noteInputId = useId();
  const passInputId = useId();
  const confirmPassInputId = useId();
  const pinInputId = useId();

  // Load database stats whenever modal is opened
  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      getDatabaseOverallStats().then(stats => {
        if (isMounted) setDbStats(stats);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Manager PIN Submit
  const handleVerifyManagerPin = (e: React.FormEvent) => {
    e.preventDefault();
    const validManager = allUsers.find(
      u => (u.role === 'ADMIN' || u.role === 'MANAGER') && u.pin === managerPinInput.trim()
    );

    if (validManager) {
      sound.playSuccess();
      setIsPinUnlocked(true);
      setPinError(false);
    } else {
      sound.playError();
      setPinError(true);
      setManagerPinInput('');
    }
  };

  // Generate strong 16-character alphanumeric passphrase
  const handleGeneratePassphrase = () => {
    sound.playClick();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let generated = '';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
      generated += chars[array[i] % chars.length];
    }
    setPassphrase(generated);
    setConfirmPassphrase(generated);
    setShowPassword(true);
  };

  // Toggle Table Inclusion
  const toggleTable = (table: TableName) => {
    sound.playClick();
    setSelectedTables(prev =>
      prev.includes(table) ? prev.filter(t => t !== table) : [...prev, table]
    );
  };

  const handleSelectAllTables = () => {
    sound.playClick();
    setSelectedTables([...ALL_DATABASE_TABLES]);
  };

  const handleDeselectAllTables = () => {
    sound.playClick();
    setSelectedTables([]);
  };

  // Execute Export
  const handleExecuteExport = async () => {
    if (selectedTables.length === 0) {
      alert('Please select at least one database table to include in the backup.');
      return;
    }

    if (isEncrypted) {
      if (!passphrase || passphrase.length < 6) {
        alert('Passphrase must be at least 6 characters long.');
        return;
      }
      if (passphrase !== confirmPassphrase) {
        alert('Passphrases do not match. Please verify your passphrase.');
        return;
      }
    }

    sound.playClick();
    setIsExporting(true);
    setExportStep('Querying IndexedDB tables...');

    try {
      // 1. Dump database data
      await new Promise(r => setTimeout(r, 200));
      const dump = await createDatabaseDump(currentUser, backupNote, selectedTables);

      let finalJsonString = '';
      let filename = '';

      if (isEncrypted) {
        setExportStep('Deriving PBKDF2 key & applying AES-256-GCM encryption...');
        await new Promise(r => setTimeout(r, 350));
        const encryptedArchive = await createEncryptedArchive(dump, passphrase);
        finalJsonString = JSON.stringify(encryptedArchive, null, 2);

        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
        filename = `nexora-encrypted-backup-${dateStr}.nexora.json`;

        await logBackupAuditEvent(
          currentUser,
          'ENCRYPTED',
          dump.metadata.totalRecords,
          dump.metadata.checksumSha256
        );
      } else {
        setExportStep('Compiling plaintext database archive...');
        await new Promise(r => setTimeout(r, 200));
        finalJsonString = JSON.stringify(
          {
            format: 'NEXORA_UNENCRYPTED_BACKUP_V1',
            encrypted: false,
            metadata: dump.metadata,
            dump,
          },
          null,
          2
        );

        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
        filename = `nexora-plaintext-backup-${dateStr}.json`;

        await logBackupAuditEvent(
          currentUser,
          'UNENCRYPTED',
          dump.metadata.totalRecords,
          dump.metadata.checksumSha256
        );
      }

      setExportStep('Triggering archive download...');
      downloadBackupFile(finalJsonString, filename);

      // Record last backup timestamp in localStorage for operator awareness
      localStorage.setItem('nexora_last_backup_at', new Date().toISOString());
      onBackupExported?.();

      sound.playSaleSuccess();
      setSuccessPayload({
        filename,
        jsonString: finalJsonString,
        totalRecords: dump.metadata.totalRecords,
        checksum: dump.metadata.checksumSha256,
      });
    } catch (err: any) {
      console.error('Backup export failed:', err);
      sound.playError();
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
      setExportStep(null);
    }
  };

  // Copy payload to clipboard
  const handleCopyPayload = async () => {
    if (!successPayload) return;
    try {
      await navigator.clipboard.writeText(successPayload.jsonString);
      sound.playClick();
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert('Could not copy to clipboard.');
    }
  };

  // Verify / Decrypt an uploaded archive file
  const handleVerifyArchive = async () => {
    if (!verifyFileContent.trim()) {
      alert('Please select or paste an archive file content first.');
      return;
    }

    sound.playClick();
    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const parsed = JSON.parse(verifyFileContent);

      if (parsed.format === 'NEXORA_ENCRYPTED_BACKUP_V1') {
        if (!verifyPassphrase) {
          alert('Please enter the archive passphrase to decrypt this encrypted backup.');
          setIsVerifying(false);
          return;
        }

        const dump = await decryptBackupArchive(parsed as EncryptedBackupArchive, verifyPassphrase);
        sound.playSuccess();
        setVerifyResult({
          valid: true,
          dump,
          metadata: parsed.metadata,
        });
      } else if (parsed.format === 'NEXORA_UNENCRYPTED_BACKUP_V1') {
        sound.playSuccess();
        setVerifyResult({
          valid: true,
          dump: parsed.dump,
          metadata: parsed.metadata,
        });
      } else {
        throw new Error('Unrecognized archive format header. Ensure this is a valid Nexora POS backup file.');
      }
    } catch (err: any) {
      sound.playError();
      setVerifyResult({
        valid: false,
        error: err.message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle file upload in verify tab
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      setVerifyFileContent(content);
      setVerifyResult(null);
    };
    reader.readAsText(file);
  };

  return (
    <div
      id="export-archive-modal-backdrop"
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        id="export-archive-modal-container"
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Export Data Archive
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  AES-256-GCM
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Secure, encrypted offline snapshot of the complete local database for disaster recovery and off-site archives.
              </p>
            </div>
          </div>
          <button
            id="close-archive-modal-btn"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Manager Authentication Gate (if Cashier) */}
        {!isPinAuthenticated ? (
          <div className="p-8 text-center max-w-md mx-auto space-y-5 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Manager Authorization Required</h3>
              <p className="text-xs text-slate-400 mt-1">
                Full database export contains complete business transactions, staff profiles, and ledger history. Please enter an authorized Manager or Admin PIN to unlock.
              </p>
            </div>

            <form onSubmit={handleVerifyManagerPin} className="space-y-4">
              <div>
                <label htmlFor={pinInputId} className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 text-left">
                  Manager PIN Code
                </label>
                <input
                  id={pinInputId}
                  type="password"
                  maxLength={6}
                  autoFocus
                  value={managerPinInput}
                  onChange={e => setManagerPinInput(e.target.value)}
                  placeholder="Enter 4-6 digit PIN"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-white focus:outline-hidden focus:border-sky-500"
                />
                {pinError && (
                  <p className="text-xs text-rose-400 mt-1 text-left font-medium">
                    Invalid PIN code. Access denied.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-950"
                >
                  Verify & Unlock
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 pt-3 gap-2">
              <button
                id="tab-export-archive"
                onClick={() => {
                  sound.playClick();
                  setActiveTab('EXPORT');
                }}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'EXPORT'
                    ? 'border-sky-400 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Create & Download Archive</span>
              </button>
              <button
                id="tab-verify-archive"
                onClick={() => {
                  sound.playClick();
                  setActiveTab('VERIFY');
                }}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'VERIFY'
                    ? 'border-sky-400 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCheck className="w-4 h-4" />
                <span>Verify & Test Decrypt</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {activeTab === 'EXPORT' ? (
                <>
                  {/* Database Scope & Stats Card */}
                  <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-800 text-emerald-400">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">
                          Local Database Snapshot
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {dbStats ? (
                            <>
                              <span className="font-mono text-emerald-400 font-bold">
                                {dbStats.totalRecords} records
                              </span>{' '}
                              across {dbStats.tableCount} tables • Est.{' '}
                              <span className="font-mono text-slate-300">
                                {(dbStats.estimatedSizeBytes / 1024).toFixed(1)} KB
                              </span>
                            </>
                          ) : (
                            'Calculating database volume...'
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Operator:</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-semibold">
                        {currentUser.name} ({currentUser.role})
                      </span>
                    </div>
                  </div>

                  {/* Security & Encryption Options */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                        Encryption & Protection Mode
                      </label>

                      <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            setIsEncrypted(true);
                          }}
                          className={`px-3 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1.5 ${
                            isEncrypted
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Lock className="w-3 h-3" />
                          Encrypted (AES-256)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            setIsEncrypted(false);
                          }}
                          className={`px-3 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1.5 ${
                            !isEncrypted
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Unlock className="w-3 h-3" />
                          Plain JSON
                        </button>
                      </div>
                    </div>

                    {isEncrypted ? (
                      <div className="bg-slate-950 border border-sky-500/30 rounded-2xl p-4 space-y-3.5 animate-in fade-in duration-150">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11px] text-sky-200/90 leading-relaxed">
                            Secured with standard <strong>AES-256-GCM</strong> and <strong>PBKDF2</strong> key derivation (100,000 iterations). Protects sensitive financial sales records, inventory costs, and staff PINs when stored off-site.
                          </p>
                          <button
                            type="button"
                            onClick={handleGeneratePassphrase}
                            className="text-[11px] font-bold text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 shrink-0 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20"
                          >
                            <Sparkles className="w-3 h-3" /> Generate Passphrase
                          </button>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label htmlFor={passInputId} className="font-bold text-slate-400 uppercase text-[10px]">
                                Encryption Passphrase *
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="text-slate-400 hover:text-slate-200 text-[10px] flex items-center gap-1"
                              >
                                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                {showPassword ? 'Hide' : 'Show'}
                              </button>
                            </div>
                            <input
                              id={passInputId}
                              type={showPassword ? 'text' : 'password'}
                              value={passphrase}
                              onChange={e => setPassphrase(e.target.value)}
                              placeholder="Minimum 6 characters"
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-hidden focus:border-sky-500"
                            />
                          </div>

                          <div>
                            <label htmlFor={confirmPassInputId} className="block font-bold text-slate-400 uppercase text-[10px] mb-1">
                              Confirm Passphrase *
                            </label>
                            <input
                              id={confirmPassInputId}
                              type={showPassword ? 'text' : 'password'}
                              value={confirmPassphrase}
                              onChange={e => setConfirmPassphrase(e.target.value)}
                              placeholder="Re-enter to verify"
                              className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-hidden ${
                                confirmPassphrase && passphrase !== confirmPassphrase
                                  ? 'border-rose-500'
                                  : 'border-slate-700 focus:border-sky-500'
                              }`}
                            />
                          </div>
                        </div>

                        {passphrase && (
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                            <span>
                              Strength:{' '}
                              {passphrase.length >= 12 ? (
                                <strong className="text-emerald-400">Strong (128+ bit entropy)</strong>
                              ) : passphrase.length >= 8 ? (
                                <strong className="text-sky-400">Moderate</strong>
                              ) : (
                                <strong className="text-amber-400">Basic</strong>
                              )}
                            </span>
                            <span className="text-slate-500">Zero server knowledge</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-3 text-amber-300">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                        <div className="space-y-1">
                          <div className="font-bold text-xs">Unencrypted Export Selected</div>
                          <p className="text-[11px] text-amber-200/80 leading-relaxed">
                            This archive will be downloaded in plain readable JSON format. Anyone with access to the file can view sales records and staff profiles.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Optional Backup Note */}
                  <div>
                    <label htmlFor={noteInputId} className="block font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                      Archive Label / Off-Site Storage Note (Optional)
                    </label>
                    <input
                      id={noteInputId}
                      type="text"
                      value={backupNote}
                      onChange={e => setBackupNote(e.target.value)}
                      placeholder="e.g. End of Month Q3 Archive, Pre-terminal hardware replacement, etc."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs placeholder-slate-600 focus:outline-hidden focus:border-sky-500"
                    />
                  </div>

                  {/* Included Database Tables */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-sky-400" />
                        Selected Tables ({selectedTables.length} of {ALL_DATABASE_TABLES.length})
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllTables}
                          className="text-[10.5px] text-sky-400 hover:underline font-semibold"
                        >
                          Select All
                        </button>
                        <span className="text-slate-600">•</span>
                        <button
                          type="button"
                          onClick={handleDeselectAllTables}
                          className="text-[10.5px] text-slate-400 hover:underline"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                      {ALL_DATABASE_TABLES.map(table => {
                        const isSelected = selectedTables.includes(table);
                        const count = dbStats?.tableStats.find(s => s.tableName === table)?.count ?? 0;

                        return (
                          <button
                            key={table}
                            type="button"
                            onClick={() => toggleTable(table)}
                            className={`p-2 rounded-xl border text-left flex items-center justify-between transition ${
                              isSelected
                                ? 'bg-sky-500/10 border-sky-500/50 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                            }`}
                          >
                            <span className="font-mono text-[11px] truncate capitalize">
                              {table.replace(/([A-Z])/g, ' $1')}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                                isSelected ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Success Banner if Exported */}
                  {successPayload && (
                    <div
                      id="export-success-card"
                      className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-4 space-y-3 animate-in fade-in"
                    >
                      <div className="flex items-start gap-3 text-emerald-300">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="font-bold text-sm text-white">
                            Archive Download Complete!
                          </div>
                          <p className="text-[11px] text-emerald-200/80 leading-relaxed font-mono truncate">
                            File: {successPayload.filename} ({successPayload.totalRecords} records)
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            SHA-256: {successPayload.checksum.slice(0, 24)}...
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-emerald-500/20">
                        <button
                          type="button"
                          onClick={() => downloadBackupFile(successPayload.jsonString, successPayload.filename)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Again
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyPayload}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? 'Copied Payload!' : 'Copy JSON'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Verify & Test Decrypt Tab */
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-white font-bold text-xs">
                      <FileCheck className="w-4 h-4 text-sky-400" />
                      Verify Archive Integrity & Decrypt Off-Site Backup
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Upload any previously saved Nexora backup file to verify that its cryptographic signature, table data, and decryption passphrase are intact.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                      Upload Backup File (.json)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white transition flex items-center gap-2 shadow-xs">
                        <Upload className="w-4 h-4 text-sky-400" />
                        <span>Select .json Archive</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[11px] text-slate-500">
                        {verifyFileContent ? 'File loaded successfully' : 'No file chosen'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                      Archive Passphrase (if encrypted)
                    </label>
                    <input
                      type="password"
                      value={verifyPassphrase}
                      onChange={e => setVerifyPassphrase(e.target.value)}
                      placeholder="Enter passphrase used during export"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-hidden focus:border-sky-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyArchive}
                    disabled={isVerifying || !verifyFileContent}
                    className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Verify & Decrypt Archive</span>
                  </button>

                  {/* Verification Results Card */}
                  {verifyResult && (
                    <div
                      className={`p-4 rounded-2xl border space-y-3 animate-in fade-in ${
                        verifyResult.valid
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                          : 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        {verifyResult.valid ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-white">Archive Decrypted & Integrity Confirmed!</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            <span className="text-white">Verification Failed</span>
                          </>
                        )}
                      </div>

                      {verifyResult.valid && verifyResult.dump ? (
                        <div className="space-y-2 text-[11px] pt-1">
                          <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                            <div>
                              <span className="text-slate-400">Exported At:</span>{' '}
                              <span className="font-mono text-white">
                                {new Date(verifyResult.dump.exportedAt).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Exported By:</span>{' '}
                              <span className="text-white">
                                {verifyResult.dump.exportedBy.name} ({verifyResult.dump.exportedBy.role})
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Total Records:</span>{' '}
                              <span className="font-mono text-emerald-400 font-bold">
                                {verifyResult.dump.metadata.totalRecords}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Tables:</span>{' '}
                              <span className="font-mono text-sky-400 font-bold">
                                {verifyResult.dump.metadata.tableCount}
                              </span>
                            </div>
                          </div>

                          <div className="font-bold text-slate-300 text-[10.5px] uppercase tracking-wider mt-2">
                            Table Breakdown:
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto">
                            {Object.entries(verifyResult.dump.tables).map(([tbl, rows]) => (
                              <div
                                key={tbl}
                                className="bg-slate-900 px-2 py-1 rounded border border-slate-800 flex justify-between font-mono text-[10px]"
                              >
                                <span className="text-slate-400 truncate">{tbl}:</span>
                                <span className="text-white font-bold">{rows.length}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-rose-300">{verifyResult.error}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                {exportStep ? (
                  <span className="flex items-center gap-2 text-sky-400">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {exportStep}
                  </span>
                ) : (
                  'All cryptographic encryption executes 100% locally in the browser'
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs font-semibold"
                >
                  Close
                </button>

                {activeTab === 'EXPORT' && (
                  <button
                    id="btn-confirm-export-archive"
                    type="button"
                    onClick={handleExecuteExport}
                    disabled={isExporting}
                    className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-sky-950"
                  >
                    {isExporting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>Download Secure Archive</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
