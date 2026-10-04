import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  Printer,
  Calendar,
  CheckCircle2,
  FileText,
  Search,
  X,
  Edit3,
  Trash2,
  AlertCircle,
  Filter,
  CalendarRange,
  Clock,
  Layers,
  RotateCcw,
  Store,
  Sparkles,
  AlertTriangle,
  Eye,
  Wand2,
  RefreshCw,
} from 'lucide-react';
import { BkuTransaction, SchoolMasterData, ProjectProgressWeek, TransactionFilterOptions, StoreVendor, KwitansiDocument } from '../types';
import { formatRupiah } from '../utils/formatters';
import { getAvailableMonthsForSchool, resolveWeekDates, parseTxDateToIso } from '../utils/monthHelper';
import { isRegisteredVendor, isSiplahVendor, findMasterStore, isInternalNonVendorTransaction } from '../utils/vendorValidation';
import { VendorQuickRegisterModal } from './VendorQuickRegisterModal';
import { BkuDocumentPreviewModal } from './BkuDocumentPreviewModal';

interface BkuManagerProps {
  bkuList: BkuTransaction[];
  school: SchoolMasterData;
  progressWeeks?: ProjectProgressWeek[];
  stores?: StoreVendor[];
  kwitansiList?: KwitansiDocument[];
  onOpenPrintModal: (month?: string, filterOptions?: TransactionFilterOptions) => void;
  onAddTransaction?: (tx: Omit<BkuTransaction, 'id'>) => void;
  onUpdateTransaction?: (tx: BkuTransaction) => void;
  onDeleteTransaction?: (tx: BkuTransaction) => void;
  onUpdateStores?: (stores: StoreVendor[]) => void;
  onUpdateKwitansi?: (kw: KwitansiDocument, updatedTx?: Partial<BkuTransaction>) => void;
  onOpenPrintKwitansi?: (kwId: string, mode: 'KWITANSI' | 'FAKTUR' | 'SPB' | 'ALL') => void;
  onCalibrateToRealProgress?: () => void;
  onCleanDuplicates?: () => void;
  bkuWeekLimit?: number;
  onChangeBkuWeekLimit?: (limit: number) => void;
}

