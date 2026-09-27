import React from 'react';
import {
  Building2,
  FileText,
  Printer,
  RotateCcw,
  Download,
  Upload,
  Sparkles,
  BookOpen,
  Database,
  Cloud,
  CloudCheck,
  RefreshCw,
  ChevronDown,
  Users,
} from 'lucide-react';
import { SchoolMasterData } from '../types';
import { SchoolTenant } from '../data/tenantPresets';

interface HeaderProps {
  school: SchoolMasterData;
  currentTenant: SchoolTenant;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenPrintModal: (docType?: string) => void;
  onReset: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onOpenSchoolPortal: () => void;
  isSyncing: boolean;
  lastSyncedText: string;
  onManualSave?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  school,
  currentTenant,
  activeTab,
  setActiveTab,
  onOpenPrintModal,
  onReset,
  onExportJson,
  onImportJson,
  onOpenSchoolPortal,
  isSyncing,
  lastSyncedText,
  onManualSave,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Ringkasan Proyek' },
    { id: 'realdata', label: 'Data Real Sekolah' },
    { id: 'master', label: 'Data Master Sekolah' },
    { id: 'rpd', label: 'RPD & Analisa Satuan' },
    { id: 'progress', label: 'Laporan Mingguan & Bobot' },
    { id: 'bku', label: 'BKU (Kas Umum)' },
    { id: 'bkt', label: 'BKT (Kas Tunai)' },
    { id: 'bkb', label: 'BKB (Buku Bank)' },
    { id: 'pajak', label: 'Laporan Pajak' },
    { id: 'kwitansi', label: 'Kwitansi, Bon & SPB' },
    { id: 'upah', label: 'Upah Tenaga Kerja' },
    { id: 'toko', label: 'Toko Rekanan & Penyedia' },
  ];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-40 print:hidden">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* School & Multi-tenant Switcher */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSchoolPortal}
            title="Klik untuk berpindah database sekolah atau mendaftar sekolah baru"
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20 text-white hover:scale-105 transition cursor-pointer"
          >
            <Building2 className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onOpenSchoolPortal}
                className="group flex items-center gap-1.5 text-left cursor-pointer"
                title="Klik untuk berpindah database sekolah"
              >
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white group-hover:text-blue-300 transition">
                  {school.namaSekolah}
                </h1>
                <div className="bg-slate-800 group-hover:bg-blue-600/30 p-0.5 rounded text-slate-400 group-hover:text-blue-300 transition">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </button>

              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono font-medium border border-blue-400/30">
                NPSN: {currentTenant.npsn || school.npsn}
              </span>
            </div>

            {/* Sub-info: City, Year, and Real-time Cloud Status */}
            <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap mt-0.5">
              <span>{school.kabKota} • TA {school.tahunAnggaran}</span>
              <span>•</span>
              
              {/* Cloud Sync Status Indicator */}
              <button
                onClick={onOpenSchoolPortal}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:underline cursor-pointer"
                title="Data tersimpan di Google Cloud Firestore (Multi-Tenant)"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                    <span className="text-amber-300">Menyimpan ke Cloud...</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-emerald-300 font-medium">Cloud Terhubung</span>
                    <span className="text-slate-400 text-[10px]">({lastSyncedText})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onManualSave && (
            <button
              onClick={onManualSave}
              disabled={isSyncing}
              title="Simpan permanen data sekolah saat ini ke Cloud Firestore"
              className="flex items-center gap-1.5 bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs border border-emerald-500/40 transition cursor-pointer"
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-emerald-300" />
              )}
              <span className="hidden sm:inline">{isSyncing ? 'Menyimpan...' : 'Simpan Cloud'}</span>
            </button>
          )}

          {/* Switch School / Multi-Tenant Portal Button */}
          <button
            onClick={onOpenSchoolPortal}
            className="flex items-center gap-1.5 bg-blue-600/90 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm border border-blue-500/40 transition cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Ganti / Tambah Sekolah</span>
          </button>

          <button
            onClick={() => onOpenPrintModal('ALL')}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cetak Dokumen LPJ</span>
            <span className="sm:hidden">Cetak</span>
          </button>

          <button
            onClick={onExportJson}
            title="Cadangkan data sekolah ini ke file JSON"
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Backup</span>
          </button>

          <button
            onClick={onImportJson}
            title="Pulihkan data sekolah ini dari JSON"
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Restore</span>
          </button>

          <button
            onClick={onReset}
            title="Reset ulang formulir sekolah ini"
            className="flex items-center gap-1 bg-slate-800 hover:bg-rose-900/50 hover:text-rose-300 text-slate-300 px-2 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="bg-slate-950 border-t border-slate-800/80 overflow-x-auto scrollbar-thin">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 min-w-max py-1.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
