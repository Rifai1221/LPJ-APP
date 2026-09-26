import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Sparkles,
  Calendar,
  CheckCircle,
  Plus,
  ArrowRight,
  Printer,
  FileSpreadsheet,
  AlertCircle,
  Building,
  Layers,
  Receipt,
  FileText,
  Users,
  Sliders,
  RotateCcw,
  Wand2,
  Edit3,
  Trash2,
  Check,
  X,
  Camera,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
import {
  ProjectProgressWeek,
  DivisionProgressItem,
  WorkerItem,
  RpdItem,
  SchoolMasterData,
  ProgressPhotoItem,
  BkuTransaction,
  KwitansiDocument,
} from '../types';
import { formatNumber, formatRupiah } from '../utils/formatters';
import { DEFAULT_DIVISIONS, toRoman, renumberDivisions } from '../utils/divisionHelper';
import { resolveWeekDates } from '../utils/monthHelper';
import { WeeklyPhotoDocumentation } from './WeeklyPhotoDocumentation';

interface WeeklyProgressManagerProps {
  progressWeeks: ProjectProgressWeek[];
  workers: WorkerItem[];
  rpdItems: RpdItem[];
  school: SchoolMasterData;
  onUpdateWeeks: (weeks: ProjectProgressWeek[]) => void;
  onAutoGenerateFromProgress: (targetWeek: number, splitDays?: boolean, overrideWeeks?: ProjectProgressWeek[]) => void;
  onAutoGenerateAllWeeks?: () => void;
  onOpenPrintModal: (weekNum?: number) => void;
  bkuList?: BkuTransaction[];
  kwitansiList?: KwitansiDocument[];
  onAddTransaction?: (tx: Omit<BkuTransaction, 'id'>, weekNum?: number) => void;
  onUpdateTransaction?: (tx: BkuTransaction) => void;
  onDeleteTransaction?: (tx: BkuTransaction) => void;
}

