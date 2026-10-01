import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileText,
  ShoppingCart,
  UserCheck,
  Edit3,
  Check,
  Plus,
  Trash2,
  Store,
  Layers,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Link,
  ArrowRight,
  Info,
} from 'lucide-react';
import { RabSubItem, RabDivision, RealSchoolData, AhspItem, AhspKomponen, SchoolMasterData, StoreVendor } from '../types';
import { formatRupiah, formatNumber } from '../utils/formatters';
import { terbilangRupiah } from '../utils/terbilang';

interface RabAhspDocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  rabItem: RabSubItem | null;
  division: RabDivision | null;
  realData: RealSchoolData;
  school?: SchoolMasterData;
  stores?: StoreVendor[];
  onUpdateRabItem?: (divId: string, itemId: string, updatedFields: Partial<RabSubItem>) => void;
  onUpdateAhsp?: (updatedAhsp: AhspItem) => void;
}

export const RabAhspDocumentPreviewModal: React.FC<RabAhspDocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  rabItem,
  division,
  realData,
  school,
  stores = [],
  onUpdateRabItem,
  onUpdateAhsp,
}) => {
  const [activeTab, setActiveTab] = useState<'AHSP' | 'BON_SPB' | 'UPAH' | 'EDIT'>('AHSP');
  const [selectedAhspId, setSelectedAhspId] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editableComponents, setEditableComponents] = useState<AhspKomponen[]>([]);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Find automatic match if no specific ahspIdRef
  const matchedAhsp = useMemo(() => {
    if (!rabItem) return null;
    const list = realData.ahspList || [];
    if (selectedAhspId) {
      return list.find((a) => a.id === selectedAhspId) || null;
    }
    if (rabItem.ahspIdRef) {
      const explicit = list.find((a) => a.id === rabItem.ahspIdRef);
      if (explicit) return explicit;
    }

    const lowerRab = rabItem.uraian.toLowerCase().trim();
    // 1. Direct contains match
    const directMatch = list.find((a) => {
      const lowerAh = (a.namaPekerjaan || '').toLowerCase().trim();
      return lowerAh === lowerRab || lowerAh.includes(lowerRab) || lowerRab.includes(lowerAh);
    });
    if (directMatch) return directMatch;

    // 2. Keyword heuristic match
    const keywords = lowerRab
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !/pekerjaan|pasang|pemasangan|pengadaan/i.test(w));

    if (keywords.length > 0) {
      const keywordMatch = list.find((a) => {
        const lowerAh = (a.namaPekerjaan || '').toLowerCase();
        return keywords.some((kw) => lowerAh.includes(kw));
      });
      if (keywordMatch) return keywordMatch;
    }

    return null;
  }, [rabItem, selectedAhspId, realData.ahspList]);

  // Sync state whenever modal opens or rabItem changes
  useEffect(() => {
    if (!isOpen || !rabItem) return;
    if (rabItem.ahspIdRef) {
      setSelectedAhspId(rabItem.ahspIdRef);
    } else {
      setSelectedAhspId('');
    }
    setActiveTab('AHSP');
    setIsEditing(false);
    setSaveSuccessNotice(false);
  }, [isOpen, rabItem]);

  // Sync editable components with matched AHSP
  useEffect(() => {
    if (matchedAhsp && matchedAhsp.komponen) {
      setEditableComponents(matchedAhsp.komponen.map((k) => ({ ...k })));
    } else {
      // Fallback synthetic components if no AHSP is bound
      if (rabItem) {
        const isUpahBahan = rabItem.kategoriBiaya === 'UPAH_BAHAN';
        const isUpahOnly = rabItem.kategoriBiaya === 'UPAH';
        if (isUpahOnly) {
          setEditableComponents([
            {
              id: 'comp-syn-upah',
              kategori: 'UPAH',
              uraian: `Upah Tukang & Pekerja (${rabItem.uraian})`,
              koefisien: 1,
              satuan: rabItem.satuan || 'ls',
              hargaSatuan: rabItem.hargaSatuan,
              totalHarga: rabItem.hargaSatuan,
            },
          ]);
        } else if (isUpahBahan) {
          setEditableComponents([
            {
              id: 'comp-syn-mat',
              kategori: 'BAHAN',
              uraian: `Material & Bahan (${rabItem.uraian})`,
              koefisien: 1,
              satuan: rabItem.satuan || 'ls',
              hargaSatuan: Math.round(rabItem.hargaSatuan * 0.65),
              totalHarga: Math.round(rabItem.hargaSatuan * 0.65),
            },
            {
              id: 'comp-syn-upah',
              kategori: 'UPAH',
              uraian: `Upah Tenaga Kerja (${rabItem.uraian})`,
              koefisien: 1,
              satuan: rabItem.satuan || 'ls',
              hargaSatuan: Math.round(rabItem.hargaSatuan * 0.35),
              totalHarga: Math.round(rabItem.hargaSatuan * 0.35),
            },
          ]);
        } else {
          setEditableComponents([
            {
              id: 'comp-syn-mat',
              kategori: 'BAHAN',
              uraian: rabItem.uraian,
              koefisien: 1,
              satuan: rabItem.satuan || 'unit',
              hargaSatuan: rabItem.hargaSatuan,
              totalHarga: rabItem.hargaSatuan,
            },
          ]);
        }
      }
    }
  }, [matchedAhsp, rabItem]);

  if (!isOpen || !rabItem || !division) return null;

  const rabVolume = rabItem.volume || 1;
  const currentKomponen = editableComponents;

  // Breakdown Calculations
  const bahanItems = currentKomponen.filter(
    (k) => k.kategori === 'BAHAN' || (!/tukang|pekerja|mandor/i.test(k.uraian) && !/alat|sewa/i.test(k.uraian))
  );
  const upahItems = currentKomponen.filter(
    (k) => k.kategori === 'UPAH' || /tukang|pekerja|mandor/i.test(k.uraian)
  );
  const alatItems = currentKomponen.filter((k) => k.kategori === 'ALAT');

  const totalBahanSatuan = bahanItems.reduce((sum, it) => sum + (it.totalHarga || (it.koefisien * it.hargaSatuan)), 0);
  const totalUpahSatuan = upahItems.reduce((sum, it) => sum + (it.totalHarga || (it.koefisien * it.hargaSatuan)), 0);
  const totalAlatSatuan = alatItems.reduce((sum, it) => sum + (it.totalHarga || (it.koefisien * it.hargaSatuan)), 0);

  const totalBahanProyek = Math.round(totalBahanSatuan * rabVolume);
  const totalUpahProyek = Math.round(totalUpahSatuan * rabVolume);
  const totalAlatProyek = Math.round(totalAlatSatuan * rabVolume);

  // Link selected AHSP explicitly to this item
  const handleSaveAhspBinding = (newAhspId: string) => {
    setSelectedAhspId(newAhspId);
    if (onUpdateRabItem) {
      onUpdateRabItem(division.id, rabItem.id, { ahspIdRef: newAhspId || undefined });
    }
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2000);
  };

  // Component manipulation in Edit Mode
  const handleComponentChange = (index: number, field: keyof AhspKomponen, value: any) => {
    const updated = [...editableComponents];
    const item = { ...updated[index], [field]: value };
    if (field === 'koefisien' || field === 'hargaSatuan') {
      const koef = parseFloat(item.koefisien as any) || 0;
      const hrg = parseFloat(item.hargaSatuan as any) || 0;
      item.totalHarga = Math.round(koef * hrg);
    }
    updated[index] = item;
    setEditableComponents(updated);
  };

  const handleAddComponent = (kategori: 'BAHAN' | 'UPAH' | 'ALAT') => {
    setEditableComponents([
      ...editableComponents,
      {
        id: `comp-${Date.now()}`,
        kategori,
        uraian: kategori === 'BAHAN' ? 'Bahan Material Tambahan' : 'Tukang Tambahan',
        koefisien: 1,
        satuan: kategori === 'BAHAN' ? 'unit' : 'Hr',
        hargaSatuan: kategori === 'BAHAN' ? 50000 : 180000,
        totalHarga: kategori === 'BAHAN' ? 50000 : 180000,
      },
    ]);
  };

  const handleRemoveComponent = (index: number) => {
    setEditableComponents(editableComponents.filter((_, i) => i !== index));
  };

  const handleSaveEditedAhsp = (e: React.FormEvent) => {
    e.preventDefault();
    if (matchedAhsp && onUpdateAhsp) {
      const newTotalSatuan = editableComponents.reduce((acc, it) => acc + (it.totalHarga || 0), 0);
      const updatedAhsp: AhspItem = {
        ...matchedAhsp,
        totalHargaSatuan: newTotalSatuan,
        komponen: editableComponents,
      };
      onUpdateAhsp(updatedAhsp);
    }
    setSaveSuccessNotice(true);
    setTimeout(() => {
      setSaveSuccessNotice(false);
      setIsEditing(false);
      setActiveTab('AHSP');
    }, 1200);
  };

  const defaultStoreName = stores && stores.length > 0 ? stores[0].namaToko : 'TB. REKANAN MATERIAL UTAMA';
  const defaultStoreAddress = stores && stores.length > 0 ? stores[0].alamat : school?.kabKota || 'Kabupaten/Kota';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-blue-600 shadow-xs shrink-0">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-blue-900/80 text-blue-200 border border-blue-700">
                  {division.kode} • {division.uraian}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  rabItem.kategoriBiaya === 'UPAH_BAHAN'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : rabItem.kategoriBiaya === 'UPAH'
                    ? 'bg-purple-100 text-purple-900 border border-purple-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}>
                  {rabItem.kategoriBiaya || 'BAHAN'}
                </span>
              </div>
              <h3 className="font-bold text-sm truncate text-white mt-0.5" title={rabItem.uraian}>
                {rabItem.uraian}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer ${
                isEditing
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Batal Edit' : 'Edit Koefisien / Komponen'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Notice Notification */}
        {saveSuccessNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-center gap-2 text-emerald-800 text-xs font-bold animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Perubahan data AHSP berhasil disimpan dan disinkronkan ke dokumen LPJ!</span>
          </div>
        )}

        {/* AHSP Mapping & Selector Bar */}
        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 shrink-0">
              <Link className="w-3.5 h-3.5 text-blue-600" />
              <span>Sumber Data AHSP:</span>
            </div>
            <select
              value={matchedAhsp ? matchedAhsp.id : ''}
              onChange={(e) => handleSaveAhspBinding(e.target.value)}
              className="flex-1 max-w-md px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 truncate"
            >
              <option value="">-- [Item Langsung / Tanpa Rumus AHSP] --</option>
              {(realData.ahspList || []).map((ah) => (
                <option key={ah.id} value={ah.id}>
                  {ah.kodePekerjaan} - {ah.namaPekerjaan} ({ah.satuan}) [{ah.komponen?.length || 0} komponen]
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            <div className="bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
              <span className="text-[10px] text-blue-700 block">Volume RAB Proyek:</span>
              <span className="font-mono font-bold text-blue-900">
                {rabVolume} {rabItem.satuan}
              </span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              <span className="text-[10px] text-emerald-700 block">Total Anggaran Item:</span>
              <span className="font-mono font-bold text-emerald-900">
                {formatRupiah(rabItem.jumlah || rabVolume * rabItem.hargaSatuan)}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        {!isEditing && (
          <div className="bg-white px-4 py-2 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('AHSP')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'AHSP'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>1. Analisis AHSP & Ekstraksi ({currentKomponen.length} Komponen)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('BON_SPB')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'BON_SPB'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>2. Tercetak di Bon Toko & SPB ({bahanItems.length} Bahan)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('UPAH')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'UPAH'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>3. Tercetak di Kwitansi Upah ({upahItems.length} Tenaga)</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {isEditing ? (
            /* ================= MODE EDIT AHSP KOMPONEN ================= */
            <form onSubmit={handleSaveEditedAhsp} className="space-y-4 max-w-3xl mx-auto">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                <Edit3 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Edit Koefisien & Harga Satuan AHSP</p>
                  <p className="text-[11px] text-amber-800">
                    Perubahan koefisien atau harga di sini akan otomatis memperbarui perhitungan kebutuhan belanja material di bon toko dan kwitansi upah.
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>Daftar Komponen ({editableComponents.length} Rincian)</span>
                  </h4>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddComponent('BAHAN')}
                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold cursor-pointer"
                    >
                      + Tambah Bahan
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddComponent('UPAH')}
                      className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded text-[11px] font-bold cursor-pointer"
                    >
                      + Tambah Upah
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-10 text-center">No</th>
                        <th className="p-2 w-20 text-center">Kategori</th>
                        <th className="p-2">Uraian Komponen / Barang</th>
                        <th className="p-2 w-20 text-center">Koefisien</th>
                        <th className="p-2 w-16 text-center">Satuan</th>
                        <th className="p-2 w-28 text-right">Harga Satuan (Rp)</th>
                        <th className="p-2 w-28 text-right">Subtotal (Rp)</th>
                        <th className="p-2 w-10 text-center" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editableComponents.map((comp, idx) => (
                        <tr key={comp.id || idx} className="hover:bg-slate-50">
                          <td className="p-2 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-1.5">
                            <select
                              value={comp.kategori}
                              onChange={(e) => handleComponentChange(idx, 'kategori', e.target.value)}
                              className="w-full text-[10px] font-bold p-1 border rounded"
                            >
                              <option value="BAHAN">BAHAN</option>
                              <option value="UPAH">UPAH</option>
                              <option value="ALAT">ALAT</option>
                            </select>
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              required
                              value={comp.uraian}
                              onChange={(e) => handleComponentChange(idx, 'uraian', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              step="any"
                              required
                              value={comp.koefisien}
                              onChange={(e) => handleComponentChange(idx, 'koefisien', e.target.value)}
                              className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded font-mono"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={comp.satuan}
                              onChange={(e) => handleComponentChange(idx, 'satuan', e.target.value)}
                              className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded font-mono"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              required
                              value={comp.hargaSatuan}
                              onChange={(e) => handleComponentChange(idx, 'hargaSatuan', e.target.value)}
                              className="w-full px-2 py-1 text-xs text-right border border-slate-200 rounded font-mono"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            {formatRupiah(comp.totalHarga || (comp.koefisien * comp.hargaSatuan), false)}
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
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

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan AHSP</span>
                </button>
              </div>
            </form>
          ) : (
            /* ================= MODE PREVIEW ================= */
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* TAB 1: ANALISIS AHSP & EKSTRAKSI VOLUME */}
              {activeTab === 'AHSP' && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                        Porsi Bahan (Material)
                      </span>
                      <p className="text-base font-extrabold text-emerald-950 font-mono mt-0.5">
                        {formatRupiah(totalBahanProyek)}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        {bahanItems.length} item barang ke Bon Toko & SPB
                      </span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                        Porsi Upah (Tenaga Kerja)
                      </span>
                      <p className="text-base font-extrabold text-purple-950 font-mono mt-0.5">
                        {formatRupiah(totalUpahProyek)}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        {upahItems.length} peran tenaga ke Kwitansi Upah
                      </span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                        Total Nilai AHSP × Volume
                      </span>
                      <p className="text-base font-extrabold text-blue-950 font-mono mt-0.5">
                        {formatRupiah(totalBahanProyek + totalUpahProyek + totalAlatProyek)}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        Total kebutuhan riil pekerjaan
                      </span>
                    </div>
                  </div>

                  {/* Table: Bahan Components */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-100 flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
                        <span>A. Komponen Bahan (Material) $\rightarrow$ Tercetak di Bon Toko & SPB</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-900">
                        Subtotal: {formatRupiah(totalBahanProyek)}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-2 w-10 text-center">No</th>
                            <th className="p-2">Nama Barang / Material</th>
                            <th className="p-2 w-24 text-center">Koefisien Satuan</th>
                            <th className="p-2 w-28 text-center bg-emerald-50/50">Total Vol Proyek</th>
                            <th className="p-2 w-28 text-right">Harga Satuan (Rp)</th>
                            <th className="p-2 w-32 text-right">Jumlah Total (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bahanItems.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                                Tidak ada komponen bahan terpisah untuk pekerjaan ini.
                              </td>
                            </tr>
                          ) : (
                            bahanItems.map((b, idx) => {
                              const totalVol = Math.round((b.koefisien * rabVolume) * 100) / 100;
                              const totalHrg = Math.round(totalVol * b.hargaSatuan);
                              return (
                                <tr key={b.id || idx} className="hover:bg-slate-50">
                                  <td className="p-2 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                                  <td className="p-2 font-medium text-slate-900">{b.uraian}</td>
                                  <td className="p-2 text-center font-mono text-slate-600">
                                    {b.koefisien} {b.satuan}
                                  </td>
                                  <td className="p-2 text-center font-mono font-bold text-emerald-800 bg-emerald-50/30">
                                    {totalVol} {b.satuan}
                                  </td>
                                  <td className="p-2 text-right font-mono text-slate-600">
                                    {formatRupiah(b.hargaSatuan, false)}
                                  </td>
                                  <td className="p-2 text-right font-mono font-bold text-slate-900">
                                    {formatRupiah(totalHrg, false)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table: Upah Components */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 flex items-center justify-between">
                      <span className="font-bold text-xs text-purple-900 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                        <span>B. Komponen Tenaga Kerja (Upah) $\rightarrow$ Tercetak di Kwitansi Upah & Absensi</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-purple-900">
                        Subtotal: {formatRupiah(totalUpahProyek)}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-2 w-10 text-center">No</th>
                            <th className="p-2">Peran Pekerja / Tukang</th>
                            <th className="p-2 w-24 text-center">Koefisien Satuan</th>
                            <th className="p-2 w-28 text-center bg-purple-50/50">Total Kebutuhan (HOK)</th>
                            <th className="p-2 w-28 text-right">Upah Standar (Rp)</th>
                            <th className="p-2 w-32 text-right">Jumlah Total (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {upahItems.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                                Tidak ada komponen upah terpisah untuk pekerjaan ini.
                              </td>
                            </tr>
                          ) : (
                            upahItems.map((u, idx) => {
                              const totalHok = Math.round((u.koefisien * rabVolume) * 100) / 100;
                              const totalUpah = Math.round(totalHok * u.hargaSatuan);
                              return (
                                <tr key={u.id || idx} className="hover:bg-slate-50">
                                  <td className="p-2 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                                  <td className="p-2 font-medium text-slate-900">{u.uraian}</td>
                                  <td className="p-2 text-center font-mono text-slate-600">
                                    {u.koefisien} {u.satuan}
                                  </td>
                                  <td className="p-2 text-center font-mono font-bold text-purple-800 bg-purple-50/30">
                                    {totalHok} HOK
                                  </td>
                                  <td className="p-2 text-right font-mono text-slate-600">
                                    {formatRupiah(u.hargaSatuan, false)}
                                  </td>
                                  <td className="p-2 text-right font-mono font-bold text-slate-900">
                                    {formatRupiah(totalUpah, false)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SIMULASI BON TOKO & SPB */}
              {activeTab === 'BON_SPB' && (
                <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-300 shadow-sm font-sans text-xs space-y-5">
                  <div className="flex justify-between items-start border-b-2 border-black pb-3">
                    <div>
                      <h3 className="font-extrabold text-base uppercase tracking-wider text-slate-900">
                        {defaultStoreName}
                      </h3>
                      <p className="text-[11px] text-slate-600">Penyedia Bahan Bangunan & Alat Konstruksi</p>
                      <p className="text-[11px] text-slate-600">{defaultStoreAddress}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-medium">{school?.kabKota || 'Kota'}, {school?.tahunAnggaran ? `T.A ${school.tahunAnggaran}` : ''}</p>
                      <p className="text-slate-600">Kepada Yth: Ketua P2SP</p>
                      <p className="font-bold text-slate-900">{school?.namaSekolah || realData.namaSekolah}</p>
                      <p className="text-slate-600">Keperluan: {rabItem.uraian}</p>
                    </div>
                  </div>

                  <div className="text-center py-1">
                    <h4 className="font-extrabold text-sm uppercase tracking-widest underline">
                      SIMULASI FAKTUR / BON TOKO & SURAT PESANAN BARANG (SPB)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      (Daftar barang ini yang akan otomatis tercetak pada Faktur & SPB untuk pekerjaan: <strong>{rabItem.uraian}</strong>)
                    </p>
                  </div>

                  <table className="w-full border-collapse border border-black text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-center font-bold">
                        <th className="border border-black p-2 w-10">No</th>
                        <th className="border border-black p-2 w-28">Banyaknya</th>
                        <th className="border border-black p-2 text-left">Nama Barang / Spesifikasi Material</th>
                        <th className="border border-black p-2 text-right w-32">Harga Satuan</th>
                        <th className="border border-black p-2 text-right w-36">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bahanItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="border border-black p-4 text-center text-slate-400 italic">
                            Tidak ada pengeluaran bahan toko terdaftar untuk pekerjaan ini.
                          </td>
                        </tr>
                      ) : (
                        bahanItems.map((b, idx) => {
                          const totalVol = Math.round((b.koefisien * rabVolume) * 100) / 100;
                          const totalHrg = Math.round(totalVol * b.hargaSatuan);
                          return (
                            <tr key={idx}>
                              <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                              <td className="border border-black p-2 text-center font-mono font-bold">
                                {totalVol} {b.satuan}
                              </td>
                              <td className="border border-black p-2 font-medium">{b.uraian}</td>
                              <td className="border border-black p-2 text-right font-mono">
                                {formatRupiah(b.hargaSatuan, false)}
                              </td>
                              <td className="border border-black p-2 text-right font-mono font-bold">
                                {formatRupiah(totalHrg, false)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold bg-slate-50">
                        <td colSpan={4} className="border border-black p-2 text-right uppercase">
                          Total Belanja Bahan Toko :
                        </td>
                        <td className="border border-black p-2 text-right font-mono font-bold text-slate-900 text-sm">
                          {formatRupiah(totalBahanProyek, false)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="flex justify-between items-end pt-4 border-t border-slate-200">
                    <p className="italic text-[11px] text-slate-500">
                      * Data di atas otomatis ditransfer ke Kwitansi Bon & SPB saat laporan mingguan dibuat.
                    </p>
                    <div className="text-center w-52 space-y-0.5">
                      <p>Hormat Kami,</p>
                      <p className="font-bold uppercase">{defaultStoreName}</p>
                      <div className="h-12" />
                      <p className="font-bold underline uppercase">Pemilik Toko</p>
                      <p className="text-[10px] text-slate-500">Cap & Tanda Tangan</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SIMULASI KWITANSI UPAH */}
              {activeTab === 'UPAH' && (
                <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-300 shadow-sm font-sans text-xs space-y-5">
                  <div className="flex justify-between items-start border-b border-black pb-2">
                    <div className="font-mono text-xs space-y-0.5">
                      <p>Tahun Anggaran : <strong>{school?.tahunAnggaran || realData.tahunAnggaran}</strong></p>
                      <p>Kegiatan : <strong>{realData.kegiatan || 'Revitalisasi Satuan Pendidikan'}</strong></p>
                    </div>
                    <div className="text-right">
                      <h2 className="text-lg font-bold tracking-widest uppercase underline font-serif">
                        KWITANSI PEMBAYARAN UPAH
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-3 py-2 text-xs">
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 font-medium">Sudah terima dari</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-8 font-bold text-slate-900">
                        Bendahara {school?.namaSekolah || realData.namaSekolah}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 font-medium">Uang Banyaknya</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-8 font-bold italic underline bg-slate-50 p-2.5 rounded border border-slate-200 text-purple-900 font-serif text-sm">
                        {terbilangRupiah(totalUpahProyek)}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-3 font-medium">Y a i t u</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-8 leading-relaxed font-semibold text-slate-800">
                        Pembayaran Ongkos Tenaga Kerja Pelaksanaan {rabItem.uraian} Volume {rabVolume} {rabItem.satuan}
                      </span>
                    </div>
                  </div>

                  <table className="w-full border-collapse border border-black text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-100 text-center font-bold">
                        <th className="border border-black p-2 w-10">No</th>
                        <th className="border border-black p-2 text-left">Tenaga Kerja / Tukang</th>
                        <th className="border border-black p-2 w-28 text-center">Alokasi HOK</th>
                        <th className="border border-black p-2 text-right w-32">Upah Harian</th>
                        <th className="border border-black p-2 text-right w-36">Total Pembayaran</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upahItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="border border-black p-4 text-center text-slate-400 italic">
                            Pekerjaan ini tidak menggunakan tenaga kerja terpisah.
                          </td>
                        </tr>
                      ) : (
                        upahItems.map((u, idx) => {
                          const totalHok = Math.round((u.koefisien * rabVolume) * 100) / 100;
                          const totalUpah = Math.round(totalHok * u.hargaSatuan);
                          return (
                            <tr key={idx}>
                              <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                              <td className="border border-black p-2 font-medium">{u.uraian}</td>
                              <td className="border border-black p-2 text-center font-mono font-bold">
                                {totalHok} HOK
                              </td>
                              <td className="border border-black p-2 text-right font-mono">
                                {formatRupiah(u.hargaSatuan, false)}
                              </td>
                              <td className="border border-black p-2 text-right font-mono font-bold">
                                {formatRupiah(totalUpah, false)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold bg-slate-50">
                        <td colSpan={4} className="border border-black p-2 text-right uppercase">
                          Total Upah Tenaga :
                        </td>
                        <td className="border border-black p-2 text-right font-mono font-bold text-purple-900 text-sm">
                          {formatRupiah(totalUpahProyek, false)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                    <div className="text-center">
                      <p>Setuju Dibayar,</p>
                      <p className="font-bold">Ketua P2SP</p>
                      <div className="h-12" />
                      <p className="font-bold underline uppercase">{school?.namaKetuaP2SP || 'Ketua P2SP'}</p>
                    </div>

                    <div className="text-center">
                      <p>Lunas Dibayar,</p>
                      <p className="font-bold">Bendahara P2SP</p>
                      <div className="h-12" />
                      <p className="font-bold underline uppercase">{school?.namaBendahara || 'Bendahara'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-3 px-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Perubahan rumus AHSP atau koefisien belanja langsung tersimpan dan otomatis menyinkronkan dokumen LPJ.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold transition cursor-pointer"
          >
            Tutup Preview
          </button>
        </div>
      </div>
    </div>
  );
};
