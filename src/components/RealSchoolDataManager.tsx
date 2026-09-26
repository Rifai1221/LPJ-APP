import React, { useState, useRef } from 'react';
import { RealSchoolData, RabDivision, RabSubItem, AhspItem, AhspKomponen } from '../types';
import {
  FileSpreadsheet,
  Calculator,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Building,
  CheckCircle,
  FolderSync,
  X,
  Layers,
  Download,
  Upload,
  FileUp,
  AlertTriangle,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { defaultRealSchoolData } from '../data/realSchoolData';
import { downloadRealDataExcelTemplate, parseRealDataExcelFile } from '../utils/excelHelper';
import { toRoman } from '../utils/formatters';

interface RealSchoolDataManagerProps {
  realData: RealSchoolData;
  onUpdateRealData: (newData: RealSchoolData) => void;
  onApplyToAllModules: (data: RealSchoolData) => void;
}

export const RealSchoolDataManager: React.FC<RealSchoolDataManagerProps> = ({
  realData = defaultRealSchoolData,
  onUpdateRealData,
  onApplyToAllModules,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'rekap' | 'rab' | 'ahsp'>('rekap');
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>({
    'div-1': true,
    'div-2': true,
    'div-3': true,
    'div-4': true,
  });

  // Division Modal / Form state
  const [editingDivision, setEditingDivision] = useState<RabDivision | null>(null);
  const [isAddingDivision, setIsAddingDivision] = useState(false);
  const [newDivForm, setNewDivForm] = useState({ kode: '', uraian: '' });

  // AHSP Modal / Form state
  const [editingAhsp, setEditingAhsp] = useState<AhspItem | null>(null);
  const [isAddingAhsp, setIsAddingAhsp] = useState(false);
  const [newAhspForm, setNewAhspForm] = useState({ kodePekerjaan: '', namaPekerjaan: '', satuan: 'm³' });

  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Excel Import / Export State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [importedExcelResult, setImportedExcelResult] = useState<{
    data: Partial<RealSchoolData>;
    summary: { divisionsCount: number; rabItemsCount: number; ahspCount: number };
  } | null>(null);
  const [excelImportMode, setExcelImportMode] = useState<'REPLACE' | 'MERGE'>('REPLACE');
  const [excelSuccessMsg, setExcelSuccessMsg] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    downloadRealDataExcelTemplate(realData);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingExcel(true);
    const res = await parseRealDataExcelFile(file);
    setIsParsingExcel(false);

    if (e.target) e.target.value = '';

    if (!res.success || !res.data) {
      alert(`Gagal membaca file Excel: ${res.message}`);
      return;
    }

    setImportedExcelResult({
      data: res.data,
      summary: res.summary || { divisionsCount: 0, rabItemsCount: 0, ahspCount: 0 },
    });
  };

  const handleApplyImportedExcel = () => {
    if (!importedExcelResult) return;
    const { data } = importedExcelResult;

    if (excelImportMode === 'REPLACE') {
      const merged: RealSchoolData = {
        ...realData,
        ...data,
        divisions: data.divisions || realData.divisions,
        ahspList: data.ahspList || realData.ahspList,
        totalNilaiRab: data.totalNilaiRab || realData.totalNilaiRab,
      };
      onUpdateRealData(merged);
      setExcelSuccessMsg(
        `Berhasil mengimpor data real sekolah dari file Excel! (${data.divisions?.length || 0} Divisi, ${
          data.ahspList?.length || 0
        } AHSP)`
      );
    } else {
      // MERGE mode
      const existingDivs = [...realData.divisions];
      if (data.divisions) {
        data.divisions.forEach((newDiv) => {
          const idx = existingDivs.findIndex((d) => d.kode.toUpperCase() === newDiv.kode.toUpperCase());
          if (idx >= 0) {
            existingDivs[idx] = newDiv;
          } else {
            existingDivs.push(newDiv);
          }
        });
      }

      const existingAhsp = [...(realData.ahspList || [])];
      if (data.ahspList) {
        data.ahspList.forEach((newAh) => {
          const idx = existingAhsp.findIndex(
            (a) => a.kodePekerjaan.toLowerCase() === newAh.kodePekerjaan.toLowerCase()
          );
          if (idx >= 0) {
            existingAhsp[idx] = newAh;
          } else {
            existingAhsp.push(newAh);
          }
        });
      }

      const tot = existingDivs.reduce((s, d) => s + d.subTotal, 0);

      const merged: RealSchoolData = {
        ...realData,
        ...data,
        divisions: existingDivs,
        ahspList: existingAhsp,
        totalNilaiRab: tot,
      };
      onUpdateRealData(merged);
      setExcelSuccessMsg(`Berhasil menggabungkan (merge) data dari file Excel ke proyek!`);
    }

    setImportedExcelResult(null);
    setTimeout(() => setExcelSuccessMsg(null), 5000);
  };

  const toggleDivision = (id: string) => {
    setExpandedDivisions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  // Recalculate totals
  const currentTotalRab = realData.divisions.reduce((sum, d) => sum + (d.subTotal || 0), 0);
  const biayaPerM2 = realData.luasBangunanM2 > 0 ? currentTotalRab / realData.luasBangunanM2 : 0;

  // Handle header field change
  const handleHeaderChange = (field: keyof RealSchoolData, value: any) => {
    const updated = { ...realData, [field]: value };
    if (field === 'luasBangunanM2') {
      const luas = parseFloat(value) || 1;
      updated.biayaPerM2 = updated.totalNilaiRab / luas;
    }
    onUpdateRealData(updated);
  };

  // --- DIVISION CRUD ---
  const handleAddDivision = () => {
    if (!newDivForm.kode.trim() || !newDivForm.uraian.trim()) {
      alert('Mohon isi Kode Divisi dan Uraian Pekerjaan');
      return;
    }
    const newDivId = `div-${Date.now()}`;
    const newDivision: RabDivision = {
      id: newDivId,
      kode: newDivForm.kode.toUpperCase().trim(),
      uraian: newDivForm.uraian.toUpperCase().trim(),
      subTotal: 0,
      bobotPersen: 0,
      items: [],
    };

    const updatedDivs = [...realData.divisions, newDivision];
    const newTotal = updatedDivs.reduce((s, d) => s + (d.subTotal || 0), 0);
    const rebalancedDivs = updatedDivs.map((d) => ({
      ...d,
      bobotPersen: newTotal > 0 ? parseFloat(((d.subTotal / newTotal) * 100).toFixed(2)) : 0,
    }));

    onUpdateRealData({
      ...realData,
      divisions: rebalancedDivs,
      totalNilaiRab: newTotal,
      biayaPerM2: realData.luasBangunanM2 > 0 ? newTotal / realData.luasBangunanM2 : 0,
    });

    setExpandedDivisions((prev) => ({ ...prev, [newDivId]: true }));
    setNewDivForm({ kode: '', uraian: '' });
    setIsAddingDivision(false);
  };

  const handleSaveEditDivision = () => {
    if (!editingDivision) return;
    const updatedDivs = realData.divisions.map((d) => (d.id === editingDivision.id ? editingDivision : d));
    onUpdateRealData({
      ...realData,
      divisions: updatedDivs,
    });
    setEditingDivision(null);
  };

  const handleDeleteDivision = (divId: string, kode: string) => {
    if (!confirm(`Hapus Divisi ${kode} beserta seluruh item pekerjaannya?`)) return;
    const updatedDivs = realData.divisions.filter((d) => d.id !== divId);
    const newTotal = updatedDivs.reduce((sum, d) => sum + (d.subTotal || 0), 0);
    const rebalancedDivs = updatedDivs.map((d) => ({
      ...d,
      bobotPersen: newTotal > 0 ? parseFloat(((d.subTotal / newTotal) * 100).toFixed(2)) : 0,
    }));

    onUpdateRealData({
      ...realData,
      divisions: rebalancedDivs,
      totalNilaiRab: newTotal,
      biayaPerM2: realData.luasBangunanM2 > 0 ? newTotal / realData.luasBangunanM2 : 0,
    });
  };

  // --- SUB-ITEM CRUD ---
  const handleItemChange = (divId: string, itemId: string, field: keyof RabSubItem, val: any) => {
    const updatedDivs = realData.divisions.map((d) => {
      if (d.id === divId) {
        const newItems = d.items.map((it) => {
          if (it.id === itemId) {
            const updatedIt = { ...it, [field]: val };
            if (field === 'volume' || field === 'hargaSatuan') {
              const v = field === 'volume' ? parseFloat(val) || 0 : it.volume;
              const h = field === 'hargaSatuan' ? parseFloat(val) || 0 : it.hargaSatuan;
              updatedIt.jumlah = Math.round(v * h * 100) / 100;
            }
            return updatedIt;
          }
          return it;
        });
        const newSubTotal = newItems.reduce((acc, it) => acc + (it.jumlah || 0), 0);
        return {
          ...d,
          items: newItems,
          subTotal: newSubTotal,
        };
      }
      return d;
    });

    const newTotal = updatedDivs.reduce((sum, d) => sum + d.subTotal, 0);
    const rebalancedDivs = updatedDivs.map((d) => ({
      ...d,
      bobotPersen: newTotal > 0 ? parseFloat(((d.subTotal / newTotal) * 100).toFixed(2)) : 0,
    }));

    onUpdateRealData({
      ...realData,
      divisions: rebalancedDivs,
      totalNilaiRab: newTotal,
      biayaPerM2: realData.luasBangunanM2 > 0 ? newTotal / realData.luasBangunanM2 : 0,
    });
  };

  const handleAddItem = (divId: string) => {
    const newItem: RabSubItem = {
      id: `item-${Date.now()}`,
      kode: '',
      uraian: 'Pekerjaan Baru',
      volume: 1,
      satuan: 'ls',
      hargaSatuan: 100000,
      jumlah: 100000,
      kategoriBiaya: 'BAHAN',
    };

    const updatedDivs = realData.divisions.map((d) => {
      if (d.id === divId) {
        const newItems = [...d.items, newItem];
        const newSub = newItems.reduce((acc, it) => acc + (it.jumlah || 0), 0);
        return { ...d, items: newItems, subTotal: newSub };
      }
      return d;
    });

    const newTotal = updatedDivs.reduce((sum, d) => sum + d.subTotal, 0);
    const rebalancedDivs = updatedDivs.map((d) => ({
      ...d,
      bobotPersen: newTotal > 0 ? parseFloat(((d.subTotal / newTotal) * 100).toFixed(2)) : 0,
    }));

    onUpdateRealData({
      ...realData,
      divisions: rebalancedDivs,
      totalNilaiRab: newTotal,
      biayaPerM2: realData.luasBangunanM2 > 0 ? newTotal / realData.luasBangunanM2 : 0,
    });
  };

  const handleDeleteItem = (divId: string, itemId: string) => {
    if (!confirm('Hapus rincian item pekerjaan ini?')) return;
    const updatedDivs = realData.divisions.map((d) => {
      if (d.id === divId) {
        const newItems = d.items.filter((it) => it.id !== itemId);
        const newSub = newItems.reduce((acc, it) => acc + (it.jumlah || 0), 0);
        return { ...d, items: newItems, subTotal: newSub };
      }
      return d;
    });
    const newTotal = updatedDivs.reduce((sum, d) => sum + d.subTotal, 0);
    const rebalancedDivs = updatedDivs.map((d) => ({
      ...d,
      bobotPersen: newTotal > 0 ? parseFloat(((d.subTotal / newTotal) * 100).toFixed(2)) : 0,
    }));

    onUpdateRealData({
      ...realData,
      divisions: rebalancedDivs,
      totalNilaiRab: newTotal,
      biayaPerM2: realData.luasBangunanM2 > 0 ? newTotal / realData.luasBangunanM2 : 0,
    });
  };

  // --- AHSP CRUD ---
  const handleAddAhsp = () => {
    if (!newAhspForm.kodePekerjaan.trim() || !newAhspForm.namaPekerjaan.trim()) {
      alert('Mohon isi Kode Pekerjaan dan Nama Pekerjaan');
      return;
    }
    const newAhsp: AhspItem = {
      id: `ahsp-${Date.now()}`,
      kodePekerjaan: newAhspForm.kodePekerjaan.trim(),
      namaPekerjaan: newAhspForm.namaPekerjaan.trim(),
      satuan: newAhspForm.satuan.trim() || 'm³',
      totalHargaSatuan: 0,
      komponen: [],
    };

    const updatedAhsp = [...(realData.ahspList || []), newAhsp];
    onUpdateRealData({
      ...realData,
      ahspList: updatedAhsp,
    });

    setNewAhspForm({ kodePekerjaan: '', namaPekerjaan: '', satuan: 'm³' });
    setIsAddingAhsp(false);
  };

  const handleSaveEditAhsp = () => {
    if (!editingAhsp) return;
    const updatedAhsp = (realData.ahspList || []).map((a) => (a.id === editingAhsp.id ? editingAhsp : a));
    onUpdateRealData({
      ...realData,
      ahspList: updatedAhsp,
    });
    setEditingAhsp(null);
  };

  const handleDeleteAhsp = (ahspId: string, kode: string) => {
    if (!confirm(`Hapus Analisa Pekerjaan ${kode}?`)) return;
    const updatedAhsp = (realData.ahspList || []).filter((a) => a.id !== ahspId);
    onUpdateRealData({
      ...realData,
      ahspList: updatedAhsp,
    });
  };

  const handleAddAhspKomponen = (ahspId: string) => {
    const newKomp: AhspKomponen = {
      id: `c-${Date.now()}`,
      kategori: 'BAHAN',
      uraian: 'Bahan/Upah Baru',
      koefisien: 1.0,
      satuan: 'kg',
      hargaSatuan: 10000,
      totalHarga: 10000,
    };

    const updatedAhspList = (realData.ahspList || []).map((a) => {
      if (a.id === ahspId) {
        const newKomps = [...a.komponen, newKomp];
        const newTotal = newKomps.reduce((s, k) => s + (k.totalHarga || 0), 0);
        return { ...a, komponen: newKomps, totalHargaSatuan: newTotal };
      }
      return a;
    });

    onUpdateRealData({
      ...realData,
      ahspList: updatedAhspList,
    });
  };

  const handleAhspKomponenChange = (
    ahspId: string,
    kompId: string,
    field: keyof AhspKomponen,
    val: any
  ) => {
    const updatedAhspList = (realData.ahspList || []).map((a) => {
      if (a.id === ahspId) {
        const newKomps = a.komponen.map((k) => {
          if (k.id === kompId) {
            const updatedK = { ...k, [field]: val };
            if (field === 'koefisien' || field === 'hargaSatuan') {
              const coef = field === 'koefisien' ? parseFloat(val) || 0 : k.koefisien;
              const hg = field === 'hargaSatuan' ? parseFloat(val) || 0 : k.hargaSatuan;
              updatedK.totalHarga = Math.round(coef * hg * 100) / 100;
            }
            return updatedK;
          }
          return k;
        });
        const newTotal = newKomps.reduce((s, k) => s + (k.totalHarga || 0), 0);
        return { ...a, komponen: newKomps, totalHargaSatuan: newTotal };
      }
      return a;
    });

    onUpdateRealData({
      ...realData,
      ahspList: updatedAhspList,
    });
  };

  const handleDeleteAhspKomponen = (ahspId: string, kompId: string) => {
    const updatedAhspList = (realData.ahspList || []).map((a) => {
      if (a.id === ahspId) {
        const newKomps = a.komponen.filter((k) => k.id !== kompId);
        const newTotal = newKomps.reduce((s, k) => s + (k.totalHarga || 0), 0);
        return { ...a, komponen: newKomps, totalHargaSatuan: newTotal };
      }
      return a;
    });

    onUpdateRealData({
      ...realData,
      ahspList: updatedAhspList,
    });
  };

  // Reset to default
  const handleResetToPreset = () => {
    if (confirm('Kembalikan data ke format standar TK NURIADEEN CENDEKIA (Rp 516.851.675,11)?')) {
      onUpdateRealData(defaultRealSchoolData);
    }
  };

  // Apply to all
  const handleExecuteSync = () => {
    onApplyToAllModules(realData);
    setShowSyncSuccess(true);
    setTimeout(() => setShowSyncSuccess(false), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
              Sumber Data Utama (Master Proyek)
            </span>
            <span className="text-xs text-slate-300">Sesuai Dokumen Fisik RAB & AHSP</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight mt-1 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-400" />
            <span>Data Real Sekolah (RAB & AHSP)</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Kelola penuh tahapan (Divisi), rincian item, dan analisa AHSP. Anda dapat <strong>menambah, mengedit, dan menghapus</strong> divisi maupun item pekerjaan kapan saja untuk disinkronkan otomatis ke seluruh dokumen LPJ.
          </p>
        </div>

        {/* Global Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            title="Unduh template Excel resmi untuk pengisian massal Rekap, RAB, dan AHSP"
          >
            <Download className="w-4 h-4 text-emerald-200" />
            <span>Unduh Template Excel</span>
          </button>

          <label className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer">
            <Upload className="w-4 h-4 text-indigo-200" />
            <span>{isParsingExcel ? 'Membaca Excel...' : 'Unggah File Excel'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleExcelUpload}
              disabled={isParsingExcel}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleResetToPreset}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleExecuteSync}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            <FolderSync className="w-4 h-4 text-emerald-200" />
            <span>Sinkronkan ke Seluruh Menu LPJ</span>
          </button>
        </div>
      </div>

      {/* Excel Success Banner */}
      {excelSuccessMsg && (
        <div className="bg-indigo-50 border border-indigo-300 text-indigo-900 px-5 py-3.5 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
            <p className="text-xs font-bold">{excelSuccessMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => setExcelSuccessMsg(null)}
            className="text-xs text-indigo-800 font-semibold underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Imported Excel Confirmation Modal */}
      {importedExcelResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Konfirmasi Impor Data Excel
                  </h3>
                  <p className="text-xs text-slate-500">
                    File Excel berhasil dibaca. Silakan periksa ringkasan data di bawah.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportedExcelResult(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Extracted Summary */}
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 block text-xs border-b border-slate-200 pb-1">
                  Ringkasan Ekstraksi Excel:
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Nama Sekolah:</span>
                    <strong className="text-slate-900">{importedExcelResult.data.namaSekolah || realData.namaSekolah}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Tahun Anggaran:</span>
                    <strong className="text-slate-900">{importedExcelResult.data.tahunAnggaran || realData.tahunAnggaran}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Jumlah Divisi RAB:</span>
                    <strong className="text-indigo-600 text-sm">{importedExcelResult.summary.divisionsCount} Divisi</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Jumlah Item Pekerjaan:</span>
                    <strong className="text-indigo-600 text-sm">{importedExcelResult.summary.rabItemsCount} Item</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[11px]">Jumlah Analisa AHSP:</span>
                    <strong className="text-purple-600 text-sm">{importedExcelResult.summary.ahspCount} Pekerjaan AHSP</strong>
                  </div>
                  {importedExcelResult.data.totalNilaiRab !== undefined && (
                    <div className="col-span-2 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 mt-1">
                      <span className="text-emerald-800 font-medium block text-[11px]">Total Nilai RAB Excel:</span>
                      <strong className="text-emerald-900 text-base font-mono font-bold">
                        {formatRupiah(importedExcelResult.data.totalNilaiRab)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Import Mode selection */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 block">Pilih Metode Impor:</span>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition">
                    <input
                      type="radio"
                      name="importMode"
                      value="REPLACE"
                      checked={excelImportMode === 'REPLACE'}
                      onChange={() => setExcelImportMode('REPLACE')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <strong className="text-xs text-slate-900 block">Ganti Seluruh Data (Replace)</strong>
                      <p className="text-[11px] text-slate-500">
                        Menimpa dan mengganti seluruh Divisi RAB & AHSP dengan isi file Excel baru secara lengkap.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition">
                    <input
                      type="radio"
                      name="importMode"
                      value="MERGE"
                      checked={excelImportMode === 'MERGE'}
                      onChange={() => setExcelImportMode('MERGE')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <strong className="text-xs text-slate-900 block">Gabungkan Data (Merge)</strong>
                      <p className="text-[11px] text-slate-500">
                        Memperbarui divisi/item yang kodenya sama dan menambahkan divisi/AHSP baru tanpa menghapus data lain.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setImportedExcelResult(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyImportedExcel}
                className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>Terapkan Data Excel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Success Alert */}
      {showSyncSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-5 py-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Sinkronisasi Berhasil Diterapkan ke Seluruh Menu!</h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                Nilai RAB (<strong>{formatRupiah(currentTotalRab)}</strong>), {realData.divisions.length} Divisi Pekerjaan, serta Analisa AHSP telah diperbarui ke RPD, Bobot Laporan Mingguan, Kwitansi Bahan, Daftar Upah, dan Buku Kas (BKU/BKT/BKB).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSyncSuccess(false)}
            className="text-xs font-semibold text-emerald-800 underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-1.5 flex gap-1 overflow-x-auto justify-between items-center">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('rekap')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'rekap'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>1. Rekapitulasi Biaya ({realData.divisions.length} Divisi)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('rab')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'rab'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>2. Rincian RAB Lengkap</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('ahsp')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'ahsp'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>3. Analisa Harga Satuan (AHSP)</span>
          </button>
        </div>

        {/* Global Add Division Button */}
        {(activeSubTab === 'rekap' || activeSubTab === 'rab') && (
          <button
            type="button"
            onClick={() => setIsAddingDivision(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Divisi Pekerjaan</span>
          </button>
        )}

        {activeSubTab === 'ahsp' && (
          <button
            type="button"
            onClick={() => setIsAddingAhsp(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah AHSP Pekerjaan</span>
          </button>
        )}
      </div>

      {/* Modal Add Division */}
      {isAddingDivision && (
        <div className="bg-blue-50 border border-blue-300 p-4 rounded-xl space-y-3 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-sm text-blue-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Tambah Divisi / Tahapan Pekerjaan Baru</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsAddingDivision(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kode Divisi (misal: XIII)</label>
              <input
                type="text"
                placeholder="XIII"
                value={newDivForm.kode}
                onChange={(e) => setNewDivForm({ ...newDivForm, kode: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Uraian Pekerjaan Divisi</label>
              <input
                type="text"
                placeholder="PEKERJAAN OUTDOOR & TAMAN Halaman"
                value={newDivForm.uraian}
                onChange={(e) => setNewDivForm({ ...newDivForm, uraian: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold uppercase"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingDivision(false)}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleAddDivision}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold"
            >
              Simpan Divisi Baru
            </button>
          </div>
        </div>
      )}

      {/* Modal Edit Division */}
      {editingDivision && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl space-y-3 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-sm text-amber-900 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-amber-600" />
              <span>Edit Nama Divisi / Tahapan Pekerjaan</span>
            </h4>
            <button
              type="button"
              onClick={() => setEditingDivision(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kode Divisi</label>
              <input
                type="text"
                value={editingDivision.kode}
                onChange={(e) => setEditingDivision({ ...editingDivision, kode: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Uraian Pekerjaan Divisi</label>
              <input
                type="text"
                value={editingDivision.uraian}
                onChange={(e) => setEditingDivision({ ...editingDivision, uraian: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold uppercase"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditingDivision(null)}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveEditDivision}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold"
            >
              Simpan Perubahan
            </button>
          </div>
        </div>
      )}

      {/* Modal Add AHSP Pekerjaan */}
      {isAddingAhsp && (
        <div className="bg-purple-50 border border-purple-300 p-4 rounded-xl space-y-3 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-sm text-purple-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-purple-600" />
              <span>Tambah Analisa AHSP Pekerjaan Baru</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsAddingAhsp(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kode Pekerjaan</label>
              <input
                type="text"
                placeholder="XIII.1"
                value={newAhspForm.kodePekerjaan}
                onChange={(e) => setNewAhspForm({ ...newAhspForm, kodePekerjaan: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pekerjaan</label>
              <input
                type="text"
                placeholder="1 m³ Pekerjaan Taman & Rumput"
                value={newAhspForm.namaPekerjaan}
                onChange={(e) => setNewAhspForm({ ...newAhspForm, namaPekerjaan: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Satuan AHSP</label>
              <input
                type="text"
                placeholder="m³ / m²"
                value={newAhspForm.satuan}
                onChange={(e) => setNewAhspForm({ ...newAhspForm, satuan: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-center"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingAhsp(false)}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleAddAhsp}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold"
            >
              Simpan AHSP Baru
            </button>
          </div>
        </div>
      )}

      {/* Modal Edit AHSP Pekerjaan */}
      {editingAhsp && (
        <div className="bg-purple-50 border border-purple-300 p-4 rounded-xl space-y-3 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-sm text-purple-900 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-purple-600" />
              <span>Edit Head Analisa AHSP Pekerjaan</span>
            </h4>
            <button
              type="button"
              onClick={() => setEditingAhsp(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kode Pekerjaan</label>
              <input
                type="text"
                value={editingAhsp.kodePekerjaan}
                onChange={(e) => setEditingAhsp({ ...editingAhsp, kodePekerjaan: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pekerjaan</label>
              <input
                type="text"
                value={editingAhsp.namaPekerjaan}
                onChange={(e) => setEditingAhsp({ ...editingAhsp, namaPekerjaan: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Satuan AHSP</label>
              <input
                type="text"
                value={editingAhsp.satuan}
                onChange={(e) => setEditingAhsp({ ...editingAhsp, satuan: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-center"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditingAhsp(null)}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveEditAhsp}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold"
            >
              Simpan AHSP
            </button>
          </div>
        </div>
      )}

      {/* Sub-tab 1: Rekapitulasi (Matching image.png page 1) */}
      {activeSubTab === 'rekap' && (
        <div className="bg-white rounded-2xl border border-slate-300 shadow-md p-6 space-y-6">
          <div className="text-center border-b pb-4 space-y-1">
            <h3 className="text-lg font-black text-slate-900 tracking-wider">REKAPITULASI BIAYA</h3>
            <p className="text-xs font-bold text-slate-700 uppercase">{realData.satuanPendidikan}</p>
            <p className="text-xs font-bold text-slate-700 uppercase">{realData.kegiatan}</p>
            <p className="text-xs font-extrabold text-blue-700 uppercase">{realData.namaSekolah}</p>
            <p className="text-[11px] text-slate-500 uppercase">{realData.lokasi}</p>
          </div>

          {/* School Header Information Editable Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nama Satuan Sekolah</label>
              <input
                type="text"
                value={realData.namaSekolah}
                onChange={(e) => handleHeaderChange('namaSekolah', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Kegiatan / Ruang</label>
              <input
                type="text"
                value={realData.kegiatan}
                onChange={(e) => handleHeaderChange('kegiatan', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Kabupaten / Kota & Propinsi</label>
              <input
                type="text"
                value={realData.lokasi}
                onChange={(e) => handleHeaderChange('lokasi', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Rekap Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-400 text-xs text-slate-800">
              <thead>
                <tr className="bg-slate-200 font-extrabold text-slate-800 uppercase text-center">
                  <th className="border border-slate-400 py-2.5 px-3 w-16">NO.</th>
                  <th className="border border-slate-400 py-2.5 px-4 text-left">URAIAN PEKERJAAN (DIVISI / TAHAPAN)</th>
                  <th className="border border-slate-400 py-2.5 px-4 text-right w-48">JUMLAH HARGA (RP)</th>
                  <th className="border border-slate-400 py-2.5 px-3 text-center w-24">BOBOT (%)</th>
                  <th className="border border-slate-400 py-2.5 px-3 text-center w-20">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {realData.divisions.map((div, divIdx) => (
                  <tr key={div.id} className="hover:bg-blue-50/50">
                    <td className="border border-slate-300 py-2 px-3 text-center font-extrabold text-blue-900 bg-slate-50 font-mono">
                      {toRoman(divIdx + 1)}
                    </td>
                    <td className="border border-slate-300 py-2 px-4 font-semibold text-slate-800">{div.uraian}</td>
                    <td className="border border-slate-300 py-2 px-4 text-right font-mono font-medium">
                      {formatRupiah(div.subTotal)}
                    </td>
                    <td className="border border-slate-300 py-2 px-3 text-center font-mono font-bold text-blue-700">
                      {div.bobotPersen.toFixed(2)}%
                    </td>
                    <td className="border border-slate-300 py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingDivision(div)}
                          className="p-1 text-slate-500 hover:text-amber-600 rounded transition"
                          title="Edit nama divisi ini"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDivision(div.id, div.kode)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Hapus divisi ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-500">
                  <td colSpan={2} className="border border-slate-400 py-3 px-4 text-right tracking-wider uppercase">
                    SUB TOTAL RINCIAN PEKERJAAN
                  </td>
                  <td className="border border-slate-400 py-3 px-4 text-right font-mono text-sm text-blue-900">
                    {formatRupiah(currentTotalRab)}
                  </td>
                  <td className="border border-slate-400 py-3 px-3 text-center font-mono text-sm text-blue-900">
                    100.00%
                  </td>
                  <td className="border border-slate-400"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes Bottom Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-300 text-xs">
            <div className="flex items-center justify-between border-b sm:border-b-0 sm:border-r border-slate-300 pb-2 sm:pb-0 sm:pr-4">
              <span className="font-bold text-slate-700 uppercase">LUAS BANGUNAN :</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={realData.luasBangunanM2}
                  onChange={(e) => handleHeaderChange('luasBangunanM2', e.target.value)}
                  className="w-20 bg-white border border-slate-300 rounded px-2 py-1 font-bold text-right text-slate-800"
                />
                <span className="font-bold text-slate-600">M²</span>
              </div>
            </div>

            <div className="flex items-center justify-between sm:pl-4">
              <span className="font-bold text-slate-700 uppercase">BIAYA PERSATUAN LUAS/M2 :</span>
              <span className="font-mono font-extrabold text-blue-800 text-sm">
                {formatRupiah(biayaPerM2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Rincian RAB Lengkap (Divisi I s/d XII) */}
      {activeSubTab === 'rab' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">RAB RINCIAN ITEM PER DIVISI / TAHAPAN</h3>
              <p className="text-xs text-slate-500">
                Ubah volume, harga satuan, kategori, atau tambah/hapus divisi dan item pekerjaan secara bebas.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Total Proyek:</span>
                <span className="font-mono font-bold text-blue-700 text-sm">
                  {formatRupiah(currentTotalRab)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingDivision(true)}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Divisi Baru</span>
              </button>
            </div>
          </div>

          {realData.divisions.map((div, divIdx) => {
            const isExpanded = !!expandedDivisions[div.id];
            return (
              <div key={div.id} className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
                {/* Division Header */}
                <div
                  onClick={() => toggleDivision(div.id)}
                  className="bg-slate-100 hover:bg-slate-200/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 cursor-pointer select-none transition"
                >
                  <div className="flex items-center gap-2.5">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    )}
                    <span className="font-black text-xs text-blue-900 bg-blue-100 px-2 py-0.5 rounded font-mono shadow-xs">
                      {toRoman(divIdx + 1)}
                    </span>
                    <span className="font-bold text-xs text-slate-900 uppercase tracking-tight">{div.uraian}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500 font-mono text-[11px]">
                      Bobot: <strong className="text-blue-700">{div.bobotPersen.toFixed(2)}%</strong>
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {formatRupiah(div.subTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingDivision(div);
                      }}
                      className="p-1 text-slate-500 hover:text-amber-600 rounded"
                      title="Edit Nama Divisi"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDivision(div.id, div.kode);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="Hapus Divisi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddItem(div.id);
                      }}
                      className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[11px] font-semibold transition ml-2"
                      title="Tambah rincian item pekerjaan ke divisi ini"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Item</span>
                    </button>
                  </div>
                </div>

                {/* Division Items Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs text-slate-800">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-center text-[11px]">
                          <th className="py-2 px-2 w-10 border-r border-slate-200">NO</th>
                          <th className="py-2 px-3 text-left border-r border-slate-200">URAIAN PEKERJAAN</th>
                          <th className="py-2 px-2 w-24 border-r border-slate-200">KATEGORI</th>
                          <th className="py-2 px-2 w-20 border-r border-slate-200">VOLUME</th>
                          <th className="py-2 px-2 w-16 border-r border-slate-200">SATUAN</th>
                          <th className="py-2 px-3 w-32 border-r border-slate-200 text-right">HARGA (RP)</th>
                          <th className="py-2 px-3 w-36 border-r border-slate-200 text-right">JUMLAH (RP)</th>
                          <th className="py-2 px-2 w-12 text-center">AKSI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {div.items.map((it, idx) => (
                          <tr key={it.id} className="hover:bg-slate-50/80">
                            <td className="py-2 px-2 text-center text-slate-500 font-mono text-[11px] border-r border-slate-200">
                              {it.kode || idx + 1}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200">
                              <input
                                type="text"
                                value={it.uraian}
                                onChange={(e) => handleItemChange(div.id, it.id, 'uraian', e.target.value)}
                                className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-blue-400 rounded px-1.5 py-0.5 font-medium text-slate-800"
                              />
                            </td>
                            <td className="py-2 px-2 border-r border-slate-200 text-center">
                              <select
                                value={it.kategoriBiaya || 'BAHAN'}
                                onChange={(e) => handleItemChange(div.id, it.id, 'kategoriBiaya', e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-bold text-slate-700"
                              >
                                <option value="BAHAN">BAHAN</option>
                                <option value="UPAH">UPAH</option>
                                <option value="ALAT">ALAT</option>
                                <option value="SMKK">SMKK</option>
                                <option value="LAINNYA">LAINNYA</option>
                              </select>
                            </td>
                            <td className="py-2 px-2 border-r border-slate-200 text-right">
                              <input
                                type="number"
                                step="any"
                                value={it.volume}
                                onChange={(e) => handleItemChange(div.id, it.id, 'volume', e.target.value)}
                                className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-blue-400 rounded px-1.5 py-0.5 text-right font-mono"
                              />
                            </td>
                            <td className="py-2 px-2 border-r border-slate-200 text-center">
                              <input
                                type="text"
                                value={it.satuan}
                                onChange={(e) => handleItemChange(div.id, it.id, 'satuan', e.target.value)}
                                className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-blue-400 rounded px-1.5 py-0.5 text-center font-mono text-slate-600"
                              />
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 text-right">
                              <input
                                type="number"
                                step="any"
                                value={it.hargaSatuan}
                                onChange={(e) => handleItemChange(div.id, it.id, 'hargaSatuan', e.target.value)}
                                className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-blue-400 rounded px-1.5 py-0.5 text-right font-mono"
                              />
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-semibold text-slate-900">
                              {formatRupiah(it.jumlah)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(div.id, it.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition rounded"
                                title="Hapus baris item ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300">
                          <td colSpan={6} className="py-2 px-4 text-right uppercase tracking-wider text-[11px]">
                            Sub Total {div.kode} ({div.uraian}) :
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-blue-900">
                            {formatRupiah(div.subTotal)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-tab 3: Analisa Harga Satuan Pekerjaan (AHSP) */}
      {activeSubTab === 'ahsp' && (
        <div className="bg-white rounded-2xl border border-slate-300 shadow-md p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase">
                ANALISA HARGA SATUAN PEKERJAAN (AHSP)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Rincian koefisien bahan dan upah per satuan pekerjaan. Tambah, edit, atau hapus item & komponen pendukung.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Reset seluruh Analisa AHSP ke data standar resmi sesuai AHSP.pdf?')) {
                    onUpdateRealData({
                      ...realData,
                      ahspList: defaultRealSchoolData.ahspList,
                    });
                  }
                }}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
                title="Muat Ulang Data Standar AHSP.pdf"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                <span>Reset Data AHSP.pdf</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextRoman = toRoman((realData.ahspList || []).length + 1);
                  setNewAhspForm({
                    kodePekerjaan: `AHSP-${nextRoman}`,
                    namaPekerjaan: '',
                    satuan: 'm³',
                  });
                  setIsAddingAhsp(true);
                }}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ AHSP Pekerjaan Baru</span>
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {(realData.ahspList || []).map((ahsp, ahspIdx) => {
              const romanNo = toRoman(ahspIdx + 1);
              return (
                <div key={ahsp.id} className="border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                  {/* AHSP Card Header */}
                  <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 bg-purple-700 text-white rounded font-black text-xs shadow-xs font-mono">
                        {romanNo}
                      </span>
                      <div>
                        <span className="text-[10px] font-mono font-bold text-purple-700 block uppercase leading-none mb-0.5">
                          AHSP {romanNo} ({ahsp.kodePekerjaan})
                        </span>
                        <h4 className="font-bold text-xs text-slate-900">{ahsp.namaPekerjaan}</h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="font-mono text-xs font-extrabold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
                        Total: {formatRupiah(ahsp.totalHargaSatuan)} / {ahsp.satuan}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingAhsp(ahsp)}
                        className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded text-xs font-bold transition cursor-pointer"
                        title="Edit Head AHSP"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAhsp(ahsp.id, ahsp.namaPekerjaan || ahsp.kodePekerjaan)}
                        className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer"
                        title="Hapus Analisa AHSP Pekerjaan ini"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Hapus AHSP</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddAhspKomponen(ahsp.id)}
                        className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Komponen</span>
                      </button>
                    </div>
                  </div>

                {/* AHSP Components Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-slate-700 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold border-b border-slate-200 text-center">
                        <th className="py-1.5 px-3 w-20 border-r border-slate-200">KATEGORI</th>
                        <th className="py-1.5 px-3 text-left border-r border-slate-200">URAIAN KOMPONEN</th>
                        <th className="py-1.5 px-2 w-24 border-r border-slate-200">KOEFISIEN</th>
                        <th className="py-1.5 px-2 w-20 border-r border-slate-200">SATUAN</th>
                        <th className="py-1.5 px-3 w-32 border-r border-slate-200 text-right">HARGA SATUAN (RP)</th>
                        <th className="py-1.5 px-3 w-36 border-r border-slate-200 text-right">TOTAL (RP)</th>
                        <th className="py-1.5 px-2 w-12 text-center">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ahsp.komponen.map((komp) => (
                        <tr key={komp.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2 text-center border-r border-slate-100">
                            <select
                              value={komp.kategori}
                              onChange={(e) =>
                                handleAhspKomponenChange(ahsp.id, komp.id, 'kategori', e.target.value)
                              }
                              className="bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px] font-bold text-slate-700"
                            >
                              <option value="BAHAN">BAHAN</option>
                              <option value="UPAH">UPAH</option>
                              <option value="ALAT">ALAT</option>
                            </select>
                          </td>
                          <td className="py-1.5 px-3 border-r border-slate-100">
                            <input
                              type="text"
                              value={komp.uraian}
                              onChange={(e) =>
                                handleAhspKomponenChange(ahsp.id, komp.id, 'uraian', e.target.value)
                              }
                              className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-purple-400 rounded px-1 py-0.5 font-medium text-slate-800"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center border-r border-slate-100">
                            <input
                              type="number"
                              step="any"
                              value={komp.koefisien}
                              onChange={(e) =>
                                handleAhspKomponenChange(ahsp.id, komp.id, 'koefisien', e.target.value)
                              }
                              className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-purple-400 rounded px-1 py-0.5 text-center font-mono"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center border-r border-slate-100">
                            <input
                              type="text"
                              value={komp.satuan}
                              onChange={(e) =>
                                handleAhspKomponenChange(ahsp.id, komp.id, 'satuan', e.target.value)
                              }
                              className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-purple-400 rounded px-1 py-0.5 text-center text-slate-500 font-mono"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right border-r border-slate-100">
                            <input
                              type="number"
                              step="any"
                              value={komp.hargaSatuan}
                              onChange={(e) =>
                                handleAhspKomponenChange(ahsp.id, komp.id, 'hargaSatuan', e.target.value)
                              }
                              className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-purple-400 rounded px-1 py-0.5 text-right font-mono"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-900 border-r border-slate-100">
                            {formatRupiah(komp.totalHarga)}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteAhspKomponen(ahsp.id, komp.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition rounded"
                              title="Hapus komponen ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
    </div>
  );
};