export const WeeklyProgressManager: React.FC<WeeklyProgressManagerProps> = ({
  progressWeeks,
  workers,
  rpdItems,
  school,
  onUpdateWeeks,
  onAutoGenerateFromProgress,
  onAutoGenerateAllWeeks,
  onOpenPrintModal,
  bkuList,
  kwitansiList,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
}) => {
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [isEditingBobotMaster, setIsEditingBobotMaster] = useState<boolean>(false);

  // States for adding and editing division items
  const [addingCategory, setAddingCategory] = useState<'FISIK' | 'MANAJEMEN' | null>(null);
  const [newUraianText, setNewUraianText] = useState<string>('');
  const [newBobotText, setNewBobotText] = useState<string>('0.00');

  const [editingUraianId, setEditingUraianId] = useState<string | null>(null);
  const [editingUraianText, setEditingUraianText] = useState<string>('');

  const [confirmDeleteDivision, setConfirmDeleteDivision] = useState<DivisionProgressItem | null>(null);

  // States for manual adjustment of Realisasi and Target
  const [customRealisasiStr, setCustomRealisasiStr] = useState<Record<number, string>>({});
  const [customTargetStr, setCustomTargetStr] = useState<Record<number, string>>({});

  // States for manual input, edit, and delete of week transactions
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [editingTx, setEditingTx] = useState<BkuTransaction | null>(null);
  const [txFormError, setTxFormError] = useState<string | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<BkuTransaction | null>(null);

  const currentWeek =
    progressWeeks.find((w) => w.mingguKe === selectedWeekNum) || progressWeeks[0] || { mingguKe: 1 };

  const schoolYear = school?.tahunAnggaran?.trim() || '2026';
  const weekResolved = resolveWeekDates(currentWeek, schoolYear);

  const [txFormData, setTxFormData] = useState({
    tanggal: weekResolved.startDate,
    jenis: 'PENGELUARAN' as 'PENERIMAAN' | 'PENGELUARAN',
    uraian: '',
    noBukti: '',
    nominal: 0,
    kategoriBiaya: 'Konstruksi',
  });

  // Filter transactions belonging to selectedWeekNum
  const currentWeekTransactions = useMemo(() => {
    if (!bkuList) return [];
    return bkuList.filter((tx) => {
      // 1. Linked kwitansi with mingguKeRef
      if (tx.kwitansiIdRef && kwitansiList) {
        const linkedKw = kwitansiList.find((k) => k.id === tx.kwitansiIdRef);
        if (linkedKw?.mingguKeRef === selectedWeekNum) return true;
      }
      // 2. Proof number matches week
      const padWeek = selectedWeekNum < 10 ? `0${selectedWeekNum}` : `${selectedWeekNum}`;
      if (
        tx.noBukti.includes(`/UK/${padWeek}/`) ||
        tx.noBukti.includes(`UK/${padWeek}/`) ||
        tx.noBukti.includes(`M${selectedWeekNum}-`) ||
        tx.noBukti.includes(`TARIK-M${selectedWeekNum}`)
      ) {
        return true;
      }
      // 3. Description mentions week
      const lowUraian = tx.uraian.toLowerCase();
      if (
        lowUraian.includes(`minggu ke-${selectedWeekNum}`) ||
        lowUraian.includes(`minggu ${selectedWeekNum} `) ||
        lowUraian.includes(`minggu ${selectedWeekNum}(`) ||
        lowUraian.includes(`minggu ${selectedWeekNum},`) ||
        lowUraian.includes(`minggu ${selectedWeekNum} (${weekResolved.startDateFormatted}`)
      ) {
        return true;
      }
      // 4. Initial Termin 1 in Week 1
      if (selectedWeekNum === 1 && (tx.id === 'bku-init-1' || tx.noBukti === 'BKT-01')) {
        return true;
      }
      // 5. Initial Termin 2 in Week 8
      if (selectedWeekNum === 8 && (tx.id === 'bku-init-2' || tx.noBukti === 'BKT-02')) {
        return true;
      }
      // 6. Transaction date falls between week startDate and endDate
      if (tx.tanggalObj && tx.tanggalObj >= weekResolved.startDate && tx.tanggalObj <= weekResolved.endDate) {
        return true;
      }
      return false;
    });
  }, [bkuList, kwitansiList, selectedWeekNum, weekResolved]);

  const totalPengeluaranWeek = useMemo(() => {
    return currentWeekTransactions
      .filter((t) => t.jenis === 'PENGELUARAN')
      .reduce((s, t) => s + t.pengeluaran, 0);
  }, [currentWeekTransactions]);

  const totalPenerimaanWeek = useMemo(() => {
    return currentWeekTransactions
      .filter((t) => t.jenis === 'PENERIMAAN')
      .reduce((s, t) => s + t.penerimaan, 0);
  }, [currentWeekTransactions]);

  // If week doesn't have divisions array initialized, construct from DEFAULT_DIVISIONS
  const rawDivisions: DivisionProgressItem[] =
    currentWeek.divisions && currentWeek.divisions.length > 0
      ? currentWeek.divisions
      : DEFAULT_DIVISIONS.map((d) => ({
          ...d,
          prestasiMingguLalu: 0,
          prestasiMingguIni: 0,
          prestasiSdMingguIni: 0,
        }));

  // Automatically enforce Roman numeral numbering according to work category (FISIK or MANAJEMEN)
  const divisions = renumberDivisions(rawDivisions);

  const fisikDivisions = divisions.filter((d) => d.kategori === 'FISIK');
  const manajemenDivisions = divisions.filter((d) => d.kategori === 'MANAJEMEN');

  // Compute column totals automatically
  const rawTotalBobot = divisions.reduce((s, d) => s + (Number(d.bobotTotal) || 0), 0);
  const roundedRawTotalBobot = Math.round(rawTotalBobot * 100) / 100;
  // Tetap maksimal di 100,00% sesuai instruksi user
  const cappedTotalBobot = Math.min(100, roundedRawTotalBobot);

  const totalMingguLalu = divisions.reduce((s, d) => s + d.prestasiMingguLalu, 0);
  const totalMingguIni = divisions.reduce((s, d) => s + d.prestasiMingguIni, 0);
  const totalSdMingguIni = Math.min(100, Math.round(divisions.reduce((s, d) => s + d.prestasiSdMingguIni, 0) * 100) / 100);

  // Active Realisasi & Target: user can adjust either manually or use table calculations
  const activeRealisasi =
    currentWeek.bobotRealisasi !== undefined && currentWeek.bobotRealisasi !== null
      ? currentWeek.bobotRealisasi
      : totalSdMingguIni;
  const activeTarget =
    currentWeek.bobotRencana !== undefined && currentWeek.bobotRencana !== null
      ? currentWeek.bobotRencana
      : 0;

  // LEBIH CEPAT DARI RENCANA / TERLAMBAT DARI RENCANA (Menghitung Otomatis Real-Time)
  const deviasi = Math.round((activeRealisasi - activeTarget) * 100) / 100;
  const isFaster = deviasi >= 0;

  // Handler to adjust PRESTASI PELAKSANAAN (REALISASI) manually
  const handleManualRealisasiChange = (valStr: string) => {
    setCustomRealisasiStr((prev) => ({ ...prev, [selectedWeekNum]: valStr }));
    const val = parseFloat(valStr);
    const newRealisasi = isNaN(val) ? 0 : Math.max(0, Math.min(100, Math.round(val * 100) / 100));
    const newDev = Math.round((newRealisasi - activeTarget) * 100) / 100;

    const updatedAllWeeks = progressWeeks.map((w) => {
      if (w.mingguKe === selectedWeekNum) {
        return {
          ...w,
          bobotRealisasi: newRealisasi,
          deviasi: newDev,
        };
      }
      return w;
    });

    onUpdateWeeks(updatedAllWeeks);
  };

  // Reset Realisasi back to table divisions sum
  const handleResetRealisasiToTable = () => {
    setCustomRealisasiStr((prev) => {
      const copy = { ...prev };
      delete copy[selectedWeekNum];
      return copy;
    });
    const newDev = Math.round((totalSdMingguIni - activeTarget) * 100) / 100;

    const updatedAllWeeks = progressWeeks.map((w) => {
      if (w.mingguKe === selectedWeekNum) {
        return {
          ...w,
          bobotRealisasi: totalSdMingguIni,
          deviasi: newDev,
        };
      }
      return w;
    });

    onUpdateWeeks(updatedAllWeeks);
  };

  // Handler to adjust PRESTASI YANG DIRENCANAKAN (TARGET) manually
  const handleManualTargetChange = (valStr: string) => {
    setCustomTargetStr((prev) => ({ ...prev, [selectedWeekNum]: valStr }));
    const val = parseFloat(valStr);
    const newTarget = isNaN(val) ? 0 : Math.max(0, Math.min(100, Math.round(val * 100) / 100));
    const newDev = Math.round((activeRealisasi - newTarget) * 100) / 100;

    const updatedAllWeeks = progressWeeks.map((w) => {
      if (w.mingguKe === selectedWeekNum) {
        return {
          ...w,
          bobotRencana: newTarget,
          deviasi: newDev,
        };
      }
      return w;
    });

    onUpdateWeeks(updatedAllWeeks);
  };

  // Handler to adjust Bobot % of any division row
  const handleBobotTotalChange = (divisionId: string, valueStr: string) => {
    const val = parseFloat(valueStr);
    const newBobot = isNaN(val) ? 0 : Math.max(0, Math.round(val * 100) / 100);

    const updatedAllWeeks = progressWeeks.map((w) => {
      const currentDivs = w.divisions && w.divisions.length > 0 ? w.divisions : divisions;
      const updatedDivs = currentDivs.map((d) => {
        if (d.id === divisionId) {
          const sdIni = Math.min(newBobot, d.prestasiSdMingguIni);
          return {
            ...d,
            bobotTotal: newBobot,
            prestasiSdMingguIni: sdIni,
          };
        }
        return d;
      });
      return {
        ...w,
        divisions: updatedDivs,
      };
    });

    onUpdateWeeks(updatedAllWeeks);
  };

  // Add new division to either FISIK or MANAJEMEN category
  const handleAddDivision = (kategori: 'FISIK' | 'MANAJEMEN') => {
    if (!newUraianText.trim()) return;

    const newId = `div-${kategori.toLowerCase()}-${Date.now()}`;
    const newBobot = Math.max(0, Math.round((parseFloat(newBobotText) || 0) * 100) / 100);
    const uraianUpper = newUraianText.trim().toUpperCase();

    const updatedAllWeeks = progressWeeks.map((w) => {
      const currentDivs = w.divisions && w.divisions.length > 0 ? w.divisions : divisions;
      const fisik = currentDivs.filter((d) => d.kategori === 'FISIK');
      const manajemen = currentDivs.filter((d) => d.kategori === 'MANAJEMEN');

      const newItem: DivisionProgressItem = {
        id: newId,
        kode: '', // will be automatically set by renumberDivisions
        kategori,
        uraian: uraianUpper,
        bobotTotal: newBobot,
        prestasiMingguLalu: 0,
        prestasiMingguIni: 0,
        prestasiSdMingguIni: 0,
        materialRef: [uraianUpper],
      };

      const combined =
        kategori === 'FISIK'
          ? [...fisik, newItem, ...manajemen]
          : [...fisik, ...manajemen, newItem];

      const renumbered = renumberDivisions(combined);
      const newTotalSdIni = Math.min(
        100,
        Math.round(renumbered.reduce((s, d) => s + d.prestasiSdMingguIni, 0) * 100) / 100
      );

      return {
        ...w,
        bobotRealisasi: newTotalSdIni,
        deviasi: Math.round((newTotalSdIni - w.bobotRencana) * 100) / 100,
        divisions: renumbered,
      };
    });

    onUpdateWeeks(updatedAllWeeks);
    const nextRoman = toRoman(
      kategori === 'FISIK' ? fisikDivisions.length + 1 : manajemenDivisions.length + 1
    );
    setAddingCategory(null);
    setNewUraianText('');
    setNewBobotText('0.00');
    setSyncSuccessMsg(
      `Uraian pekerjaan "${uraianUpper}" berhasil ditambahkan dengan nomor Romawi otomatis: ${nextRoman}.`
    );
    setTimeout(() => setSyncSuccessMsg(null), 4000);
  };

  // Delete division from all weeks and renumber remaining items with Roman numerals
  const handleDeleteDivision = (divisionId: string) => {
    const itemToDelete = divisions.find((d) => d.id === divisionId);

    const updatedAllWeeks = progressWeeks.map((w) => {
      const currentDivs = w.divisions && w.divisions.length > 0 ? w.divisions : divisions;
      const filtered = currentDivs.filter((d) => d.id !== divisionId);
      const renumbered = renumberDivisions(filtered);
      const newTotalSdIni = Math.min(
        100,
        Math.round(renumbered.reduce((s, d) => s + d.prestasiSdMingguIni, 0) * 100) / 100
      );

      return {
        ...w,
        bobotRealisasi: newTotalSdIni,
        deviasi: Math.round((newTotalSdIni - w.bobotRencana) * 100) / 100,
        divisions: renumbered,
      };
    });

    onUpdateWeeks(updatedAllWeeks);
    setConfirmDeleteDivision(null);
    setSyncSuccessMsg(
      `Uraian pekerjaan "${itemToDelete?.uraian || ''}" berhasil dihapus. Nomor Romawi untuk pekerjaan lainnya telah otomatis diurutkan kembali.`
    );
    setTimeout(() => setSyncSuccessMsg(null), 4000);
  };

  // Save renamed division uraian across all weeks
  const handleSaveRename = (divisionId: string) => {
    if (!editingUraianText.trim()) return;
    const uraianUpper = editingUraianText.trim().toUpperCase();

    const updatedAllWeeks = progressWeeks.map((w) => {
      const currentDivs = w.divisions && w.divisions.length > 0 ? w.divisions : divisions;
      const updated = currentDivs.map((d) => {
        if (d.id === divisionId) {
          return { ...d, uraian: uraianUpper };
        }
        return d;
      });
      return {
        ...w,
        divisions: updated,
      };
    });

    onUpdateWeeks(updatedAllWeeks);
    setEditingUraianId(null);
    setEditingUraianText('');
    setSyncSuccessMsg(`Nama uraian pekerjaan berhasil diubah menjadi "${uraianUpper}".`);
    setTimeout(() => setSyncSuccessMsg(null), 3000);
  };

  // Helper to automatically balance surplus / deficit to exact 100,00%
  const handleAutoBalanceBobot = () => {
    const diff = Math.round((100 - roundedRawTotalBobot) * 100) / 100;
    if (Math.abs(diff) < 0.001) {
      setSyncSuccessMsg('Total Bobot sudah tepat 100,00%!');
      setTimeout(() => setSyncSuccessMsg(null), 3000);
      return;
    }

    // Adjust on the last division (e.g. BIAYA PENGELOLAAN)
    const updatedAllWeeks = progressWeeks.map((w) => {
      const currentDivs = w.divisions && w.divisions.length > 0 ? w.divisions : divisions;
      const targetDiv = currentDivs[currentDivs.length - 1];
      if (!targetDiv) return w;
      const newTargetBobot = Math.max(0, Math.round((targetDiv.bobotTotal + diff) * 100) / 100);

      const updatedDivs = currentDivs.map((d, idx) => {
        if (idx === currentDivs.length - 1) {
          return {
            ...d,
            bobotTotal: newTargetBobot,
            prestasiSdMingguIni: Math.min(newTargetBobot, d.prestasiSdMingguIni),
          };
        }
        return d;
      });

      return {
        ...w,
        divisions: updatedDivs,
      };
    });

    onUpdateWeeks(updatedAllWeeks);
    setSyncSuccessMsg(`Total Bobot berhasil diseimbangkan tepat 100,00% (penyesuaian ${diff > 0 ? '+' : ''}${formatNumber(diff, 2, 2)}% pada ${divisions[divisions.length - 1]?.uraian || 'divisi terakhir'}).`);
    setTimeout(() => setSyncSuccessMsg(null), 4000);
  };

  // Reset to default divisions
  const handleResetBobotDefault = () => {
    const defaultInitialized = DEFAULT_DIVISIONS.map((d) => ({
      ...d,
      prestasiMingguLalu: 0,
      prestasiMingguIni: 0,
      prestasiSdMingguIni: 0,
    }));
    const renumbered = renumberDivisions(defaultInitialized);

    const updatedAllWeeks = progressWeeks.map((w) => {
      return {
        ...w,
        divisions: renumbered,
      };
    });
    onUpdateWeeks(updatedAllWeeks);
    setSyncSuccessMsg('Daftar uraian pekerjaan dan bobot berhasil dikembalikan ke standar awal.');
    setTimeout(() => setSyncSuccessMsg(null), 4000);
  };

  const handlePrestasiChange = (divisionId: string, valueStr: string) => {
    const val = parseFloat(valueStr) || 0;

    // Calculate this week's updated divisions
    const updatedDivisions = divisions.map((d) => {
      if (d.id === divisionId) {
        const sdIni = Math.min(d.bobotTotal, Math.round((d.prestasiMingguLalu + val) * 100) / 100);
        return {
          ...d,
          prestasiMingguIni: val,
          prestasiSdMingguIni: sdIni,
        };
      }
      return d;
    });

    const newTotalSdIni = Math.min(100, Math.round(updatedDivisions.reduce((s, d) => s + d.prestasiSdMingguIni, 0) * 100) / 100);
    const newDev = Math.round((newTotalSdIni - currentWeek.bobotRencana) * 100) / 100;

    // Propagate forward to subsequent weeks (update their 'prestasiMingguLalu')
    const updatedAllWeeks = progressWeeks.map((w) => {
      if (w.mingguKe === selectedWeekNum) {
        return {
          ...w,
          bobotRealisasi: newTotalSdIni,
          deviasi: newDev,
          divisions: updatedDivisions,
        };
      } else if (w.mingguKe > selectedWeekNum) {
        // Update minggu lalu for subsequent weeks
        const nextDivs = (w.divisions || DEFAULT_DIVISIONS.map(d => ({ ...d, prestasiMingguLalu: 0, prestasiMingguIni: 0, prestasiSdMingguIni: 0 }))).map((nd) => {
          const matchedCurrent = updatedDivisions.find((ud) => ud.id === nd.id);
          const previousCumulative = matchedCurrent ? matchedCurrent.prestasiSdMingguIni : nd.prestasiMingguLalu;
          const sdIni = Math.min(nd.bobotTotal, Math.round((previousCumulative + nd.prestasiMingguIni) * 100) / 100);
          return {
            ...nd,
            prestasiMingguLalu: previousCumulative,
            prestasiSdMingguIni: sdIni,
          };
        });
        const nextTotal = Math.min(100, Math.round(nextDivs.reduce((s, d) => s + d.prestasiSdMingguIni, 0) * 100) / 100);
        return {
          ...w,
          bobotRealisasi: nextTotal,
          deviasi: Math.round((nextTotal - w.bobotRencana) * 100) / 100,
          divisions: nextDivs,
        };
      }
      return w;
    });

    onUpdateWeeks(updatedAllWeeks);
  };

  const handlePrestasiMingguLaluChange = (divisionId: string, valueStr: string) => {
    const val = parseFloat(valueStr) || 0;

    // Calculate this week's updated divisions with adjusted prestasiMingguLalu
    const updatedDivisions = divisions.map((d) => {
      if (d.id === divisionId) {
        const sdIni = Math.min(d.bobotTotal, Math.round((val + d.prestasiMingguIni) * 100) / 100);
        return {
          ...d,
          prestasiMingguLalu: val,
          prestasiSdMingguIni: sdIni,
        };
      }
      return d;
    });

    const newTotalSdIni = Math.min(100, Math.round(updatedDivisions.reduce((s, d) => s + d.prestasiSdMingguIni, 0) * 100) / 100);
    const newDev = Math.round((newTotalSdIni - currentWeek.bobotRencana) * 100) / 100;

    // Propagate forward to subsequent weeks
    const updatedAllWeeks = progressWeeks.map((w) => {
      if (w.mingguKe === selectedWeekNum) {
        return {
          ...w,
          bobotRealisasi: newTotalSdIni,
          deviasi: newDev,
          divisions: updatedDivisions,
        };
      } else if (w.mingguKe > selectedWeekNum) {
        const nextDivs = (w.divisions || DEFAULT_DIVISIONS.map(d => ({ ...d, prestasiMingguLalu: 0, prestasiMingguIni: 0, prestasiSdMingguIni: 0 }))).map((nd) => {
          const matchedCurrent = updatedDivisions.find((ud) => ud.id === nd.id);
          const previousCumulative = matchedCurrent ? matchedCurrent.prestasiSdMingguIni : nd.prestasiMingguLalu;
          const sdIni = Math.min(nd.bobotTotal, Math.round((previousCumulative + nd.prestasiMingguIni) * 100) / 100);
          return {
            ...nd,
            prestasiMingguLalu: previousCumulative,
            prestasiSdMingguIni: sdIni,
          };
        });
        const nextTotal = Math.min(100, Math.round(nextDivs.reduce((s, d) => s + d.prestasiSdMingguIni, 0) * 100) / 100);
        return {
          ...w,
          bobotRealisasi: nextTotal,
          deviasi: Math.round((nextTotal - w.bobotRencana) * 100) / 100,
          divisions: nextDivs,
        };
      }
      return w;
    });

    onUpdateWeeks(updatedAllWeeks);
  };

  const handleApplyAndSync = () => {
    onAutoGenerateFromProgress(selectedWeekNum);
    setSyncSuccessMsg(`Berhasil! Data Minggu ke-${selectedWeekNum} telah disinkronkan ke Absensi 7 Hari, Kwitansi Upah, Bon/Faktur Toko, SPB, BKU, BKT, BKB, dan Pajak.`);
    setTimeout(() => setSyncSuccessMsg(null), 5000);
  };

  const handleUpdatePhotosForCurrentWeek = (updatedPhotos: ProgressPhotoItem[]) => {
    const updatedAllWeeks = progressWeeks.map((w) => {
      if (w.mingguKe === selectedWeekNum) {
        return {
          ...w,
          photos: updatedPhotos,
        };
      }
      return w;
    });
    onUpdateWeeks(updatedAllWeeks);
  };

  // Weekly Date Range Handlers
  const handleStartDateChange = (newStartIso: string) => {
    if (!newStartIso) return;
    const sDate = new Date(`${newStartIso}T00:00:00`);
    const eDate = new Date(sDate.getTime() + 6 * 86400000);
    const newEndIso = eDate.toISOString().split('T')[0];

    const indShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const sParts = newStartIso.split('-');
    const eParts = newEndIso.split('-');
    const sDay = sParts[2];
    const eDay = eParts[2];
    const sMonth = indShort[parseInt(sParts[1], 10) - 1];
    const eMonth = indShort[parseInt(eParts[1], 10) - 1];
    const year = sParts[0];

    const formattedPeriode = `${sDay} ${sMonth} - ${eDay} ${eMonth} ${year}`;

    const updated = progressWeeks.map((w) => {
      if (w.mingguKe === selectedWeekNum) {
        return {
          ...w,
          startDate: newStartIso,
          endDate: newEndIso,
          periode: formattedPeriode,
        };
      }
      return w;
    });
    onUpdateWeeks(updated);
  };

  const handleEndDateChange = (newEndIso: string) => {
    if (!newEndIso) return;
    const sIso = weekResolved.startDate;
    const indShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const sParts = sIso.split('-');
    const eParts = newEndIso.split('-');
    const sDay = sParts[2];
    const eDay = eParts[2];
    const sMonth = indShort[parseInt(sParts[1], 10) - 1];
    const eMonth = indShort[parseInt(eParts[1], 10) - 1];
    const year = eParts[0];

    const formattedPeriode = `${sDay} ${sMonth} - ${eDay} ${eMonth} ${year}`;

    const updated = progressWeeks.map((w) => {
      if (w.mingguKe === selectedWeekNum) {
        return {
          ...w,
          startDate: sIso,
          endDate: newEndIso,
          periode: formattedPeriode,
        };
      }
      return w;
    });
    onUpdateWeeks(updated);
  };

  const handlePeriodeTextChange = (text: string) => {
    const updated = progressWeeks.map((w) => {
      if (w.mingguKe === selectedWeekNum) {
        return { ...w, periode: text };
      }
      return w;
    });
    onUpdateWeeks(updated);
  };

  const handleOpenAddTx = () => {
    setEditingTx(null);
    setTxFormError(null);
    const seq = currentWeekTransactions.length + 1;
    setTxFormData({
      tanggal: weekResolved.startDate,
      jenis: 'PENGELUARAN',
      uraian: `Belanja Material Tambahan Minggu Ke-${selectedWeekNum}`,
      noBukti: `M${selectedWeekNum}-${String(seq).padStart(2, '0')}/${schoolYear}`,
      nominal: 0,
      kategoriBiaya: 'Konstruksi',
    });
    setIsTxModalOpen(true);
  };

  const handleOpenEditTx = (tx: BkuTransaction) => {
    setEditingTx(tx);
    setTxFormError(null);

    let dateInput = weekResolved.startDate;
    if (tx.tanggalObj && tx.tanggalObj.includes('-')) {
      dateInput = tx.tanggalObj;
    } else if (tx.tanggal && tx.tanggal.includes('/')) {
      const [d, m, y] = tx.tanggal.split('/');
      dateInput = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    setTxFormData({
      tanggal: dateInput,
      jenis: tx.jenis,
      uraian: tx.uraian,
      noBukti: tx.noBukti === '-' ? '' : tx.noBukti,
      nominal: tx.jenis === 'PENERIMAAN' ? tx.penerimaan : tx.pengeluaran,
      kategoriBiaya: tx.kategoriBiaya || 'Konstruksi',
    });
    setIsTxModalOpen(true);
  };

  const handleSaveTx = (e: React.FormEvent) => {
    e.preventDefault();
    setTxFormError(null);

    if (!txFormData.uraian.trim()) {
      setTxFormError('Uraian transaksi tidak boleh kosong.');
      return;
    }

    if (!txFormData.nominal || txFormData.nominal <= 0) {
      setTxFormError('Nominal transaksi harus lebih dari Rp 0.');
      return;
    }

    // Tanggal mulai pencatatan jangan kurang dari tanggal yang di-input dari Laporan Mingguan & Bobot
    if (txFormData.tanggal < weekResolved.startDate) {
      setTxFormError(
        `Tanggal transaksi (${txFormData.tanggal}) tidak boleh kurang dari tanggal mulai Minggu Ke-${selectedWeekNum} (${weekResolved.startDateFormatted}).`
      );
      return;
    }

    const [y, m, d] = txFormData.tanggal.split('-');
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
          tanggalObj: txFormData.tanggal,
          bulan: bulanStr,
          jenis: txFormData.jenis,
          uraian: txFormData.uraian.trim(),
          noBukti: txFormData.noBukti.trim() || '-',
          penerimaan: txFormData.jenis === 'PENERIMAAN' ? txFormData.nominal : 0,
          pengeluaran: txFormData.jenis === 'PENGELUARAN' ? txFormData.nominal : 0,
          kategoriBiaya: txFormData.kategoriBiaya,
        });
      }
    } else {
      if (onAddTransaction) {
        onAddTransaction({
          tanggal: displayTanggal,
          tanggalObj: txFormData.tanggal,
          bulan: bulanStr,
          jenis: txFormData.jenis,
          uraian: txFormData.uraian.trim(),
          noBukti: txFormData.noBukti.trim() || '-',
          penerimaan: txFormData.jenis === 'PENERIMAAN' ? txFormData.nominal : 0,
          pengeluaran: txFormData.jenis === 'PENGELUARAN' ? txFormData.nominal : 0,
          kategoriBiaya: txFormData.kategoriBiaya,
        }, selectedWeekNum);
      }
    }

    setIsTxModalOpen(false);
  };

  const handleConfirmDeleteTx = () => {
    if (confirmDeleteTx && onDeleteTransaction) {
      onDeleteTransaction(confirmDeleteTx);
      setConfirmDeleteTx(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Laporan Mingguan & Rekapitulasi Bobot Fisik Bangunan
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Format resmi sesuai standar Dinas Pendidikan. Anda dapat menyesuaikan <strong>BOBOT %</strong> per pekerjaan dan input <strong>Prestasi Minggu Ini (%)</strong>. Total otomatis dihitung dan maksimal 100,00%.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Add Buttons */}
          <button
            type="button"
            onClick={() => {
              setAddingCategory('FISIK');
              setNewUraianText('');
              setNewBobotText('0.00');
            }}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-3 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Tambah uraian pekerjaan fisik baru"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>+ Pekerjaan Fisik</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAddingCategory('MANAJEMEN');
              setNewUraianText('');
              setNewBobotText('0.00');
            }}
            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Tambah rincian biaya manajemen baru"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>+ Biaya Manajemen</span>
          </button>

          {/* Button to toggle Adjust Bobot % */}
          <button
            type="button"
            onClick={() => setIsEditingBobotMaster(!isEditingBobotMaster)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer ${
              isEditingBobotMaster
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
            }`}
          >
            <Sliders className="w-4 h-4 text-amber-500" />
            <span>{isEditingBobotMaster ? 'Kunci Nilai Bobot %' : 'Sesuaikan Bobot %'}</span>
          </button>

          {isEditingBobotMaster && roundedRawTotalBobot !== 100 && (
            <button
              type="button"
              onClick={handleAutoBalanceBobot}
              title="Sesuaikan selisih otomatis agar pas 100,00%"
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Seimbangkan 100,00%</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleApplyAndSync}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            title="Sinkronkan otomatis progres minggu ini ke Kwitansi, SPB, Bon Toko, Upah, BKU, BKT, dan BKB"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Sinkronkan ke SPJ & Kas</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenPrintModal(selectedWeekNum)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Cetak Rekap Minggu {selectedWeekNum}</span>
          </button>
        </div>
      </div>

      {/* Week Selector Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Pilih Periode Minggu Kerja (14 Minggu):
          </span>
          <span className="text-xs font-semibold text-blue-600">
            Aktif: Minggu {currentWeek.mingguKe} ({currentWeek.periode || weekResolved.periodeText})
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {progressWeeks.map((w) => {
            const isSelected = selectedWeekNum === w.mingguKe;
            const hasPhotos = Boolean(w.photos && w.photos.length > 0);
            return (
              <button
                key={w.mingguKe}
                onClick={() => setSelectedWeekNum(w.mingguKe)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>M{w.mingguKe}</span>
                <span className="text-[10px] opacity-80">({w.bobotRealisasi}%)</span>
                {hasPhotos && (
                  <span
                    title={`${w.photos!.length} Foto dokumentasi tersimpan`}
                    className={`text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold ${
                      isSelected ? 'bg-blue-900 text-amber-300' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    <Camera className="w-2.5 h-2.5" />
                    <span>{w.photos!.length}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual Date Range Settings for Current Selected Week */}
      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-slate-50 p-4 rounded-xl border border-blue-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <span>Rentang Tanggal Minggu Ke-{selectedWeekNum}</span>
                <span className="text-[10px] text-blue-700 bg-blue-100/80 border border-blue-300 px-2 py-0.5 rounded-full font-extrabold normal-case">
                  Bisa Pilih Tanggal Manual
                </span>
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Pilih tanggal mulai & selesai. Tanggal ini terintegrasi otomatis ke Absen 7 Hari, Kwitansi Upah UK, Kwitansi Bahan Toko, SPB, Bon Toko, BKU, BKT, BKB, dan Pajak.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-300 shadow-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase">Mulai:</label>
              <input
                type="date"
                value={weekResolved.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="px-2.5 py-1 text-xs font-mono font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <span className="text-slate-400 font-extrabold text-xs">s.d</span>

            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase">Selesai:</label>
              <input
                type="date"
                value={weekResolved.endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="px-2.5 py-1 text-xs font-mono font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/90 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Teks Periode:</span>
            <input
              type="text"
              value={currentWeek.periode || weekResolved.periodeText}
              onChange={(e) => handlePeriodeTextChange(e.target.value)}
              placeholder="misal: 01 Jul - 07 Jul 2026"
              className="px-2.5 py-1 text-xs font-bold text-blue-900 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden min-w-[240px]"
            />
          </div>

          <div className="flex items-center gap-1.5 font-bold text-emerald-900 bg-emerald-100/80 border border-emerald-300 px-3 py-1 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>
              Otomatis memecah Absen 7 hari ({weekResolved.startDateFormatted} s.d {weekResolved.endDateFormatted}), SPJ & Buku Kas
            </span>
          </div>
        </div>

        {/* Success alert message if any (kept inside div 3 to preserve stable layout) */}
        {syncSuccessMsg && (
          <div className="p-3 bg-emerald-100/90 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-950 flex items-center justify-between gap-2.5 shadow-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 p-0.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Table: REKAPITULASI & PENCATATAN OTOMATIS TRANSAKSI (Div 4) */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-md ring-1 ring-slate-900/5 overflow-hidden">
        {/* Document Header Table Header */}
        <div className="p-6 text-center border-b border-slate-200 bg-slate-50/70 space-y-1">
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-900">
            REKAPITULASI LAPORAN PROGRES FISIK MINGGUAN
          </h3>
          <h4 className="text-xs font-bold uppercase text-slate-800">
            {school?.pekerjaan?.toUpperCase() || 'REVITALISASI SEKOLAH'}
          </h4>
          <h4 className="text-xs font-bold uppercase text-blue-900">
            {school?.namaSekolah || ''}
          </h4>
          <p className="text-[11px] font-semibold text-slate-600 uppercase">
            {school?.kabKota || ''} {school?.provinsi || ''} • PERIODE: {currentWeek.periode}
          </p>
        </div>

        {/* Edit Bobot Mode Banner */}
        {isEditingBobotMaster && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-bold">Mode Penyesuaian Bobot Pekerjaan Aktif</p>
                <p className="text-[11px] text-amber-800">
                  Anda dapat langsung mengubah persentase pada kolom <strong>BOBOT %</strong> di bawah sesuai dokumen RAB. Total otomatis dihitung dan maksimal 100,00%.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {roundedRawTotalBobot !== 100 && (
                <button
                  type="button"
                  onClick={handleAutoBalanceBobot}
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Seimbangkan Jadi 100,00%</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleResetBobotDefault}
                className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Reset Standar</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditingBobotMaster(false)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Kunci & Selesai
              </button>
            </div>
          </div>
        )}

        {/* Quick Action & Invariant Toolbar for Pencatatan Otomatis & Transaksi (Div 4) */}
        <div className="bg-slate-900 text-white px-5 py-3 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Pencatatan Otomatis dari Bobot: {currentWeek.bobotRealisasi || 0}%
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
              <AlertCircle className="w-3.5 h-3.5" />
              Tgl Mulai: ≥ {weekResolved.startDateFormatted}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-bold">
              <Calendar className="w-3.5 h-3.5 text-purple-300" />
              Upah & Honor (Perencana, Pengawas, Adm): Akhir Minggu ({weekResolved.endDateFormatted})
            </span>
            <span className="text-xs text-slate-300 font-mono">
              ({currentWeekTransactions.length} transaksi • {formatRupiah(totalPengeluaranWeek)})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddTx}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              title="Input transaksi kas/belanja baru secara manual"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Input Manual</span>
            </button>
            <button
              type="button"
              onClick={handleApplyAndSync}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              title="Pecah ulang otomatis dari inputan bobot minggu ini"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⚡ Pecah Otomatis</span>
            </button>
            <a
              href="#rekap-transaksi-mingguan"
              className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <span>Lihat Detail Transaksi ↓</span>
            </a>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0070c0] text-white font-bold text-center text-[11px] border border-slate-800">
                <th className="py-3 px-3 border border-slate-700 w-12">NO.</th>
                <th className="py-3 px-4 border border-slate-700 text-left">URAIAN PEKERJAAN</th>
                <th className={`py-3 px-3 border border-slate-700 w-32 ${isEditingBobotMaster ? 'bg-[#005a9e]' : ''}`}>
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <div className="flex items-center gap-1">
                      <span>BOBOT %</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingBobotMaster(!isEditingBobotMaster)}
                        title={isEditingBobotMaster ? 'Kunci nilai bobot' : 'Klik untuk menyesuaikan kolom Bobot %'}
                        className="p-0.5 text-amber-300 hover:text-white transition rounded cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[9px] font-normal text-blue-200">
                      {isEditingBobotMaster ? '(Bisa Diedit)' : '(Bisa Disesuaikan)'}
                    </span>
                  </div>
                </th>
                <th className="py-3 px-3 border border-slate-700 w-32 bg-[#005a9e]">
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span>PRESTASI MINGGU LALU BOBOT %</span>
                    <span className="text-[9px] font-normal text-amber-200">(Bisa Disesuaikan)</span>
                  </div>
                </th>
                <th className="py-3 px-3 border border-slate-700 w-32 bg-blue-700">PRESTASI MINGGU INI BOBOT % (INPUT)</th>
                <th className="py-3 px-3 border border-slate-700 w-32">PRESTASI S.D MINGGU INI BOBOT %</th>
              </tr>
            </thead>
            <tbody className="text-slate-900">
              {/* Row: REKAPITULASI Header */}
              <tr className="bg-slate-100 font-extrabold border-b border-slate-300">
                <td className="py-2 px-3 border border-slate-300 text-center"></td>
                <td colSpan={5} className="py-2 px-4 border border-slate-300 tracking-wider">
                  R E K A P I T U L A S I :
                </td>
              </tr>

              {/* Category: PEKERJAAN FISIK */}
              <tr className="bg-slate-100 font-bold border-b border-slate-300 text-blue-950">
                <td className="py-2.5 px-3 border border-slate-300 text-center font-bold text-slate-700">A.</td>
                <td className="py-2.5 px-4 border border-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold tracking-wide text-xs">PEKERJAAN FISIK</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingCategory('FISIK');
                        setNewUraianText('');
                        setNewBobotText('0.00');
                      }}
                      className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-xs transition cursor-pointer"
                      title="Tambah uraian pekerjaan fisik baru secara manual"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Pekerjaan Fisik</span>
                    </button>
                  </div>
                </td>
                <td colSpan={4} className="py-2.5 px-3 border border-slate-300 text-slate-500 text-[10px] text-right font-medium">
                  {fisikDivisions.length} Jenis Pekerjaan (I s/d {toRoman(fisikDivisions.length)})
                </td>
              </tr>

              {/* Fisik Items (Auto Roman Numerals I, II, III...) */}
              {fisikDivisions.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/40 transition border-b border-slate-200 group">
                  <td className="py-2 px-3 border border-slate-300 text-center font-bold text-slate-800 bg-slate-50/40">
                    {item.kode}
                  </td>
                  <td className="py-2 px-4 border border-slate-300 font-medium text-slate-900">
                    {editingUraianId === item.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          value={editingUraianText}
                          onChange={(e) => setEditingUraianText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(item.id);
                            if (e.key === 'Escape') setEditingUraianId(null);
                          }}
                          className="flex-1 px-2.5 py-1 text-xs uppercase font-medium bg-white border border-blue-400 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(item.id)}
                          className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                          title="Simpan perubahan nama"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUraianId(null)}
                          className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded cursor-pointer"
                          title="Batal"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="break-words">{item.uraian}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUraianId(item.id);
                              setEditingUraianText(item.uraian);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition"
                            title="Ubah teks uraian pekerjaan"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteDivision(item)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition"
                            title="Hapus uraian pekerjaan ini (nomor Romawi akan berurutan kembali otomatis)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className={`py-1.5 px-2 border border-slate-300 text-right ${isEditingBobotMaster ? 'bg-amber-50/60' : ''}`}>
                    {isEditingBobotMaster ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.bobotTotal}
                          onChange={(e) => handleBobotTotalChange(item.id, e.target.value)}
                          className="w-20 text-right font-mono font-bold text-amber-950 px-2 py-1 bg-white border border-amber-400 rounded focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        />
                        <span className="text-[10px] text-amber-700 font-semibold">%</span>
                      </div>
                    ) : (
                      <div
                        onClick={() => setIsEditingBobotMaster(true)}
                        className="group flex items-center justify-end gap-1 cursor-pointer hover:text-amber-800 transition py-0.5"
                        title="Klik untuk menyesuaikan bobot pekerjaan ini"
                      >
                        <span className="font-mono font-semibold text-slate-800 group-hover:text-amber-800">
                          {formatNumber(item.bobotTotal, 2, 2)}%
                        </span>
                        <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-amber-600 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300 text-right bg-amber-50/40">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={item.bobotTotal}
                      value={item.prestasiMingguLalu === 0 ? '' : item.prestasiMingguLalu}
                      onChange={(e) => handlePrestasiMingguLaluChange(item.id, e.target.value)}
                      placeholder="0,00"
                      className="w-full text-right font-mono font-medium text-amber-950 px-2 py-1 bg-white border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      title="Isi / sesuaikan nilai prestasi minggu lalu (Bobot %)"
                    />
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300 text-right bg-blue-50/60">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={item.bobotTotal}
                      value={item.prestasiMingguIni === 0 ? '' : item.prestasiMingguIni}
                      onChange={(e) => handlePrestasiChange(item.id, e.target.value)}
                      placeholder="0,00"
                      className="w-full text-right font-mono font-bold text-blue-900 px-2 py-1 bg-white border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    {item.prestasiMingguIni > 0 && (
                      <span
                        className="text-[9px] text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1 py-0.5 rounded font-bold block mt-1 text-center whitespace-nowrap"
                        title={`Pencatatan otomatis memecah belanja material & kas mulai ${weekResolved.startDateFormatted}`}
                      >
                        ⚡ Pecah ke Kas (≥ {weekResolved.startDateFormatted})
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 border border-slate-300 text-right font-mono font-bold text-slate-900">
                    {item.prestasiSdMingguIni > 0 ? formatNumber(item.prestasiSdMingguIni, 2, 2) : ''}
                  </td>
                </tr>
              ))}

              {/* Inline Add Row for PEKERJAAN FISIK */}
              {addingCategory === 'FISIK' && (
                <tr className="bg-blue-50/90 border-2 border-blue-400 animate-fade-in">
                  <td className="py-2 px-3 border border-blue-300 text-center font-bold text-blue-700 bg-blue-100/50">
                    <span className="text-xs">{toRoman(fisikDivisions.length + 1)}</span>
                    <span className="block text-[8px] font-normal text-blue-500">(Auto)</span>
                  </td>
                  <td className="py-2 px-4 border border-blue-300">
                    <div className="flex flex-col gap-1">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Ketik uraian pekerjaan fisik baru..."
                        value={newUraianText}
                        onChange={(e) => setNewUraianText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddDivision('FISIK');
                          if (e.key === 'Escape') setAddingCategory(null);
                        }}
                        className="w-full px-2.5 py-1 text-xs uppercase font-medium bg-white border border-blue-400 rounded focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      />
                      <span className="text-[10px] text-blue-700">
                        Nomor romawi otomatis: <strong>{toRoman(fisikDivisions.length + 1)}</strong> • Tekan Enter untuk simpan
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-2 border border-blue-300 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0.00"
                        value={newBobotText}
                        onChange={(e) => setNewBobotText(e.target.value)}
                        className="w-20 text-right font-mono font-bold text-blue-950 px-2 py-1 bg-white border border-blue-400 rounded focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      />
                      <span className="text-[10px] text-blue-700 font-semibold">%</span>
                    </div>
                  </td>
                  <td colSpan={3} className="py-2 px-3 border border-blue-300">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddDivision('FISIK')}
                        disabled={!newUraianText.trim()}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                          newUraianText.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingCategory(null)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium cursor-pointer transition"
                      >
                        Batal
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Category: RINCIAN BIAYA MANAJEMEN */}
              <tr className="bg-slate-100 font-bold border-b border-slate-300 text-indigo-950">
                <td className="py-2.5 px-3 border border-slate-300 text-center font-bold text-slate-700">B.</td>
                <td className="py-2.5 px-4 border border-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold tracking-wide text-xs">RINCIAN BIAYA MANAJEMEN</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingCategory('MANAJEMEN');
                        setNewUraianText('');
                        setNewBobotText('0.00');
                      }}
                      className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-xs transition cursor-pointer"
                      title="Tambah rincian biaya manajemen baru secara manual"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Biaya Manajemen</span>
                    </button>
                  </div>
                </td>
                <td colSpan={4} className="py-2.5 px-3 border border-slate-300 text-slate-500 text-[10px] text-right font-medium">
                  {manajemenDivisions.length} Jenis Biaya (I s/d {toRoman(manajemenDivisions.length)})
                </td>
              </tr>

              {/* Manajemen Items (Auto Roman Numerals I, II, III...) */}
              {manajemenDivisions.map((item) => (
                <tr key={item.id} className="hover:bg-indigo-50/40 transition border-b border-slate-200 group">
                  <td className="py-2 px-3 border border-slate-300 text-center font-bold text-slate-800 bg-slate-50/40">
                    {item.kode}
                  </td>
                  <td className="py-2 px-4 border border-slate-300 font-medium text-slate-900">
                    {editingUraianId === item.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          value={editingUraianText}
                          onChange={(e) => setEditingUraianText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(item.id);
                            if (e.key === 'Escape') setEditingUraianId(null);
                          }}
                          className="flex-1 px-2.5 py-1 text-xs uppercase font-medium bg-white border border-indigo-400 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(item.id)}
                          className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                          title="Simpan perubahan nama"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUraianId(null)}
                          className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded cursor-pointer"
                          title="Batal"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="break-words">{item.uraian}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUraianId(item.id);
                              setEditingUraianText(item.uraian);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer transition"
                            title="Ubah teks rincian biaya"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteDivision(item)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition"
                            title="Hapus rincian biaya ini (nomor Romawi akan berurutan kembali otomatis)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className={`py-1.5 px-2 border border-slate-300 text-right ${isEditingBobotMaster ? 'bg-amber-50/60' : ''}`}>
                    {isEditingBobotMaster ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.bobotTotal}
                          onChange={(e) => handleBobotTotalChange(item.id, e.target.value)}
                          className="w-20 text-right font-mono font-bold text-amber-950 px-2 py-1 bg-white border border-amber-400 rounded focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        />
                        <span className="text-[10px] text-amber-700 font-semibold">%</span>
                      </div>
                    ) : (
                      <div
                        onClick={() => setIsEditingBobotMaster(true)}
                        className="group flex items-center justify-end gap-1 cursor-pointer hover:text-amber-800 transition py-0.5"
                        title="Klik untuk menyesuaikan bobot pekerjaan ini"
                      >
                        <span className="font-mono font-semibold text-slate-800 group-hover:text-amber-800">
                          {formatNumber(item.bobotTotal, 2, 2)}%
                        </span>
                        <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-amber-600 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300 text-right bg-amber-50/40">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={item.bobotTotal}
                      value={item.prestasiMingguLalu === 0 ? '' : item.prestasiMingguLalu}
                      onChange={(e) => handlePrestasiMingguLaluChange(item.id, e.target.value)}
                      placeholder="0,00"
                      className="w-full text-right font-mono font-medium text-amber-950 px-2 py-1 bg-white border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      title="Isi / sesuaikan nilai prestasi minggu lalu (Bobot %)"
                    />
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300 text-right bg-blue-50/60">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={item.bobotTotal}
                      value={item.prestasiMingguIni === 0 ? '' : item.prestasiMingguIni}
                      onChange={(e) => handlePrestasiChange(item.id, e.target.value)}
                      placeholder="0,00"
                      className="w-full text-right font-mono font-bold text-indigo-900 px-2 py-1 bg-white border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                    {item.prestasiMingguIni > 0 && (
                      <span
                        className="text-[9px] text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1 py-0.5 rounded font-bold block mt-1 text-center whitespace-nowrap"
                        title={`Pencatatan otomatis memecah biaya manajemen & kas mulai ${weekResolved.startDateFormatted}`}
                      >
                        ⚡ Pecah ke Kas (≥ {weekResolved.startDateFormatted})
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 border border-slate-300 text-right font-mono font-bold text-slate-900">
                    {item.prestasiSdMingguIni > 0 ? formatNumber(item.prestasiSdMingguIni, 2, 2) : ''}
                  </td>
                </tr>
              ))}

              {/* Inline Add Row for RINCIAN BIAYA MANAJEMEN */}
              {addingCategory === 'MANAJEMEN' && (
                <tr className="bg-indigo-50/90 border-2 border-indigo-400 animate-fade-in">
                  <td className="py-2 px-3 border border-indigo-300 text-center font-bold text-indigo-700 bg-indigo-100/50">
                    <span className="text-xs">{toRoman(manajemenDivisions.length + 1)}</span>
                    <span className="block text-[8px] font-normal text-indigo-500">(Auto)</span>
                  </td>
                  <td className="py-2 px-4 border border-indigo-300">
                    <div className="flex flex-col gap-1">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Ketik rincian biaya manajemen baru..."
                        value={newUraianText}
                        onChange={(e) => setNewUraianText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddDivision('MANAJEMEN');
                          if (e.key === 'Escape') setAddingCategory(null);
                        }}
                        className="w-full px-2.5 py-1 text-xs uppercase font-medium bg-white border border-indigo-400 rounded focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                      />
                      <span className="text-[10px] text-indigo-700">
                        Nomor romawi otomatis: <strong>{toRoman(manajemenDivisions.length + 1)}</strong> • Tekan Enter untuk simpan
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-2 border border-indigo-300 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0.00"
                        value={newBobotText}
                        onChange={(e) => setNewBobotText(e.target.value)}
                        className="w-20 text-right font-mono font-bold text-indigo-950 px-2 py-1 bg-white border border-indigo-400 rounded focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                      />
                      <span className="text-[10px] text-indigo-700 font-semibold">%</span>
                    </div>
                  </td>
                  <td colSpan={3} className="py-2 px-3 border border-indigo-300">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddDivision('MANAJEMEN')}
                        disabled={!newUraianText.trim()}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                          newUraianText.trim() ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300 cursor-not-allowed'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingCategory(null)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium cursor-pointer transition"
                      >
                        Batal
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* TOTAL ROW - OTOMATIS TERHITUNG NAMUN TETAP MAKSIMAL DI 100,00% */}
              <tr className="bg-slate-100 font-black border-t-2 border-slate-400 text-slate-950">
                <td className="py-3 px-3 border border-slate-300 text-center"></td>
                <td className="py-3 px-4 border border-slate-300 text-right uppercase tracking-wider font-bold">
                  TOTAL
                </td>
                <td className="py-3 px-3 border border-slate-300 text-right font-mono bg-slate-50">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-extrabold text-blue-950">
                      {formatNumber(cappedTotalBobot, 2, 2)}%
                    </span>
                    {roundedRawTotalBobot > 100 ? (
                      <div className="flex flex-col items-end mt-0.5">
                        <span className="text-[9px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded leading-tight">
                          Maksimal 100,00% (Input: {formatNumber(roundedRawTotalBobot, 2, 2)}%)
                        </span>
                        <button
                          type="button"
                          onClick={handleAutoBalanceBobot}
                          className="text-[9px] text-blue-700 hover:text-blue-900 underline font-semibold mt-0.5 cursor-pointer"
                        >
                          Seimbangkan ke 100%
                        </button>
                      </div>
                    ) : roundedRawTotalBobot < 100 ? (
                      <span className="text-[9px] font-medium text-slate-500 mt-0.5">
                        (Sisa: {formatNumber(100 - roundedRawTotalBobot, 2, 2)}%)
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-emerald-700 mt-0.5">
                        ✓ Pas 100,00%
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3 border border-slate-300 text-right font-mono text-slate-700">
                  {totalMingguLalu > 0 ? `${formatNumber(totalMingguLalu, 2, 2)}%` : '-'}
                </td>
                <td className="py-3 px-3 border border-slate-300 text-right font-mono text-blue-900 bg-blue-100/70 font-extrabold">
                  {totalMingguIni > 0 ? `${formatNumber(totalMingguIni, 2, 2)}%` : '-'}
                </td>
                <td className="py-3 px-3 border border-slate-300 text-right font-mono text-slate-950 bg-slate-200/80 font-black">
                  {formatNumber(totalSdMingguIni, 2, 2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Status Table (Exact match to uploaded template bottom info) */}
        <div className="p-6 bg-slate-50 border-t border-slate-300 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Box 1: Keterangan (Prestasi Realisasi, Target & Deviasi) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <h5 className="font-bold text-slate-900 uppercase tracking-wide">
                  K E T E R A N G A N :
                </h5>
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  Realisasi & Target Dapat Disesuaikan Manual
                </span>
              </div>

              <div className="space-y-2.5 pt-0.5">
                {/* PRESTASI PELAKSANAAN (REALISASI) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 px-2 rounded-lg bg-slate-50/80 border border-slate-200/60">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-700 font-semibold uppercase text-[11px]">
                      PRESTASI PELAKSANAAN (REALISASI)
                    </span>
                    {Math.abs(activeRealisasi - totalSdMingguIni) > 0.001 && (
                      <button
                        type="button"
                        onClick={handleResetRealisasiToTable}
                        title={`Klik untuk menyamakan kembali dengan hitungan tabel (${formatNumber(totalSdMingguIni, 2)}%)`}
                        className="text-[10px] text-amber-700 hover:text-amber-900 bg-amber-100/80 hover:bg-amber-200 px-1.5 py-0.5 rounded cursor-pointer transition font-medium"
                      >
                        Reset ke Tabel ({formatNumber(totalSdMingguIni, 2)}%)
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    <span className="font-mono text-slate-500 font-bold">:</span>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={
                          customRealisasiStr[selectedWeekNum] !== undefined
                            ? customRealisasiStr[selectedWeekNum]
                            : String(activeRealisasi)
                        }
                        onChange={(e) => handleManualRealisasiChange(e.target.value.replace(',', '.'))}
                        title="Ubah manual persentase realisasi minggu ini jika diperlukan"
                        className="w-24 text-right font-mono font-bold text-slate-900 text-xs px-2 py-1 bg-white border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden shadow-2xs"
                      />
                      <span className="ml-1 font-mono font-bold text-slate-800 text-xs">%</span>
                    </div>
                  </div>
                </div>

                {/* PRESTASI YANG DIRENCANAKAN (TARGET) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1 px-2 rounded-lg bg-slate-50/80 border border-slate-200/60">
                  <span className="text-slate-700 font-semibold uppercase text-[11px]">
                    PRESTASI YANG DIRENCANAKAN (TARGET)
                  </span>
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    <span className="font-mono text-slate-500 font-bold">:</span>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={
                          customTargetStr[selectedWeekNum] !== undefined
                            ? customTargetStr[selectedWeekNum]
                            : String(activeTarget)
                        }
                        onChange={(e) => handleManualTargetChange(e.target.value.replace(',', '.'))}
                        title="Ubah manual persentase target rencana minggu ini"
                        className="w-24 text-right font-mono font-bold text-slate-900 text-xs px-2 py-1 bg-white border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-hidden shadow-2xs"
                      />
                      <span className="ml-1 font-mono font-bold text-slate-800 text-xs">%</span>
                    </div>
                  </div>
                </div>

                {/* LEBIH CEPAT DARI RENCANA / TERLAMBAT DARI RENCANA (OTOMATIS) */}
                <div
                  className={`flex items-center justify-between py-1.5 px-2 rounded-lg border transition ${
                    isFaster
                      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/90 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold uppercase text-[11px]">
                      {isFaster ? 'LEBIH CEPAT DARI RENCANA' : 'TERLAMBAT DARI RENCANA'}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                        isFaster
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}
                    >
                      Otomatis
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-black text-xs">
                    <span>:</span>
                    <span className="w-24 text-right">
                      {isFaster ? `+${formatNumber(deviasi, 2)}` : formatNumber(deviasi, 2)} %
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
              <h5 className="font-bold text-slate-900 uppercase border-b border-slate-100 pb-1">
                WAKTU PELAKSANAAN PEKERJAAN :
              </h5>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-600">RENCANA WAKTU PELAKSANAAN</span>
                  <span className="font-mono font-bold text-slate-900">: 112 HK (14 Minggu)</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-600">WAKTU YANG SUDAH DILAKSANAKAN</span>
                  <span className="font-mono font-semibold text-slate-700">: {currentWeek.mingguKe * 7} HK</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-t border-slate-100 pt-1">
                  <span className="text-slate-600">SISA WAKTU PELAKSANAAN</span>
                  <span className="font-mono font-bold text-slate-900">: {Math.max(0, 112 - currentWeek.mingguKe * 7)} HK</span>
                </div>
              </div>
            </div>
          </div>

          {/* Big Trigger & Auto-Sync Card */}
          <div className="p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-xl text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-left">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-[11px] font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Otomatisasi LPJ Terintegrasi Real-Time
              </div>
              <h4 className="text-sm sm:text-base font-bold text-white">
                Sinkronkan Minggu {currentWeek.mingguKe} ke Semua Dokumen LPJ
              </h4>
              <p className="text-xs text-slate-300">
                Menghasilkan otomatis: Absensi 7 Hari, Kwitansi Upah UK, Kwitansi Bahan Toko, SPB, Bon Toko, BKU, BKT, BKB, dan Pajak.
              </p>
            </div>

            <button
              onClick={handleApplyAndSync}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Terapkan & Buat Dokumen Otomatis</span>
            </button>
          </div>
        </div>

        {/* PENCATATAN OTOMATIS PECAHAN TRANSAKSI DARI BOBOT MINGGUAN (TERINTEGRASI DI DALAM KARTU LAPORAN MINGGUAN & BOBOT) */}
        <div id="rekap-transaksi-mingguan" className="border-t-2 border-slate-300 bg-white space-y-0 scroll-mt-6">
        {/* Section Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Receipt className="w-3 h-3" />
                Pencatatan Otomatis & SPJ Kas
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Tgl Mulai: {weekResolved.startDateFormatted}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Upah, Perencana, Pengawas & Adm: Akhir Minggu ({weekResolved.endDateFormatted})
              </span>
            </div>
            <h3 className="text-base font-bold flex items-center gap-2 text-white">
              <span>Hasil Pecahan Transaksi Otomatis Minggu Ke-{selectedWeekNum}</span>
              <span className="text-xs font-semibold text-slate-300 font-mono">
                ({weekResolved.startDateFormatted} s.d {weekResolved.endDateFormatted})
              </span>
            </h3>
            <p className="text-xs text-slate-300 max-w-3xl">
              Pencatatan otomatis memecah dari hasil inputan Laporan Mingguan & Bobot menjadi kwitansi pembelian material toko harian, upah kerja fisik, dan kas operasional. Anda juga dapat melakukan <strong>input manual, edit, dan hapus</strong> transaksi secara langsung.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddTx}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Input Transaksi Manual</span>
            </button>

            <button
              type="button"
              onClick={handleApplyAndSync}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition cursor-pointer"
              title="Pecah dan sinkronkan otomatis bobot minggu ini ke kwitansi, SPB, BKU, BKT, dan BKB"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Pecah Otomatis dari Bobot</span>
            </button>

            {onAutoGenerateAllWeeks && (
              <button
                type="button"
                onClick={onAutoGenerateAllWeeks}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
                title="Pecah otomatis seluruh 12-14 minggu sekaligus"
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Pecah Semua Minggu</span>
              </button>
            )}
          </div>
        </div>

        {/* Metric Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-200 bg-slate-50/70 border-b border-slate-200 text-xs">
          <div className="p-3.5 space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Prestasi Bobot Minggu Ini
            </span>
            <p className="text-base font-extrabold text-blue-900 font-mono">
              {formatNumber(currentWeek.bobotRealisasi || 0, 2)}%
            </p>
          </div>

          <div className="p-3.5 space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Pengeluaran Minggu Ini
            </span>
            <p className="text-base font-extrabold text-rose-700 font-mono">
              {formatRupiah(totalPengeluaranWeek)}
            </p>
          </div>

          <div className="p-3.5 space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Penerimaan / Kas Masuk
            </span>
            <p className="text-base font-extrabold text-emerald-700 font-mono">
              {formatRupiah(totalPenerimaanWeek)}
            </p>
          </div>

          <div className="p-3.5 space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Transaksi Tercatat
            </span>
            <p className="text-base font-extrabold text-slate-900 font-mono">
              {currentWeekTransactions.length} Transaksi
            </p>
          </div>
        </div>

        {/* Date Invariant Notice Bar */}
        <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-amber-950">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Ketentuan Pembayaran & Tanggal:</strong> Tanggal mulai transaksi kas tidak boleh kurang dari <strong>{weekResolved.startDateFormatted}</strong>. Pembayaran <strong>upah tukang, konsultan perencana, pengawas, dan administrasi</strong> dibayarkan setiap <strong>tanggal akhir minggu ({weekResolved.endDateFormatted})</strong>.
            </span>
          </div>
          <span className="text-amber-800 font-semibold text-[10px] bg-amber-100 px-2 py-0.5 rounded border border-amber-300 shrink-0">
            Terproteksi Otomatis
          </span>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          {currentWeekTransactions.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-bold text-slate-800">
                  Belum Ada Transaksi Pecahan Untuk Minggu Ke-{selectedWeekNum}
                </h4>
                <p className="text-xs text-slate-500">
                  Gunakan tombol <strong>"Pecah Otomatis dari Bobot"</strong> untuk menghasilkan kwitansi upah & material secara otomatis sesuai input bobot fisik ({formatNumber(currentWeek.bobotRealisasi || 0, 2)}%), atau klik <strong>"+ Input Transaksi Manual"</strong>.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleApplyAndSync}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Pecah Otomatis dari Bobot Minggu {selectedWeekNum}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddTx}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Input Manual</span>
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 text-center w-10">No</th>
                  <th className="py-2.5 px-3 w-28">Tanggal</th>
                  <th className="py-2.5 px-3 w-32">No. Bukti</th>
                  <th className="py-2.5 px-3 w-24">Jenis</th>
                  <th className="py-2.5 px-3 w-28">Kategori</th>
                  <th className="py-2.5 px-3">Uraian Transaksi</th>
                  <th className="py-2.5 px-3 text-right w-36">Nominal (Rp)</th>
                  <th className="py-2.5 px-3 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {currentWeekTransactions.map((tx, idx) => {
                  const isStartDate = tx.tanggal === weekResolved.startDateSlash || tx.tanggalObj === weekResolved.startDate;
                  const isEndDate = tx.tanggal === weekResolved.endDateSlash || tx.tanggalObj === weekResolved.endDate;
                  const isUpahHonorAdm = /upah|tukang|pekerja|perencana|pengawas|administrasi|pengelolaan/i.test(tx.uraian) || /uk\/|kons-|adm\//i.test(tx.noBukti || '');

                  return (
                    <tr key={tx.id || idx} className="hover:bg-slate-50/80 transition group">
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span>{tx.tanggal}</span>
                          {isStartDate && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 rounded" title="Tanggal Mulai Minggu Ini">
                              Mulai
                            </span>
                          )}
                          {isEndDate && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                isUpahHonorAdm
                                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                              title={isUpahHonorAdm ? "Dibayarkan pada Tanggal Akhir Minggu Sesuai Aturan" : "Tanggal Akhir Minggu"}
                            >
                              Akhir M{selectedWeekNum}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900 whitespace-nowrap">
                        {tx.noBukti}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.jenis === 'PENERIMAAN'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {tx.jenis}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        <span className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-medium">
                          {tx.kategoriBiaya || (tx.uraian.toLowerCase().includes('upah') ? 'Upah Tukang' : 'Material')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium leading-relaxed max-w-md">
                        {tx.uraian}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={tx.jenis === 'PENERIMAAN' ? 'text-emerald-700' : 'text-slate-900'}>
                          {formatRupiah(tx.pengeluaran || tx.penerimaan)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTx(tx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer shadow-2xs"
                            title="Edit data transaksi ini"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTx(tx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer shadow-2xs"
                            title="Hapus transaksi ini dari pembukuan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900">
                  <td colSpan={6} className="py-2.5 px-3 text-right">
                    Total Pengeluaran Minggu Ke-{selectedWeekNum}:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                    {formatRupiah(totalPengeluaranWeek)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
        </div>
      </div>

      {/* DOKUMENTASI FOTO PROGRES MINGGUAN */}
      <WeeklyPhotoDocumentation
        week={currentWeek}
        school={school}
        onUpdatePhotos={handleUpdatePhotosForCurrentWeek}
        onOpenPrintModal={onOpenPrintModal}
      />

      {/* Modal Input & Edit Transaksi Manual Minggu Ini */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  {editingTx ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingTx ? `Edit Transaksi Minggu Ke-${selectedWeekNum}` : `Input Transaksi Manual Minggu Ke-${selectedWeekNum}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tersinkronisasi langsung ke BKU, Kwitansi, SPB, dan Buku Kas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTxModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {txFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="font-semibold">{txFormError}</p>
              </div>
            )}

            <form onSubmit={handleSaveTx} className="space-y-3.5 text-xs">
              {/* Preset Cepat Tanggal & Kategori */}
              <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Pilih Preset Cepat Transaksi Minggu Ke-{selectedWeekNum}:
                </span>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTxFormData({
                        ...txFormData,
                        tanggal: weekResolved.endDate,
                        jenis: 'PENGELUARAN',
                        kategoriBiaya: 'Konstruksi',
                        noBukti: `UK/${selectedWeekNum < 10 ? '0' + selectedWeekNum : selectedWeekNum}/${schoolYear}`,
                        uraian: `Pembayaran Lunas Upah Tukang & Pekerja Minggu Ke-${selectedWeekNum}`,
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Dibayarkan setiap tanggal akhir minggu"
                  >
                    <span>👷 Upah Tukang (Akhir Minggu)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxFormData({
                        ...txFormData,
                        tanggal: weekResolved.endDate,
                        jenis: 'PENGELUARAN',
                        kategoriBiaya: 'Perencanaan_Pengelolaan',
                        noBukti: `KONS-P/${selectedWeekNum < 10 ? '0' + selectedWeekNum : selectedWeekNum}/${schoolYear}`,
                        uraian: `Pembayaran Honorarium Jasa Perencana Teknis Minggu Ke-${selectedWeekNum}`,
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Dibayarkan setiap tanggal akhir minggu"
                  >
                    <span>📐 Perencana (Akhir Minggu)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxFormData({
                        ...txFormData,
                        tanggal: weekResolved.endDate,
                        jenis: 'PENGELUARAN',
                        kategoriBiaya: 'Perencanaan_Pengelolaan',
                        noBukti: `KONS-W/${selectedWeekNum < 10 ? '0' + selectedWeekNum : selectedWeekNum}/${schoolYear}`,
                        uraian: `Pembayaran Honorarium Jasa Pengawas Lapangan Minggu Ke-${selectedWeekNum}`,
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Dibayarkan setiap tanggal akhir minggu"
                  >
                    <span>🔍 Pengawas (Akhir Minggu)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxFormData({
                        ...txFormData,
                        tanggal: weekResolved.endDate,
                        jenis: 'PENGELUARAN',
                        kategoriBiaya: 'Perencanaan_Pengelolaan',
                        noBukti: `ADM/${selectedWeekNum < 10 ? '0' + selectedWeekNum : selectedWeekNum}/${schoolYear}`,
                        uraian: `Pembayaran Biaya Pengelolaan Administrasi LPJ Minggu Ke-${selectedWeekNum}`,
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Dibayarkan setiap tanggal akhir minggu"
                  >
                    <span>📑 Administrasi (Akhir Minggu)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxFormData({
                        ...txFormData,
                        tanggal: weekResolved.startDate,
                        jenis: 'PENGELUARAN',
                        kategoriBiaya: 'Konstruksi',
                        noBukti: `M${selectedWeekNum}-01/${schoolYear}`,
                        uraian: `Belanja Material & Bahan Toko Minggu Ke-${selectedWeekNum}`,
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Belanja material harian mulai dari awal minggu"
                  >
                    <span>🧱 Belanja Toko (Mulai Minggu)</span>
                  </button>
                </div>
              </div>

              {/* Tanggal with Minimum Date Protection */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 block">
                    Tanggal Transaksi <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTxFormData({ ...txFormData, tanggal: weekResolved.startDate })}
                      className="text-[10px] text-blue-700 hover:underline font-bold cursor-pointer"
                    >
                      Set Awal ({weekResolved.startDateFormatted})
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setTxFormData({ ...txFormData, tanggal: weekResolved.endDate })}
                      className="text-[10px] text-purple-700 hover:underline font-bold cursor-pointer"
                    >
                      Set Akhir ({weekResolved.endDateFormatted})
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  min={weekResolved.startDate}
                  value={txFormData.tanggal}
                  onChange={(e) => setTxFormData({ ...txFormData, tanggal: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
                <div className="text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 mt-1 space-y-0.5">
                  <p className="flex items-center gap-1 text-amber-800 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Tanggal minimal: <strong>{weekResolved.startDateFormatted}</strong>.</span>
                  </p>
                  <p className="flex items-center gap-1 text-purple-800 font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Upah tukang, perencana, pengawas, dan administrasi dibayarkan pada <strong>tanggal akhir minggu ({weekResolved.endDateFormatted})</strong>.</span>
                  </p>
                </div>
              </div>

              {/* Jenis Transaksi */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Jenis Transaksi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTxFormData({ ...txFormData, jenis: 'PENGELUARAN' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      txFormData.jenis === 'PENGELUARAN'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>🔴 Pengeluaran (Belanja / Kas Keluar)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxFormData({ ...txFormData, jenis: 'PENERIMAAN' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      txFormData.jenis === 'PENERIMAAN'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>🟢 Penerimaan (Kas Masuk / Bank)</span>
                  </button>
                </div>
              </div>

              {/* No Bukti & Kategori */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">No. Bukti / Kuitansi</label>
                  <input
                    type="text"
                    value={txFormData.noBukti}
                    onChange={(e) => setTxFormData({ ...txFormData, noBukti: e.target.value })}
                    placeholder="misal: M1-01/2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Kategori Biaya</label>
                  <select
                    value={txFormData.kategoriBiaya}
                    onChange={(e) => setTxFormData({ ...txFormData, kategoriBiaya: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  >
                    <option value="Konstruksi">Pekerjaan Fisik Konstruksi</option>
                    <option value="Material">Pembelian Bahan Bangunan</option>
                    <option value="Upah">Upah Tukang & Pekerja</option>
                    <option value="Perabot">Perabot & Mebeler</option>
                    <option value="Operasional">Persiapan & Operasional</option>
                  </select>
                </div>
              </div>

              {/* Uraian */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Uraian Transaksi <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={txFormData.uraian}
                  onChange={(e) => setTxFormData({ ...txFormData, uraian: e.target.value })}
                  placeholder="Keterangan lengkap transaksi..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              {/* Nominal */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">
                  Nominal Transaksi (Rp) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={txFormData.nominal || ''}
                    onChange={(e) => setTxFormData({ ...txFormData, nominal: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                </div>
                {txFormData.nominal > 0 && (
                  <p className="text-[11px] font-mono font-bold text-blue-700 pt-0.5">
                    Preview: {formatRupiah(txFormData.nominal)}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingTx ? 'Simpan Perubahan' : 'Tambahkan Transaksi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Transaction */}
      {confirmDeleteTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 text-red-600 rounded-full flex-shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Transaksi Ini?
                </h3>
                <p className="text-xs text-slate-500">
                  Transaksi akan dihapus dari BKU, Buku Pembantu Kas, dan SPJ.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">No. Bukti:</span>
                <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {confirmDeleteTx.noBukti}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Tanggal:</span>
                <span className="font-mono font-semibold text-slate-800">{confirmDeleteTx.tanggal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Nominal:</span>
                <span className="font-mono font-extrabold text-rose-700">
                  {formatRupiah(confirmDeleteTx.pengeluaran || confirmDeleteTx.penerimaan)}
                </span>
              </div>
              <div className="pt-1 border-t border-slate-200">
                <p className="text-slate-700 font-medium line-clamp-2">{confirmDeleteTx.uraian}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTx(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTx}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Transaksi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Division Item */}
      {confirmDeleteDivision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 text-red-600 rounded-full flex-shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Uraian Pekerjaan?
                </h3>
                <p className="text-xs text-slate-500">
                  Uraian ini akan dihapus dari seluruh 14 minggu laporan.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Uraian Pekerjaan:</span>
                <span className="font-bold text-slate-700 bg-slate-200/70 px-2 py-0.5 rounded text-[11px]">
                  Nomor {confirmDeleteDivision.kode}
                </span>
              </div>
              <p className="font-extrabold text-slate-900 text-sm">
                {confirmDeleteDivision.uraian}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                <span>Kategori: <strong>{confirmDeleteDivision.kategori === 'FISIK' ? 'Pekerjaan Fisik' : 'Rincian Biaya Manajemen'}</strong></span>
                <span>Bobot: <strong>{formatNumber(confirmDeleteDivision.bobotTotal, 2, 2)}%</strong></span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-blue-950">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Penomoran Romawi Otomatis
              </p>
              <p className="text-blue-800 leading-relaxed">
                Setelah dihapus, seluruh nomor Romawi (I, II, III...) untuk pekerjaan lainnya akan otomatis diurutkan kembali tanpa celah. Total bobot otomatis dihitung ulang.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteDivision(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDivision(confirmDeleteDivision.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