export const BkuManager: React.FC<BkuManagerProps> = ({
  bkuList,
  school,
  progressWeeks = [],
  stores = [],
  kwitansiList = [],
  onOpenPrintModal,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onUpdateStores,
  onUpdateKwitansi,
  onOpenPrintKwitansi,
  onCalibrateToRealProgress,
  onCleanDuplicates,
  bkuWeekLimit = 2,
  onChangeBkuWeekLimit,
}) => {
  // Filter Mode: 'ALL' | 'MONTH' | 'WEEK' | 'CUSTOM'
  const [filterMode, setFilterMode] = useState<'ALL' | 'MONTH' | 'WEEK' | 'CUSTOM'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate current realized progress percentage across active weeks
  const currentRealizedProgress = useMemo(() => {
    return progressWeeks.reduce((s, w) => {
      const divSum = (w.divisions || []).reduce((ds, d) => ds + (d.prestasiMingguIni || 0), 0);
      return s + (w.bobotRealisasi || divSum || 0);
    }, 0);
  }, [progressWeeks]);

  // Document Preview Modal State
  const [previewTx, setPreviewTx] = useState<BkuTransaction | null>(null);
  const [previewKw, setPreviewKw] = useState<KwitansiDocument | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const handleOpenPreview = (tx: BkuTransaction) => {
    let matchedKw: KwitansiDocument | null = null;
    if (kwitansiList && kwitansiList.length > 0) {
      matchedKw =
        kwitansiList.find((k) => k.id === tx.kwitansiIdRef) ||
        kwitansiList.find((k) => tx.id === `bku-kw-${k.id}`) ||
        kwitansiList.find((k) => tx.noBukti && tx.noBukti !== '-' && k.noBukti?.trim() === tx.noBukti?.trim()) ||
        kwitansiList.find((k) => Math.abs(k.nominal - (tx.pengeluaran || tx.penerimaan)) < 2) ||
        null;
    }
    setPreviewTx(tx);
    setPreviewKw(matchedKw);
    setPreviewModalOpen(true);
  };

  // Quick Register Store Modal State
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [unregisteredVendorName, setUnregisteredVendorName] = useState('');
  const [unregisteredTxId, setUnregisteredTxId] = useState<string | null>(null);

  // Modal state for manual input & editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<BkuTransaction | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const schoolYear = school?.tahunAnggaran?.trim() || '2026';

  // Determine starting date strictly from Laporan Mingguan & Bobot
  const minStartDateInfo = useMemo(() => {
    if (progressWeeks && progressWeeks.length > 0) {
      const w1 = progressWeeks.find((w) => w.mingguKe === 1) || progressWeeks[0];
      return resolveWeekDates(w1, schoolYear);
    }
    return {
      startDate: `${schoolYear}-07-01`,
      startDateFormatted: `01 Juli ${schoolYear}`,
      startDateSlash: `01/07/${schoolYear}`,
      endDate: `${schoolYear}-10-31`,
    };
  }, [progressWeeks, schoolYear]);

  // Available weeks list with formatted dates
  const weekOptions = useMemo(() => {
    return progressWeeks.map((w) => {
      const resolved = resolveWeekDates(w, schoolYear);
      return {
        mingguKe: w.mingguKe,
        startDate: resolved.startDate,
        endDate: resolved.endDate,
        periodeText: resolved.periodeText,
        bulan: resolved.bulan,
      };
    });
  }, [progressWeeks, schoolYear]);

  // Available months
  const months = useMemo(() => {
    return getAvailableMonthsForSchool(school, [bkuList]);
  }, [school, bkuList]);

  // Form states for Add/Edit
  const [formData, setFormData] = useState({
    tanggal: minStartDateInfo.startDate,
    jenis: 'PENGELUARAN' as 'PENERIMAAN' | 'PENGELUARAN',
    uraian: '',
    noBukti: '',
    nominal: 0,
    kategoriBiaya: 'Konstruksi',
  });

  // Active Week Date Range
  const activeWeekInfo = useMemo(() => {
    return weekOptions.find((w) => w.mingguKe === selectedWeekNum) || weekOptions[0] || null;
  }, [weekOptions, selectedWeekNum]);

  // Filter Transactions Engine
  const filteredBku = useMemo(() => {
    return bkuList.filter((tx) => {
      const txIso = parseTxDateToIso(tx.tanggalObj || tx.tanggal, parseInt(schoolYear, 10));

      // 1. Filter Mode Matching
      if (filterMode === 'MONTH') {
        if (selectedMonth !== 'ALL' && tx.bulan !== selectedMonth) {
          return false;
        }
      } else if (filterMode === 'WEEK') {
        if (activeWeekInfo) {
          if (txIso) {
            if (txIso < activeWeekInfo.startDate || txIso > activeWeekInfo.endDate) {
              return false;
            }
          } else if (tx.bulan && !tx.bulan.toLowerCase().includes(activeWeekInfo.bulan.toLowerCase())) {
            return false;
          }
        }
      } else if (filterMode === 'CUSTOM') {
        if (customStartDate && txIso && txIso < customStartDate) {
          return false;
        }
        if (customEndDate && txIso && txIso > customEndDate) {
          return false;
        }
      }

      // 2. Search Query Matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUraian = tx.uraian.toLowerCase().includes(q);
        const matchBukti = tx.noBukti.toLowerCase().includes(q);
        const matchTanggal = tx.tanggal.includes(q);
        if (!matchUraian && !matchBukti && !matchTanggal) {
          return false;
        }
      }

      return true;
    });
  }, [bkuList, filterMode, selectedMonth, selectedWeekNum, activeWeekInfo, customStartDate, customEndDate, searchQuery, schoolYear]);

  // Recalculate dynamic totals for filtered data
  const totalPenerimaan = useMemo(() => filteredBku.reduce((sum, tx) => sum + tx.penerimaan, 0), [filteredBku]);
  const totalPengeluaran = useMemo(() => filteredBku.reduce((sum, tx) => sum + tx.pengeluaran, 0), [filteredBku]);
  const lastItem = filteredBku[filteredBku.length - 1];
  const saldoAkhir = lastItem ? lastItem.saldo || (totalPenerimaan - totalPengeluaran) : 0;

  // Active filter readable description label
  const activeFilterLabel = useMemo(() => {
    if (filterMode === 'ALL') {
      return 'Semua Transaksi (Lengkap)';
    }
    if (filterMode === 'MONTH') {
      return selectedMonth === 'ALL' ? 'Semua Bulan' : `Bulan ${selectedMonth}`;
    }
    if (filterMode === 'WEEK') {
      return activeWeekInfo
        ? `Minggu Ke-${activeWeekInfo.mingguKe} (${activeWeekInfo.periodeText})`
        : `Minggu Ke-${selectedWeekNum}`;
    }
    if (filterMode === 'CUSTOM') {
      if (customStartDate && customEndDate) {
        return `Rentang ${customStartDate} s/d ${customEndDate}`;
      }
      if (customStartDate) {
        return `Mulai Tanggal ${customStartDate}`;
      }
      if (customEndDate) {
        return `Sampai Tanggal ${customEndDate}`;
      }
      return 'Rentang Tanggal Khusus';
    }
    return 'Semua';
  }, [filterMode, selectedMonth, selectedWeekNum, activeWeekInfo, customStartDate, customEndDate]);

  // Trigger Print with current active filter
  const handlePrintCurrentFilter = () => {
    if (filterMode === 'MONTH') {
      onOpenPrintModal(selectedMonth === 'ALL' ? undefined : selectedMonth, {
        filterMode: 'MONTH',
        month: selectedMonth === 'ALL' ? undefined : selectedMonth,
        label: activeFilterLabel,
      });
    } else if (filterMode === 'WEEK') {
      onOpenPrintModal(undefined, {
        filterMode: 'WEEK',
        weekNum: selectedWeekNum,
        startDate: activeWeekInfo?.startDate,
        endDate: activeWeekInfo?.endDate,
        label: activeFilterLabel,
      });
    } else if (filterMode === 'CUSTOM') {
      onOpenPrintModal(undefined, {
        filterMode: 'CUSTOM',
        startDate: customStartDate,
        endDate: customEndDate,
        label: activeFilterLabel,
      });
    } else {
      onOpenPrintModal(undefined, {
        filterMode: 'ALL',
        label: 'Buku Kas Umum Lengkap',
      });
    }
  };

  // Quick preset dates for custom filter
  const handleApplyQuickPreset = (preset: '7D' | '14D' | '30D' | 'ALL_PROJECT') => {
    setFilterMode('CUSTOM');
    const now = new Date();
    const endIso = now.toISOString().split('T')[0];

    if (preset === '7D') {
      const start = new Date(now.getTime() - 7 * 86400000);
      setCustomStartDate(start.toISOString().split('T')[0]);
      setCustomEndDate(endIso);
    } else if (preset === '14D') {
      const start = new Date(now.getTime() - 14 * 86400000);
      setCustomStartDate(start.toISOString().split('T')[0]);
      setCustomEndDate(endIso);
    } else if (preset === '30D') {
      const start = new Date(now.getTime() - 30 * 86400000);
      setCustomStartDate(start.toISOString().split('T')[0]);
      setCustomEndDate(endIso);
    } else if (preset === 'ALL_PROJECT') {
      if (weekOptions.length > 0) {
        setCustomStartDate(weekOptions[0].startDate);
        setCustomEndDate(weekOptions[weekOptions.length - 1].endDate);
      } else {
        setCustomStartDate(`${schoolYear}-07-01`);
        setCustomEndDate(`${schoolYear}-10-31`);
      }
    }
  };

  const handleResetFilter = () => {
    setFilterMode('ALL');
    setSelectedMonth('ALL');
    setSelectedWeekNum(1);
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchQuery('');
  };

  // Handlers for Add / Edit modal
  const handleOpenAdd = () => {
    setEditingTx(null);
    setFormError(null);
    setSelectedStoreId('');
    setFormData({
      tanggal: minStartDateInfo.startDate,
      jenis: 'PENGELUARAN',
      uraian: '',
      noBukti: `BM-${String(bkuList.length + 1).padStart(2, '0')}/${schoolYear}`,
      nominal: 0,
      kategoriBiaya: 'Konstruksi',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tx: BkuTransaction) => {
    setEditingTx(tx);
    setFormError(null);

    let dateInput = minStartDateInfo.startDate;
    if (tx.tanggalObj && tx.tanggalObj.includes('-')) {
      dateInput = tx.tanggalObj;
    } else if (tx.tanggal.includes('/')) {
      const [d, m, y] = tx.tanggal.split('/');
      dateInput = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Try to auto-match store from transaction uraian or linked kwitansi
    let matchedStore = stores.find(
      (s) => s.namaToko && tx.uraian.toLowerCase().includes(s.namaToko.toLowerCase())
    );
    if (!matchedStore && tx.kwitansiIdRef && kwitansiList) {
      const linkedKw = kwitansiList.find((k) => k.id === tx.kwitansiIdRef || k.noBukti === tx.noBukti);
      if (linkedKw) {
        matchedStore = stores.find(
          (s) =>
            s.namaToko &&
            (s.namaToko.toLowerCase() === linkedKw.namaToko?.toLowerCase() ||
              s.pemilikNama?.toLowerCase() === linkedKw.penerimaNama?.toLowerCase())
        );
      }
    }
    setSelectedStoreId(matchedStore ? matchedStore.id : '');

    setFormData({
      tanggal: dateInput,
      jenis: tx.jenis,
      uraian: tx.uraian,
      noBukti: tx.noBukti === '-' ? '' : tx.noBukti,
      nominal: tx.jenis === 'PENERIMAAN' ? tx.penerimaan : tx.pengeluaran,
      kategoriBiaya: tx.kategoriBiaya || 'Konstruksi',
    });
    setIsModalOpen(true);
  };

  const handleSelectStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    if (!storeId) return;
    const store = stores.find((s) => s.id === storeId);
    if (!store) return;

    let newUraian = formData.uraian;
    const storeName = store.namaToko || store.pemilikNama;

    if (!newUraian || /bayar\s+bahan|pembelian|bayar\s+meubelair|bayar\s+peralatan|bayar\s+apd|bayar/i.test(newUraian)) {
      if (formData.kategoriBiaya === 'Perabot') {
        newUraian = `Bayar Meubelair Dari ${storeName}`;
      } else if (formData.kategoriBiaya === 'Peralatan') {
        newUraian = `Bayar Peralatan Dari ${storeName}`;
      } else if (formData.kategoriBiaya === 'SMKK') {
        newUraian = `Bayar APD / SMKK Dari ${storeName}`;
      } else if (formData.kategoriBiaya === 'Perencanaan_Pengelolaan') {
        newUraian = `Bayar Honorarium / Jasa Dari ${store.pemilikNama || storeName}`;
      } else {
        newUraian = `Bayar Bahan Dari ${storeName}`;
      }
    } else {
      if (/dari/i.test(newUraian)) {
        newUraian = newUraian.replace(/dari\s+.*$/i, `Dari ${storeName}`);
      } else {
        newUraian = `${newUraian} (Penyedia: ${storeName})`;
      }
    }

    setFormData((prev) => ({ ...prev, uraian: newUraian }));
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.uraian.trim()) {
      setFormError('Uraian transaksi tidak boleh kosong.');
      return;
    }

    if (!formData.nominal || formData.nominal <= 0) {
      setFormError('Nominal transaksi harus lebih dari Rp 0.');
      return;
    }

    if (formData.tanggal < minStartDateInfo.startDate) {
      setFormError(
        `Tanggal transaksi (${formData.tanggal}) tidak boleh kurang dari tanggal mulai Laporan Mingguan & Bobot (${minStartDateInfo.startDateFormatted}).`
      );
      return;
    }

    const [y, m, d] = formData.tanggal.split('-');
    const indMonths = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const bulanStr = `${indMonths[parseInt(m, 10) - 1]} ${y}`;
    const displayTanggal = `${d}/${m}/${y}`;

    if (editingTx) {
      if (onUpdateTransaction) {
        onUpdateTransaction({
          ...editingTx,
          tanggal: displayTanggal,
          tanggalObj: formData.tanggal,
          bulan: bulanStr,
          jenis: formData.jenis,
          uraian: formData.uraian.trim(),
          noBukti: formData.noBukti.trim() || '-',
          penerimaan: formData.jenis === 'PENERIMAAN' ? formData.nominal : 0,
          pengeluaran: formData.jenis === 'PENGELUARAN' ? formData.nominal : 0,
          kategoriBiaya: formData.kategoriBiaya,
        });
      }
    } else {
      if (onAddTransaction) {
        onAddTransaction({
          tanggal: displayTanggal,
          tanggalObj: formData.tanggal,
          bulan: bulanStr,
          jenis: formData.jenis,
          uraian: formData.uraian.trim(),
          noBukti: formData.noBukti.trim() || '-',
          penerimaan: formData.jenis === 'PENERIMAAN' ? formData.nominal : 0,
          pengeluaran: formData.jenis === 'PENGELUARAN' ? formData.nominal : 0,
          kategoriBiaya: formData.kategoriBiaya,
        });
      }
    }

    // Sync selected store to linked Kwitansi Document if available
    if (selectedStoreId && onUpdateKwitansi && kwitansiList) {
      const selectedStore = stores.find((s) => s.id === selectedStoreId);
      if (selectedStore) {
        const linkedKw = kwitansiList.find(
          (k) =>
            (editingTx?.kwitansiIdRef && k.id === editingTx.kwitansiIdRef) ||
            (formData.noBukti && k.noBukti?.trim() === formData.noBukti.trim())
        );
        if (linkedKw) {
          onUpdateKwitansi({
            ...linkedKw,
            namaToko: selectedStore.namaToko,
            penerimaNama: selectedStore.pemilikNama || linkedKw.penerimaNama,
            penerimaPekerjaan: selectedStore.pekerjaan || linkedKw.penerimaPekerjaan,
            penerimaAlamat: selectedStore.alamat || linkedKw.penerimaAlamat,
          });
        }
      }
    }

    setIsModalOpen(false);
  };

  const handleDelete = (tx: BkuTransaction) => {
    const nominalStr = formatRupiah(tx.jenis === 'PENERIMAAN' ? tx.penerimaan : tx.pengeluaran);
    if (
      confirm(
        `Apakah Anda yakin ingin MENGHAPUS transaksi ini dari Buku Kas Umum?\n\nTanggal: ${tx.tanggal}\nUraian: "${tx.uraian}"\nNominal: ${nominalStr}`
      )
    ) {
      if (onDeleteTransaction) {
        onDeleteTransaction(tx);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            Buku Kas Umum (BKU) Revitalisasi Sekolah
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Mencatat seluruh arus penerimaan dan pengeluaran dana termin 70% dan 30% secara kronologis dan otomatis terintegrasi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onChangeBkuWeekLimit && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Batas Progres BKU s/d:</span>
              <select
                value={bkuWeekLimit}
                onChange={(e) => onChangeBkuWeekLimit(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-bold text-slate-800 cursor-pointer focus:outline-none"
              >
                {progressWeeks.map((w) => (
                  <option key={w.mingguKe} value={w.mingguKe}>
                    Minggu {w.mingguKe} ({w.bobotRealisasi || w.bobotRencana}%)
                  </option>
                ))}
              </select>
            </div>
          )}

          {onCleanDuplicates && (
            <button
              type="button"
              onClick={onCleanDuplicates}
              className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              title="Cari & Hapus Otomatis Kwitansi / Transaksi BKU Terduplikasi"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Bersihkan Data Ganda</span>
            </button>
          )}

          {onCalibrateToRealProgress && (
            <button
              type="button"
              onClick={onCalibrateToRealProgress}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              title="Singkronkan & Kalibrasikan seluruh BKU dengan Progres Riil"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Kalibrasi BKU</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrintCurrentFilter}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer border border-slate-800"
            title="Cetak Buku Kas Umum sesuai filter yang aktif saat ini"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Cetak Sesuai Filter ({activeFilterLabel})</span>
          </button>
        </div>
      </div>

      {/* FILTER PANEL UTAMA (Mingguan, Bulanan, Rentang Tanggal) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              PILIHAN FILTER TRANSAKSI BKU :
            </h3>
          </div>

          {/* Filter Mode Selector Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'ALL'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Semua</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterMode('MONTH');
                if (selectedMonth === 'ALL' && months.length > 1) {
                  setSelectedMonth(months[1]);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'MONTH'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Bulanan</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('WEEK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'WEEK'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Mingguan</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('CUSTOM')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'CUSTOM'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Rentang Tanggal</span>
            </button>
          </div>
        </div>

        {/* Dynamic Controls Based on Active Filter Mode */}
        {filterMode === 'MONTH' && (
          <div className="flex flex-wrap items-center gap-2 pt-1 animate-fade-in">
            <span className="text-xs font-semibold text-slate-700 mr-1">Pilih Bulan:</span>
            {months.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedMonth === m
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {m === 'ALL' ? 'Semua Bulan' : m}
              </button>
            ))}
          </div>
        )}

        {filterMode === 'WEEK' && (
          <div className="space-y-2 pt-1 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Pilih Periode Minggu Kerja (Total {weekOptions.length} Minggu):
              </span>
              {activeWeekInfo && (
                <span className="text-xs font-bold text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Periode: {activeWeekInfo.periodeText} ({activeWeekInfo.startDate} s.d. {activeWeekInfo.endDate})
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
              {weekOptions.map((w) => (
                <button
                  key={w.mingguKe}
                  type="button"
                  onClick={() => setSelectedWeekNum(w.mingguKe)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    selectedWeekNum === w.mingguKe
                      ? 'bg-blue-600 text-white font-bold shadow-2xs'
                      : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>M{w.mingguKe}</span>
                  <span className={`text-[10px] ${selectedWeekNum === w.mingguKe ? 'text-blue-100' : 'text-slate-500'}`}>
                    ({w.periodeText})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {filterMode === 'CUSTOM' && (
          <div className="space-y-3 pt-1 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Dari Tanggal:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Sampai Tanggal:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 w-full mb-0.5">Pilihan Cepat:</span>
                <button
                  type="button"
                  onClick={() => handleApplyQuickPreset('7D')}
                  className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition cursor-pointer"
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickPreset('14D')}
                  className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition cursor-pointer"
                >
                  14 Hari
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickPreset('30D')}
                  className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition cursor-pointer"
                >
                  30 Hari
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickPreset('ALL_PROJECT')}
                  className="px-2.5 py-1 text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-medium border border-blue-200 transition cursor-pointer"
                >
                  Sepanjang Proyek
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar & Reset Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari uraian, nomor bukti, atau tanggal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {(filterMode !== 'ALL' || searchQuery !== '') && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                title="Reset seluruh filter kembali ke Semua Transaksi"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Indicator Badge */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="font-semibold text-slate-700">Filter Aktif:</span>
            <strong className="text-blue-900 font-bold bg-white px-2.5 py-0.5 rounded border border-blue-200 shadow-2xs">
              {activeFilterLabel}
            </strong>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-600">
            <span>Ditemukan: <strong className="text-slate-900 font-bold">{filteredBku.length}</strong> transaksi</span>
            <span>•</span>
            <span className="text-blue-800 font-bold">Saldo: {formatRupiah(saldoAkhir)}</span>
          </div>
        </div>
      </div>

      {/* Saldo Minus Anti-Deficit Alert Banner */}
      {saldoAkhir < 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-rose-50 border-2 border-rose-300 text-rose-950 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 rounded-xl text-rose-700 shrink-0 mt-0.5 md:mt-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-rose-900">
                ⚠️ Saldo Kas Minus ({formatRupiah(saldoAkhir)}) — Belanja Melebihi Progres Nyata ({currentRealizedProgress.toFixed(1)}%)
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Pengeluaran kas ({formatRupiah(totalPengeluaran)}) terakumulasi melebihi progres fisik nyata saat ini ({currentRealizedProgress.toFixed(1)}%). Ini terjadi karena bahan terhitung penuh sekaligus dan ada transaksi minggu masa depan yang menumpuk. Klik tombol untuk mengalibrasi belanja bertahap dan upah borongan mingguan agar saldo kas kembali positif sehat.
              </p>
            </div>
          </div>
          {onCalibrateToRealProgress && (
            <button
              type="button"
              onClick={onCalibrateToRealProgress}
              className="shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <Wand2 className="w-4 h-4 text-amber-200" />
              <span>⚡ Kalibrasi Belanja Sesuai Progres ({currentRealizedProgress.toFixed(1)}%)</span>
            </button>
          )}
        </div>
      )}

      {/* Summary KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Penerimaan (Filter)</span>
          <p className="text-lg font-bold text-blue-700 mt-1">{formatRupiah(totalPenerimaan)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Pengeluaran (Filter)</span>
          <p className="text-lg font-bold text-rose-700 mt-1">{formatRupiah(totalPengeluaran)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Posisi Saldo Kas</span>
          <p className="text-lg font-bold text-emerald-700 mt-1">{formatRupiah(saldoAkhir)}</p>
        </div>
      </div>

      {/* BKU Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <span>BUKU KAS UMUM (BKU)</span>
              <span className="text-emerald-400 font-mono">• {activeFilterLabel}</span>
            </h3>
            <p className="text-[11px] text-slate-400">{school.namaSekolah} • {school.pekerjaan}</p>
          </div>

          <div className="flex items-center gap-2">
            {onCalibrateToRealProgress && (
              <button
                type="button"
                onClick={onCalibrateToRealProgress}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                title="Sesuaikan belanja bahan & upah borongan murni sesuai progres fisik saat ini"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-200" />
                <span>⚡ Kalibrasi ({currentRealizedProgress.toFixed(1)}%)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintCurrentFilter}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
              title="Cetak hasil filter BKU saat ini"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Hasil Filter</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Input Transaksi Manual</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-3 w-10 text-center">No</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-4">Uraian Transaksi</th>
                <th className="py-2.5 px-3 text-center">No. Bukti</th>
                <th className="py-2.5 px-4 text-right text-blue-900 bg-blue-50/50">Penerimaan (Rp)</th>
                <th className="py-2.5 px-4 text-right text-rose-900 bg-rose-50/50">Pengeluaran (Rp)</th>
                <th className="py-2.5 px-4 text-right font-bold">Saldo (Rp)</th>
                <th className="py-2.5 px-3 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBku.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <AlertCircle className="w-6 h-6 text-slate-300" />
                      <p className="font-semibold text-slate-600">Tidak ada transaksi BKU pada filter saat ini.</p>
                      <p className="text-[11px] text-slate-400">Coba ubah opsi filter mingguan, bulanan, atau rentang tanggal di atas.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBku.map((tx, idx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap font-mono">{tx.tanggal}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(tx)}
                          className="text-left font-semibold text-slate-900 hover:text-blue-700 transition flex items-center justify-between gap-2 group/preview cursor-pointer"
                          title="Klik untuk Pratinjau Dokumen Kwitansi, Bon & SPB"
                        >
                          <span className="group-hover/preview:underline flex-1">{tx.uraian}</span>
                          <span className="opacity-0 group-hover/preview:opacity-100 transition px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold flex items-center gap-1 shrink-0">
                            <Eye className="w-3 h-3 text-blue-600" />
                            <span>Preview</span>
                          </span>
                        </button>
                        {tx.pengeluaran > 0 && !isInternalNonVendorTransaction(tx.uraian) && (() => {
                          const matchedStore = findMasterStore(tx.uraian, stores);
                          if (matchedStore) {
                            const isSiplah = matchedStore.kategori === 'SIPLAH' || matchedStore.isSiplah;
                            return (
                              <div className="flex items-center gap-1 text-[10px]">
                                <span className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                  isSiplah ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}>
                                  <Store className="w-3 h-3" />
                                  <span>{isSiplah ? `🛒 SipLah: ${matchedStore.namaToko}` : `🏢 Master Toko: ${matchedStore.namaToko}`}</span>
                                </span>
                              </div>
                            );
                          }
                          return (
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>⚠️ Toko Belum Terdaftar di Master Data</span>
                              </span>
                              {onUpdateStores && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUnregisteredVendorName(tx.uraian);
                                    setUnregisteredTxId(tx.id);
                                    setRegisterModalOpen(true);
                                  }}
                                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md shadow-2xs cursor-pointer flex items-center gap-1"
                                >
                                  <span>+ Daftarkan / Pilih Toko</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td
                      onClick={() => handleOpenPreview(tx)}
                      className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-700 bg-slate-50/80 rounded hover:bg-blue-100 hover:text-blue-800 transition cursor-pointer font-bold"
                      title="Klik untuk Pratinjau Dokumen Kwitansi, Bon & SPB"
                    >
                      {tx.noBukti || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-blue-700 bg-blue-50/30">
                      {tx.penerimaan > 0 ? formatRupiah(tx.penerimaan, false) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-rose-700 bg-rose-50/30">
                      {tx.pengeluaran > 0 ? formatRupiah(tx.pengeluaran, false) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(tx.saldo || 0, false)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(tx)}
                          className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border border-blue-200 transition cursor-pointer"
                          title="Pratinjau Dokumen (Kwitansi, Bon, SPB)"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tx)}
                          className="p-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-900 border border-amber-200 transition cursor-pointer"
                          title="Edit Transaksi BKU"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(tx)}
                          className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 border border-rose-200 transition cursor-pointer"
                          title="Hapus Transaksi BKU"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                <td colSpan={4} className="py-3 px-4 text-right uppercase text-xs">
                  Total Filter ({activeFilterLabel}):
                </td>
                <td className="py-3 px-4 text-right font-mono text-blue-900 bg-blue-100/50">
                  {formatRupiah(totalPenerimaan, false)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-rose-900 bg-rose-100/50">
                  {formatRupiah(totalPengeluaran, false)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-900">
                  {formatRupiah(saldoAkhir, false)}
                </td>
                <td className="py-3 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Closing Position Box */}
        <div className="p-5 bg-slate-50 border-t border-slate-200">
          <div className="max-w-md bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
              <span>Posisi Penutupan Kas ({activeFilterLabel})</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Sesuai Filter
              </span>
            </h4>
            <div className="flex justify-between text-slate-600">
              <span>Saldo Buku Kas Umum:</span>
              <strong className="text-slate-900 font-mono">{formatRupiah(saldoAkhir)}</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>- Saldo Rekening Bank:</span>
              <span className="font-mono">{formatRupiah(0)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>- Saldo Kas Tunai:</span>
              <span className="font-mono">{formatRupiah(saldoAkhir)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-slate-900">
              <span>Perbedaan / Selisih:</span>
              <span className="text-emerald-600 font-mono">Rp 0,00 (Cocok)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Input Manual & Edit Transaksi */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <span>{editingTx ? 'Edit Transaksi BKU' : 'Tambah Transaksi Manual BKU'}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Transaksi akan otomatis disinkronkan ke Buku Pembantu Kas Tunai (BKT) dan perhitungan Saldo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Tanggal & Jenis Transaksi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Transaksi</label>
                  <input
                    type="date"
                    min={minStartDateInfo.startDate}
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenis Arus Kas</label>
                  <select
                    value={formData.jenis}
                    onChange={(e) => setFormData({ ...formData, jenis: e.target.value as 'PENERIMAAN' | 'PENGELUARAN' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white font-semibold"
                  >
                    <option value="PENGELUARAN">PENGELUARAN (Kredit)</option>
                    <option value="PENERIMAAN">PENERIMAAN (Debet / Dana Termin)</option>
                  </select>
                </div>
              </div>

              {/* Dropdown Toko Rekanan / Penyedia */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Pilih Toko Rekanan / Penyedia (Opsional)</span>
                  <span className="text-[10px] text-blue-600 font-medium">Otomatiskan Uraian & Kwitansi</span>
                </label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => handleSelectStore(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white text-xs font-medium"
                >
                  <option value="">-- Tanpa Penyedia Khusus / Manual --</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      🏬 {s.namaToko} ({s.pemilikNama || 'Pemilik'} - {s.pekerjaan || s.kategori})
                    </option>
                  ))}
                </select>
              </div>

              {/* Uraian Transaksi */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Uraian Transaksi / Keperluan</label>
                <textarea
                  rows={2}
                  value={formData.uraian}
                  onChange={(e) => setFormData({ ...formData, uraian: e.target.value })}
                  placeholder="Contoh: Pembelian Semen Gresik 50 Sak untuk Pekerjaan Dinding"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                  required
                />
              </div>

              {/* No. Bukti & Kategori */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Bukti (Kwitansi / Nota)</label>
                  <input
                    type="text"
                    value={formData.noBukti}
                    onChange={(e) => setFormData({ ...formData, noBukti: e.target.value })}
                    placeholder="Contoh: BM-01/2026 atau KW-05"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Biaya</label>
                  <select
                    value={formData.kategoriBiaya}
                    onChange={(e) => setFormData({ ...formData, kategoriBiaya: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                  >
                    <option value="Konstruksi">Material / Bahan Konstruksi</option>
                    <option value="Upah">Upah Kerja & Tukang</option>
                    <option value="Peralatan">Sewa / Beli Alat Kerja</option>
                    <option value="SMKK">Biaya Penerapan SMKK</option>
                    <option value="Perabot">Pengadaan Perabot</option>
                    <option value="Perencanaan_Pengelolaan">Operasional & Administrasi</option>
                    <option value="Termin">Penerimaan Dana Termin</option>
                  </select>
                </div>
              </div>

              {/* Nominal Transaksi */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal Transaksi (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500">Rp</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={formData.nominal || ''}
                    onChange={(e) => setFormData({ ...formData, nominal: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white font-mono font-bold text-sm text-slate-900"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  Terbaca: {formatRupiah(formData.nominal || 0)}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                >
                  {editingTx ? 'Simpan Perubahan' : 'Tambahkan ke BKU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Register / Select Existing Store Modal */}
      {onUpdateStores && (
        <VendorQuickRegisterModal
          isOpen={registerModalOpen}
          unregisteredName={unregisteredVendorName}
          availableStores={stores}
          onClose={() => setRegisterModalOpen(false)}
          onSaveStore={(newStore) => {
            onUpdateStores([...stores, newStore]);
          }}
          onSelectExistingStore={(selectedStore) => {
            if (unregisteredTxId && onUpdateTransaction) {
              const target = bkuList.find((t) => t.id === unregisteredTxId);
              if (target) {
                let updatedUraian = target.uraian;
                if (updatedUraian.includes('(') && updatedUraian.includes(')')) {
                  updatedUraian = updatedUraian.replace(/\(([^)]+)\)/, `(${selectedStore.namaToko})`);
                } else {
                  updatedUraian = `${target.uraian} (${selectedStore.namaToko})`;
                }
                onUpdateTransaction({
                  ...target,
                  uraian: updatedUraian,
                });
              }
            }
          }}
        />
      )}

      {/* Live Kwitansi, Bon & SPB Preview and Quick Edit Modal */}
      <BkuDocumentPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        transaction={previewTx}
        kwitansi={previewKw}
        school={school}
        stores={stores}
        onSaveKwitansi={(updatedKw, updatedTx) => {
          if (onUpdateKwitansi) {
            onUpdateKwitansi(updatedKw, updatedTx);
          }
          if (previewTx && onUpdateTransaction && updatedTx) {
            onUpdateTransaction({
              ...previewTx,
              ...updatedTx,
            });
          }
          // Update local preview state
          setPreviewKw(updatedKw);
          if (previewTx && updatedTx) {
            setPreviewTx({
              ...previewTx,
              ...updatedTx,
            });
          }
        }}
        onPrintDocument={(docType, kwId) => {
          if (onOpenPrintKwitansi && kwId) {
            onOpenPrintKwitansi(kwId, docType);
          } else {
            onOpenPrintModal(undefined);
          }
        }}
      />
    </div>
  );
};
