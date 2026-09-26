import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  SchoolMasterData,
  RpdItem,
  WorkerItem,
  StoreVendor,
  WeeklyWageReport,
  KwitansiDocument,
  BkuTransaction,
  BkbTransaction,
  ProjectProgressWeek,
  AppStateData,
} from './types';
import {
  calculateBkuFromTransactions,
  calculateBktFromBku,
  generateTaxesFromKwitansi,
} from './services/autoGeneratorService';
import {
  SchoolTenant,
  DEFAULT_PRESET_TENANTS,
  PRESET_SDN1_MUARA_DUA,
  createSchoolStateForTenant,
} from './data/tenantPresets';
import {
  getAllSchoolTenants,
  getStoredActiveTenantId,
  setStoredActiveTenantId,
  getGlobalActiveTenantId,
  loadSchoolTenantAppState,
  saveSchoolTenantAppState,
  registerNewSchoolTenant,
  deleteSchoolTenant,
} from './services/schoolTenantService';
import { getMonthFromPeriodString, resolveWeekDates } from './utils/monthHelper';
import { firestoreDatabaseId } from './services/firebase';

import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { MasterDataForm } from './components/MasterDataForm';
import { RpdManager } from './components/RpdManager';
import { WeeklyProgressManager } from './components/WeeklyProgressManager';
import { BkuManager } from './components/BkuManager';
import { BktManager } from './components/BktManager';
import { BkbManager } from './components/BkbManager';
import { TaxManager } from './components/TaxManager';
import { KwitansiManager } from './components/KwitansiManager';
import { WageManager } from './components/WageManager';
import { StoreVendorManager } from './components/StoreVendorManager';
import { RealSchoolDataManager } from './components/RealSchoolDataManager';
import { PrintDocumentViewer } from './components/PrintDocumentViewer';
import { QuickReceiptModal } from './components/QuickReceiptModal';
import { SchoolTenantPortalModal } from './components/SchoolTenantPortalModal';
import { CheckCircle2, Database, ShieldAlert, Sparkles, X } from 'lucide-react';
import { defaultRealSchoolData } from './data/realSchoolData';
import { RealSchoolData, RpdKategori } from './types';

export default function App() {
  // Multi-Tenant States
  const [tenants, setTenants] = useState<SchoolTenant[]>(DEFAULT_PRESET_TENANTS);
  const [currentTenant, setCurrentTenant] = useState<SchoolTenant>(() => {
    const savedId = getStoredActiveTenantId();
    const found = DEFAULT_PRESET_TENANTS.find((t) => t.id === savedId);
    return found || PRESET_SDN1_MUARA_DUA;
  });
  const [isSchoolPortalOpen, setIsSchoolPortalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedText, setLastSyncedText] = useState('Otomatis');
  const [switchNotification, setSwitchNotification] = useState<string | null>(null);

  // App State per Tenant
  const [appState, setAppState] = useState<AppStateData>(() =>
    createSchoolStateForTenant(PRESET_SDN1_MUARA_DUA, 'full')
  );
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printDocType, setPrintDocType] = useState<string>('ALL');
  const [printMonth, setPrintMonth] = useState<string | undefined>(undefined);
  const [printWeekNum, setPrintWeekNum] = useState<number | undefined>(undefined);
  const [printKwitansiId, setPrintKwitansiId] = useState<string | undefined>(undefined);

  // Quick Receipt modal state
  const [isQuickReceiptOpen, setIsQuickReceiptOpen] = useState(false);

  // Debounce ref and protection flags
  const saveTimeoutRef = useRef<any>(null);
  const isLoadedRef = useRef(false);
  const isDirtyRef = useRef(false);

  // 1. Initial Load of Tenants and School Data from Cloud Firestore
  // CRITICAL: Prioritizes existing Cloud Firestore documents so data from previous deploys/publishes is never lost!
  useEffect(() => {
    let isMounted = true;

    async function initializeTenantData() {
      try {
        const tenantList = await getAllSchoolTenants();
        if (!isMounted) return;
        setTenants(tenantList);

        // Check global active school pointer from Firestore first, then local storage, then fallback
        let targetTenant: SchoolTenant | undefined;
        const globalActiveId = await getGlobalActiveTenantId();
        if (globalActiveId) {
          targetTenant = tenantList.find((t) => t.id === globalActiveId);
        }

        if (!targetTenant) {
          const savedId = getStoredActiveTenantId();
          targetTenant = tenantList.find((t) => t.id === savedId);
        }

        const activeT = targetTenant || tenantList[0] || PRESET_SDN1_MUARA_DUA;
        setCurrentTenant(activeT);
        setStoredActiveTenantId(activeT.id);

        // Load isolated school state from Firestore
        const loaded = await loadSchoolTenantAppState(activeT);
        if (!isMounted) return;

        setAppState(loaded.state);
        isLoadedRef.current = true;
        isDirtyRef.current = false; // Initial load is clean, never dirty!
        setIsInitialLoading(false);
        setLastSyncedText(
          loaded.source === 'cloud'
            ? 'Cloud Firestore'
            : loaded.source === 'cache'
            ? 'Memori Offline'
            : 'Template Awal'
        );
      } catch (err) {
        console.error('Initialization error:', err);
        if (isMounted) setIsInitialLoading(false);
      }
    }

    initializeTenantData();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Real-time Cloud Auto-Save on state change (Debounced to Firestore)
  // CRITICAL: NEVER auto-save unless data has been successfully loaded AND user has explicitly modified it!
  useEffect(() => {
    if (!isLoadedRef.current || !isDirtyRef.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSyncing(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const ok = await saveSchoolTenantAppState(currentTenant.id, appState);
        setIsSyncing(false);
        isDirtyRef.current = false;
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
        if (ok) {
          setLastSyncedText(`Tersimpan ${timeStr}`);
        } else {
          setLastSyncedText(`Tersimpan Offline ${timeStr}`);
        }
      } catch (err) {
        console.warn('Auto-save notice:', err);
        setIsSyncing(false);
        setLastSyncedText('Tersimpan Offline');
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [appState, currentTenant.id]);

  // Handle switching to a different school database
  const handleSelectTenant = async (targetTenant: SchoolTenant) => {
    if (targetTenant.id === currentTenant.id) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    isDirtyRef.current = false;
    isLoadedRef.current = false;
    setIsSyncing(true);
    setStoredActiveTenantId(targetTenant.id);
    setCurrentTenant(targetTenant);

    try {
      const loaded = await loadSchoolTenantAppState(targetTenant);
      setAppState(loaded.state);
      isLoadedRef.current = true;
      isDirtyRef.current = false;
      setIsSyncing(false);
      setLastSyncedText(
        loaded.source === 'cloud'
          ? 'Cloud Firestore'
          : loaded.source === 'cache'
          ? 'Memori Offline'
          : 'Template Awal'
      );
      setSwitchNotification(`Berhasil beralih ke database ${targetTenant.namaSekolah}. Data terisolasi aman.`);
      setTimeout(() => setSwitchNotification(null), 5000);
    } catch (err) {
      console.error('Error switching tenant:', err);
      setIsSyncing(false);
    }
  };

  // Handle registering a new school
  const handleRegisterNewSchool = async (data: {
    namaSekolah: string;
    npsn: string;
    jenjang: 'SD' | 'SMP' | 'SMA' | 'SMK';
    kabKota: string;
    provinsi: string;
    email: string;
    password?: string;
    templateType: 'full' | 'blank';
  }) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    isDirtyRef.current = false;
    isLoadedRef.current = false;
    setIsSyncing(true);
    const result = await registerNewSchoolTenant(data);
    setTenants((prev) => [...prev, result.tenant]);
    setCurrentTenant(result.tenant);
    setAppState(result.state);
    isLoadedRef.current = true;
    isDirtyRef.current = false;
    setIsSyncing(false);
    setLastSyncedText('Database Baru Dibuat');
    setSwitchNotification(`Database baru untuk ${result.tenant.namaSekolah} berhasil dibuat di Cloud Firestore!`);
    setTimeout(() => setSwitchNotification(null), 6000);

    try {
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    } catch {}
  };

  // Handle deleting a school database
  const handleDeleteTenant = async (tenantToDelete: SchoolTenant) => {
    if (tenants.length <= 1) {
      alert('Tidak dapat menghapus sekolah ini karena minimal harus ada 1 database sekolah di dalam aplikasi.');
      return;
    }

    if (
      !confirm(
        `Apakah Anda yakin ingin MENGHAPUS PERMANEN database sekolah:\n"${tenantToDelete.namaSekolah}" (NPSN: ${tenantToDelete.npsn})?\n\nSeluruh data LPJ, RPD, Kwitansi, dan Buku Kas sekolah ini akan dihapus.`
      )
    ) {
      return;
    }

    setIsSyncing(true);
    await deleteSchoolTenant(tenantToDelete.id);

    const updatedTenants = tenants.filter((t) => t.id !== tenantToDelete.id);
    setTenants(updatedTenants);

    if (tenantToDelete.id === currentTenant.id) {
      const nextTenant = updatedTenants[0];
      await handleSelectTenant(nextTenant);
    } else {
      setIsSyncing(false);
    }

    setSwitchNotification(`Database sekolah ${tenantToDelete.namaSekolah} berhasil dihapus.`);
    setTimeout(() => setSwitchNotification(null), 5000);
  };

  // Manual save trigger for instant user peace of mind
  const handleManualSaveNow = async () => {
    setIsSyncing(true);
    try {
      const ok = await saveSchoolTenantAppState(currentTenant.id, appState);
      setIsSyncing(false);
      isDirtyRef.current = false;
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
      if (ok) {
        setLastSyncedText(`Tersimpan ${timeStr}`);
        setSwitchNotification(`Data ${currentTenant.namaSekolah} berhasil disimpan permanen ke Google Cloud Firestore.`);
      } else {
        setLastSyncedText(`Tersimpan Offline ${timeStr}`);
        setSwitchNotification(`Data tersimpan aman di memori lokal perangkat. Akan otomatis tersinkron ke Cloud saat jaringan terhubung.`);
      }
      setTimeout(() => setSwitchNotification(null), 4000);
    } catch (err) {
      console.warn('Manual save notice:', err);
      setIsSyncing(false);
      setLastSyncedText('Tersimpan Offline');
    }
  };

  // Derived calculations
  const bkuList = useMemo(() => {
    return calculateBkuFromTransactions(
      appState.kwitansiList,
      appState.school,
      appState.manualBkuTransactions,
      appState.progressWeeks,
      appState.deletedBkuIds || []
    );
  }, [
    appState.kwitansiList,
    appState.school,
    appState.manualBkuTransactions,
    appState.progressWeeks,
    appState.deletedBkuIds,
  ]);

  const bktList = useMemo(() => {
    return calculateBktFromBku(bkuList);
  }, [bkuList]);

  const taxRecords = useMemo(() => {
    return generateTaxesFromKwitansi(appState.kwitansiList);
  }, [appState.kwitansiList]);

  // Handlers
  const handleAddManualBku = (tx: Omit<BkuTransaction, 'id'>, weekNum?: number) => {
    const newTxId = `bku-manual-${Date.now()}`;
    const newTx: BkuTransaction = {
      ...tx,
      id: newTxId,
    };

    // If expenditure, also register corresponding Kwitansi so SPJ, BKU, and Bon Toko remain unified
    let newKw: KwitansiDocument | null = null;
    if (tx.jenis === 'PENGELUARAN' && tx.pengeluaran > 0) {
      const yearStr = appState.school.tahunAnggaran?.trim() || '2026';
      newKw = {
        id: `kw-manual-${Date.now()}`,
        noBukti: tx.noBukti || `MANUAL-${Date.now().toString().slice(-4)}`,
        noSpb: `SPB-${tx.noBukti || Date.now().toString().slice(-4)}`,
        tipe: tx.uraian.toLowerCase().includes('upah') ? 'UPAH' : 'MATERIAL',
        tanggal: tx.tanggal,
        tanggalFormatted: tx.tanggal,
        bulan: tx.bulan,
        uraian: tx.uraian,
        penerimaNama: 'Penerima Manual',
        penerimaPekerjaan: 'Penyedia / Pekerja',
        penerimaAlamat: appState.school.kabKota,
        nominal: tx.pengeluaran,
        items: [{ namaBarang: tx.uraian, volume: 1, satuan: 'Kegiatan', hargaSatuan: tx.pengeluaran, jumlah: tx.pengeluaran }],
        isPpn: false,
        isPph22: false,
        isPph23: false,
        ppnAmount: 0,
        pph22Amount: 0,
        pph23Amount: 0,
        kategoriBiayaPajak: (tx.kategoriBiaya as 'Konstruksi' | 'Perabot' | 'Peralatan' | 'Perencanaan_Pengelolaan') || 'Konstruksi',
        mingguKeRef: weekNum,
      };
      if (newKw) {
        newTx.kwitansiIdRef = newKw.id;
      }
    }

    isDirtyRef.current = true;
    setAppState((prev) => ({
      ...prev,
      kwitansiList: newKw ? [newKw, ...prev.kwitansiList] : prev.kwitansiList,
      manualBkuTransactions: [...(prev.manualBkuTransactions || []), newTx],
    }));
  };

  const handleUpdateBku = (updatedTx: BkuTransaction) => {
    isDirtyRef.current = true;
    setAppState((prev) => {
      // 1. If linked to kwitansi, sync kwitansi
      let updatedKwitansi = prev.kwitansiList;
      if (updatedTx.kwitansiIdRef) {
        updatedKwitansi = prev.kwitansiList.map((kw) => {
          if (kw.id === updatedTx.kwitansiIdRef) {
            return {
              ...kw,
              tanggal: updatedTx.tanggal,
              tanggalFormatted: updatedTx.tanggal,
              bulan: updatedTx.bulan,
              uraian: updatedTx.uraian,
              noBukti: updatedTx.noBukti,
              nominal: updatedTx.pengeluaran || updatedTx.penerimaan,
            };
          }
          return kw;
        });
      }

      // 2. Update or upsert into manualBkuTransactions
      const exists = (prev.manualBkuTransactions || []).some((m) => m.id === updatedTx.id);
      const updatedManual = exists
        ? (prev.manualBkuTransactions || []).map((m) => (m.id === updatedTx.id ? updatedTx : m))
        : [...(prev.manualBkuTransactions || []), updatedTx];

      return {
        ...prev,
        kwitansiList: updatedKwitansi,
        manualBkuTransactions: updatedManual,
      };
    });
  };

  const handleDeleteBku = (txToDelete: BkuTransaction) => {
    isDirtyRef.current = true;
    setAppState((prev) => {
      let updatedKwitansi = prev.kwitansiList;
      if (txToDelete.kwitansiIdRef) {
        updatedKwitansi = prev.kwitansiList.filter((kw) => kw.id !== txToDelete.kwitansiIdRef);
      }

      const updatedManual = (prev.manualBkuTransactions || []).filter((m) => m.id !== txToDelete.id);
      const updatedDeletedIds = Array.from(
        new Set([...(prev.deletedBkuIds || []), txToDelete.id, txToDelete.kwitansiIdRef || ''])
      ).filter(Boolean);

      return {
        ...prev,
        kwitansiList: updatedKwitansi,
        manualBkuTransactions: updatedManual,
        deletedBkuIds: updatedDeletedIds,
      };
    });
  };

  // Handlers
  const handleUpdateSchool = (updated: SchoolMasterData) => {
    isDirtyRef.current = true;
    setAppState((prev) => ({ ...prev, school: updated }));
  };

  const handleUpdateRpd = (updatedItems: RpdItem[]) => {
    isDirtyRef.current = true;
    setAppState((prev) => ({ ...prev, rpdItems: updatedItems }));
  };

  const handleUpdateProgressWeeks = (updatedWeeks: ProjectProgressWeek[]) => {
    isDirtyRef.current = true;
    setAppState((prev) => ({ ...prev, progressWeeks: updatedWeeks }));
  };

  const handleUpdateWorkers = (updatedWorkers: WorkerItem[]) => {
    isDirtyRef.current = true;
    setAppState((prev) => ({ ...prev, workers: updatedWorkers }));
  };

  const handleUpdateStores = (updatedStores: StoreVendor[]) => {
    isDirtyRef.current = true;
    setAppState((prev) => ({ ...prev, stores: updatedStores }));
  };

  const handleUpdateWageReports = (updatedReports: WeeklyWageReport[]) => {
    isDirtyRef.current = true;
    setAppState((prev) => ({ ...prev, wageReports: updatedReports }));
  };

  const handleUpdateRealData = (newData: RealSchoolData) => {
    isDirtyRef.current = true;
    setAppState((prev) => ({
      ...prev,
      realSchoolData: newData,
    }));
  };

  const handleApplyRealDataToAll = (real: RealSchoolData) => {
    const totalRab = real.divisions.reduce((s, d) => s + d.subTotal, 0);

    // 1. Update School Master Data
    const updatedSchool: SchoolMasterData = {
      ...appState.school,
      namaSekolah: real.namaSekolah,
      pekerjaan: real.kegiatan,
      program: real.satuanPendidikan,
      lokasi: real.lokasi,
      kabKota: real.kabKota,
      provinsi: real.provinsi,
      tahunAnggaran: real.tahunAnggaran,
      totalAnggaran: totalRab,
      termin1Nilai: Math.round(totalRab * (appState.school.termin1Persen / 100)),
      termin2Nilai: Math.round(totalRab * (appState.school.termin2Persen / 100)),
    };

    // 2. Map RAB items into RPD items
    const newRpdItems: RpdItem[] = [];
    real.divisions.forEach((div) => {
      div.items.forEach((it) => {
        let kategori: RpdKategori = 'BAHAN_BARU';
        if (div.kode === 'I' || it.kategoriBiaya === 'SMKK') {
          kategori = 'PERSIAPAN';
        } else if (it.kategoriBiaya === 'UPAH') {
          kategori = 'GAJI_BARU';
        } else if (div.kode === 'XII') {
          kategori = 'PERABOT';
        }

        const vol100 = it.volume;
        const volTermin1 = Math.round(vol100 * 0.7 * 100) / 100;
        const volTermin2 = Math.round((vol100 - volTermin1) * 100) / 100;
        const jml100 = it.jumlah;
        const jmlTermin1 = Math.round(volTermin1 * it.hargaSatuan);
        const jmlTermin2 = jml100 - jmlTermin1;

        newRpdItems.push({
          id: `rpd-${it.id}`,
          no: newRpdItems.length + 1,
          uraian: `${div.kode} - ${it.uraian}`,
          satuan: it.satuan,
          kategori,
          hargaSatuan: it.hargaSatuan,
          volume100: vol100,
          jumlahAnggaran: jml100,
          volumeTermin1: volTermin1,
          jumlahTermin1: jmlTermin1,
          volumeTermin2: volTermin2,
          jumlahTermin2: jmlTermin2,
          defaultToko: div.kode === 'XII' ? 'MEBEL JAYA' : 'USAHA FAMILY',
        });
      });
    });

    // 3. Update Progress Weeks divisions based on Real RAB Divisions
    const updatedProgressWeeks = appState.progressWeeks.map((pw) => {
      const newDivisions = real.divisions.map((rd) => {
        const existingDiv = pw.divisions?.find((ed) => ed.kode === rd.kode);
        const bobot = totalRab > 0 ? parseFloat(((rd.subTotal / totalRab) * 100).toFixed(2)) : 0;
        return {
          id: `div-p-${rd.kode}`,
          kode: rd.kode,
          kategori: (rd.kode === 'I' ? 'MANAJEMEN' : 'FISIK') as 'MANAJEMEN' | 'FISIK',
          uraian: rd.uraian,
          bobotTotal: bobot,
          prestasiMingguLalu: existingDiv?.prestasiMingguLalu || 0,
          prestasiMingguIni: existingDiv?.prestasiMingguIni || 0,
          prestasiSdMingguIni: existingDiv?.prestasiSdMingguIni || 0,
          materialRef: rd.items.map((i) => i.uraian.toLowerCase().split(' ')[0]),
        };
      });

      return {
        ...pw,
        divisions: newDivisions,
      };
    });

    isDirtyRef.current = true;
    setAppState((prev) => ({
      ...prev,
      school: updatedSchool,
      realSchoolData: real,
      rpdItems: newRpdItems.length > 0 ? newRpdItems : prev.rpdItems,
      progressWeeks: updatedProgressWeeks,
    }));

    try {
      confetti({ particleCount: 90, spread: 100, origin: { y: 0.5 } });
    } catch {}
  };

  const handleAddKwitansi = (newKw: KwitansiDocument) => {
    isDirtyRef.current = true;
    setAppState((prev) => ({
      ...prev,
      kwitansiList: [newKw, ...prev.kwitansiList],
    }));
    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } catch {}
  };

  const handleDeleteKwitansi = (id: string) => {
    if (confirm('Hapus kwitansi ini beserta data terkait dari database sekolah ini?')) {
      isDirtyRef.current = true;
      setAppState((prev) => ({
        ...prev,
        kwitansiList: prev.kwitansiList.filter((k) => k.id !== id),
      }));
    }
  };

  // Core generator that breaks down Laporan Mingguan & Bobot into daily & weekly transactions
  const generateTransactionsForWeeks = (
    targetWeeks: number[],
    splitDays = true,
    overrideWeeks?: ProjectProgressWeek[]
  ) => {
    if (targetWeeks.length === 0) return;
    const yearStr = appState.school.tahunAnggaran?.trim() || '2026';
    const weeksToUse = overrideWeeks || appState.progressWeeks;

    let newKwitansiList = [...appState.kwitansiList];
    let updatedWageReports = [...appState.wageReports];
    let currentBkb = [...appState.bkbRecords];

    // Ensure initial Termin 1 deposit in BKB if not yet present
    const hasTermin1Bkb = currentBkb.some((b) => b.noBukti === 'KREDIT-T1' || b.id === 'bkb-init-termin1');
    if (!hasTermin1Bkb && weeksToUse.length > 0) {
      const w1 = weeksToUse[0];
      const w1Dates = resolveWeekDates(w1, yearStr);
      currentBkb.unshift({
        id: 'bkb-init-termin1',
        tanggal: w1Dates.startDateSlash,
        tanggalObj: w1Dates.startDate,
        bulan: w1Dates.bulan,
        uraian: 'Penerimaan Dana Revitalisasi Termin 1 (70%) ke Rekening Bank',
        noBukti: 'KREDIT-T1',
        penerimaan: appState.school.termin1Nilai || 525000000,
        pengeluaran: 0,
      });
    }

    targetWeeks.forEach((targetWeek) => {
      const weekObj = weeksToUse.find((w) => w.mingguKe === targetWeek);
      if (!weekObj) return;

      const weekDates = resolveWeekDates(weekObj, yearStr);
      const bulan = weekDates.bulan;
      const dateStr = weekDates.endDateSlash; // e.g. '07/07/2026'
      const startDateStr = weekDates.startDateSlash; // e.g. '01/07/2026'
      const formattedDateEnd = weekDates.endDateFormatted;
      const formattedDateStart = weekDates.startDateFormatted;

      // 1. Upah Kwitansi & Wage Report
      let currentWageReport = updatedWageReports.find((r) => r.mingguKe === targetWeek);
      if (!currentWageReport) {
        const defaultAttendance = appState.workers.map((w, idx) => {
          const days: [number, number, number, number, number, number, number] = [1, 1, 1, 1, idx % 4 === 0 ? 0 : 1, 1, 1];
          const hok = days.reduce((a, b) => a + b, 0);
          return {
            workerId: w.id,
            nama: w.nama,
            jenisKelamin: w.jenisKelamin,
            domisili: w.domisili,
            peran: w.peran,
            peranLabel: w.peranLabel,
            days,
            hok,
            upahHarian: w.upahHarian,
            totalUpah: hok * w.upahHarian,
          };
        });
        const totUpah = defaultAttendance.reduce((s, a) => s + a.totalUpah, 0);
        currentWageReport = {
          id: `wage-rep-m${targetWeek}`,
          mingguKe: targetWeek,
          bulan,
          periodeStart: formattedDateStart,
          periodeEnd: formattedDateEnd,
          tanggalKwitansi: formattedDateEnd,
          noBuktiKwitansi: `UK/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`,
          penerimaNama: 'Budiman',
          penerimaJabatan: 'Kepala Tukang',
          attendance: defaultAttendance,
          totalUpah: totUpah,
          bobotMingguIni: weekObj.bobotRealisasi || 0,
          bobotKumulatif: weekObj.bobotRealisasi || 0,
        };
        updatedWageReports.push(currentWageReport);
      } else {
        const wageIdx = updatedWageReports.findIndex((r) => r.mingguKe === targetWeek);
        if (wageIdx >= 0) {
          updatedWageReports[wageIdx] = {
            ...updatedWageReports[wageIdx],
            bulan,
            periodeStart: formattedDateStart,
            periodeEnd: formattedDateEnd,
            tanggalKwitansi: formattedDateEnd,
            noBuktiKwitansi: `UK/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`,
          };
          currentWageReport = updatedWageReports[wageIdx];
        }
      }

      const totalWage = currentWageReport.totalUpah;
      const kwUpahBukti = `UK/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`;

      const upahKwIdx = newKwitansiList.findIndex((k) => k.mingguKeRef === targetWeek || k.noBukti === kwUpahBukti);
      const upahKwDoc: KwitansiDocument = {
        id: upahKwIdx >= 0 ? newKwitansiList[upahKwIdx].id : `kw-wage-m${targetWeek}-${Date.now()}`,
        noBukti: kwUpahBukti,
        noSpb: `SPB-UPAH/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`,
        tipe: 'UPAH',
        tanggal: dateStr,
        tanggalFormatted: formattedDateEnd,
        bulan: bulan,
        uraian: `Pembayaran Lunas Biaya Upah Tukang & Pekerja Minggu ${targetWeek} (${formattedDateStart} s.d ${formattedDateEnd}), Untuk Pekerjaan Revitalisasi ${appState.school.namaSekolah}, Tahun ${yearStr}, Daftar Terlampir.`,
        penerimaNama: currentWageReport.penerimaNama || 'Budiman',
        penerimaPekerjaan: currentWageReport.penerimaJabatan || 'Kepala Tukang',
        penerimaAlamat: appState.school.kabKota,
        nominal: totalWage,
        items: [{ namaBarang: `Upah Tukang & Pekerja Minggu ${targetWeek} (${formattedDateStart} - ${formattedDateEnd})`, volume: 1, satuan: 'Minggu', hargaSatuan: totalWage, jumlah: totalWage }],
        isPpn: false,
        isPph22: false,
        isPph23: false,
        ppnAmount: 0,
        pph22Amount: 0,
        pph23Amount: 0,
        kategoriBiayaPajak: 'Konstruksi',
        keteranganSpb: `Pembayaran Upah Kerja Fisik Minggu Ke-${targetWeek} (${formattedDateStart} s.d ${formattedDateEnd}) Sesuai Laporan Progres`,
        mingguKeRef: targetWeek,
      };

      if (upahKwIdx >= 0) {
        newKwitansiList[upahKwIdx] = upahKwDoc;
      } else {
        newKwitansiList.unshift(upahKwDoc);
      }

      // 2. Material Kwitansi (pecah harian sesuai tanggal mulai mingguan)
      if (weekObj.divisions) {
        weekObj.divisions.forEach((div, dIdx) => {
          if (div.prestasiMingguIni > 0 && div.kategori === 'FISIK') {
            const matchedRpd = appState.rpdItems.filter((it) =>
              div.materialRef?.some((kw) => it.uraian.toLowerCase().includes(kw.toLowerCase())) ||
              it.uraian.toLowerCase().includes(div.uraian.toLowerCase()) ||
              div.uraian.toLowerCase().includes(it.uraian.toLowerCase())
            );

            const rpdCandidates = matchedRpd.length > 0 ? matchedRpd : appState.rpdItems.filter((it) => it.kategori === 'BAHAN_REHAB' || it.kategori === 'BAHAN_BARU').slice(0, 3);

            if (rpdCandidates.length > 0) {
              const defaultToko = rpdCandidates[0].defaultToko || (appState.stores && appState.stores[0]?.namaToko) || 'USAHA FAMILY';
              const tokoVendor = (appState.stores || []).find((s) => s.namaToko.toLowerCase() === defaultToko.toLowerCase());

              const tokoItems = rpdCandidates.map((it) => {
                const volRatio = div.bobotTotal > 0 ? (div.prestasiMingguIni / div.bobotTotal) : 0.1;
                const volProp = Math.max(1, Math.round(volRatio * it.volume100 * 100) / 100);
                return {
                  namaBarang: it.uraian,
                  volume: volProp,
                  satuan: it.satuan,
                  hargaSatuan: it.hargaSatuan,
                  jumlah: Math.round(volProp * it.hargaSatuan),
                };
              });

              const nominalMaterial = tokoItems.reduce((s, it) => s + it.jumlah, 0);
              if (nominalMaterial > 0) {
                const chunkCount = splitDays && tokoItems.length > 1 ? 2 : 1;
                const halfIndex = Math.ceil(tokoItems.length / chunkCount);

                for (let c = 0; c < chunkCount; c++) {
                  const chunkItems = chunkCount === 1 ? tokoItems : c === 0 ? tokoItems.slice(0, halfIndex) : tokoItems.slice(halfIndex);
                  const chunkNominal = chunkItems.reduce((s, it) => s + it.jumlah, 0);
                  if (chunkNominal <= 0) continue;

                  // Tanggal mulai pencatatan jangan kurang dari tanggal mulai Laporan Mingguan
                  // Hari kerja aktif 0 (Mulai/Senin), 2 (Rabu), 4 (Jumat), selalu >= startDate
                  const offsetDayNum = Math.min(5, Math.max(0, (dIdx * 2 + c) % 6));
                  const sBase = new Date(`${weekDates.startDate}T00:00:00`);
                  const chunkDateObj = new Date(sBase.getTime() + offsetDayNum * 86400000);
                  const cDay = String(chunkDateObj.getDate()).padStart(2, '0');
                  const cMonth = chunkDateObj.getMonth();
                  const cYear = chunkDateObj.getFullYear();
                  const indShortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                  const indFullMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

                  const dayOffsetStr = `${cDay}/${String(cMonth + 1).padStart(2, '0')}/${cYear}`;
                  const dayOffsetFormatted = `${cDay} ${indShortMonths[cMonth]} ${cYear}`;
                  const dayOffsetBulan = `${indFullMonths[cMonth]} ${cYear}`;
                  const seqNo = targetWeek * 2 + dIdx + c;
                  const kwMatBukti = `${String(seqNo).padStart(2, '0')}/1MD/${yearStr}`;
                  const spbBukti = `${String(seqNo).padStart(2, '0')}/01MD/${yearStr}`;

                  const isTaxable = chunkNominal >= 2000000;
                  const ppn = isTaxable ? Math.round((chunkNominal / 1.11) * 0.11 * 100) / 100 : 0;
                  const pph22 = isTaxable ? Math.round((chunkNominal / 1.11) * 0.015 * 100) / 100 : 0;

                  const matKwDoc: KwitansiDocument = {
                    id: `kw-mat-m${targetWeek}-${dIdx}-${c}-${Date.now()}`,
                    noBukti: kwMatBukti,
                    noSpb: spbBukti,
                    tipe: div.uraian.includes('MEBELER') || div.uraian.includes('PERABOT') ? 'PERABOT' : 'MATERIAL',
                    tanggal: dayOffsetStr,
                    tanggalFormatted: dayOffsetFormatted,
                    bulan: dayOffsetBulan,
                    uraian: `Pembayaran Lunas Biaya Pembelian Material/Bahan (${chunkItems.map((i) => i.namaBarang).slice(0, 3).join(', ')}), Untuk Pekerjaan ${div.uraian} Revitalisasi ${appState.school.namaSekolah}, Tahun ${yearStr}, Daftar Terlampir.`,
                    penerimaNama: tokoVendor?.pemilikNama || (defaultToko === 'USAHA FAMILY' ? 'Ridwan Hasan' : defaultToko === 'ALUE SEURIBE' ? 'Muhammad Tantawi' : defaultToko === 'TEXAS' ? 'Faisal Razi' : defaultToko === 'NABIL HOME' ? 'Asmarani' : 'Pemilik Toko'),
                    penerimaPekerjaan: `Pemilik Toko ${defaultToko}`,
                    penerimaAlamat: tokoVendor?.alamat || appState.school.kabKota,
                    namaToko: defaultToko,
                    items: chunkItems,
                    nominal: chunkNominal,
                    isPpn: isTaxable,
                    isPph22: isTaxable,
                    isPph23: false,
                    ppnAmount: ppn,
                    pph22Amount: pph22,
                    pph23Amount: 0,
                    kategoriBiayaPajak: 'Konstruksi',
                    keteranganSpb: `Surat Pesanan Bahan Material ${div.uraian} Minggu Ke-${targetWeek} (${formattedDateStart} - ${formattedDateEnd})`,
                    mingguKeRef: targetWeek,
                  };

                  const existingMatIdx = newKwitansiList.findIndex((k) => k.noBukti === kwMatBukti);
                  if (existingMatIdx >= 0) {
                    newKwitansiList[existingMatIdx] = matKwDoc;
                  } else {
                    newKwitansiList.unshift(matKwDoc);
                  }
                }
              }
            }
          } else if (div.prestasiMingguIni > 0 && div.kategori === 'MANAJEMEN') {
            const volRatio = div.bobotTotal > 0 ? div.prestasiMingguIni / div.bobotTotal : 0.1;
            const nomBiaya = Math.max(150000, Math.round(volRatio * (appState.school.totalAnggaran || 750000000) * (div.bobotTotal / 100)));
            const isPerencana = /perencana/i.test(div.uraian);
            const isPengawas = /pengawas/i.test(div.uraian);
            const isAdm = /administrasi|pengelolaan/i.test(div.uraian);

            let kwBukti = `ADM/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`;
            let penerimaNama = 'IRWAN YUSUF';
            let penerimaPekerjaan = 'Pengelola Administrasi LPJ';
            let tipeKw: KwitansiDocument['tipe'] = 'OPERASIONAL';
            let isPph23 = false;
            let pph23Amount = 0;

            if (isPerencana) {
              kwBukti = `KONS-P/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`;
              penerimaNama = 'Zulfahmi, ST';
              penerimaPekerjaan = 'Konsultan Perencana Teknis';
              tipeKw = 'KONSULTAN';
              isPph23 = true;
              pph23Amount = Math.round(nomBiaya * 0.02);
            } else if (isPengawas) {
              kwBukti = `KONS-W/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`;
              penerimaNama = 'M. Aris Syahputra, ST';
              penerimaPekerjaan = 'Konsultan Pengawas Lapangan';
              tipeKw = 'KONSULTAN';
              isPph23 = true;
              pph23Amount = Math.round(nomBiaya * 0.02);
            }

            // Pembayaran perencana, pengawas, dan administrasi dicatat pada setiap TANGGAL AKHIR MINGGU
            const opKwDoc: KwitansiDocument = {
              id: `kw-op-m${targetWeek}-${dIdx}-${Date.now()}`,
              noBukti: kwBukti,
              noSpb: `SPB-${kwBukti}`,
              tipe: tipeKw,
              tanggal: dateStr, // Tanggal akhir minggu (endDate)
              tanggalFormatted: formattedDateEnd, // Tanggal akhir minggu (formatted)
              bulan: bulan,
              uraian: isPerencana
                ? `Pembayaran Lunas Honorarium Jasa Perencana Teknis Minggu Ke-${targetWeek} (${formattedDateStart} s.d ${formattedDateEnd}), Revitalisasi ${appState.school.namaSekolah}`
                : isPengawas
                ? `Pembayaran Lunas Honorarium Jasa Pengawas Lapangan Minggu Ke-${targetWeek} (${formattedDateStart} s.d ${formattedDateEnd}), Revitalisasi ${appState.school.namaSekolah}`
                : `Pembayaran Lunas Biaya Pengelolaan Administrasi LPJ Minggu Ke-${targetWeek} (${formattedDateStart} s.d ${formattedDateEnd}), Revitalisasi ${appState.school.namaSekolah}`,
              penerimaNama: penerimaNama,
              penerimaPekerjaan: penerimaPekerjaan,
              penerimaAlamat: appState.school.kabKota,
              items: [{ 
                namaBarang: isPerencana ? 'Honorarium Jasa Konsultan Perencana' : isPengawas ? 'Honorarium Jasa Konsultan Pengawas' : 'Biaya Pengelolaan Administrasi & ATK LPJ', 
                volume: 1, 
                satuan: 'Laporan/Minggu', 
                hargaSatuan: nomBiaya, 
                jumlah: nomBiaya 
              }],
              nominal: nomBiaya,
              isPpn: false,
              isPph22: false,
              isPph23: isPph23,
              ppnAmount: 0,
              pph22Amount: 0,
              pph23Amount: pph23Amount,
              kategoriBiayaPajak: 'Perencanaan_Pengelolaan',
              keteranganSpb: `Pembayaran ${div.uraian} Minggu Ke-${targetWeek} Dibayarkan Pada Akhir Minggu (${formattedDateEnd})`,
              mingguKeRef: targetWeek,
            };
            const existingOpIdx = newKwitansiList.findIndex((k) => k.noBukti === kwBukti);
            if (existingOpIdx >= 0) {
              newKwitansiList[existingOpIdx] = opKwDoc;
            } else {
              newKwitansiList.unshift(opKwDoc);
            }
          }
        });
      }

      // 3. Ensure BKB penarikan tunai operasional
      const withdrawalTxBukti = `TARIK-M${targetWeek}`;
      const hasTarik = currentBkb.some((b) => b.noBukti === withdrawalTxBukti);
      if (!hasTarik) {
        currentBkb.push({
          id: `bkb-tarik-m${targetWeek}-${Date.now()}`,
          tanggal: startDateStr,
          tanggalObj: weekDates.startDate,
          bulan: bulan,
          uraian: `Penarikan Tunai Kas Operasional & Upah Fisik Minggu Ke-${targetWeek} (${formattedDateStart} s.d ${formattedDateEnd})`,
          noBukti: withdrawalTxBukti,
          penerimaan: 0,
          pengeluaran: totalWage + 5000000,
        });
      }
    });

    isDirtyRef.current = true;
    setAppState((prev) => ({
      ...prev,
      progressWeeks: overrideWeeks || prev.progressWeeks,
      kwitansiList: newKwitansiList,
      wageReports: updatedWageReports,
      bkbRecords: currentBkb,
    }));

    setTimeout(() => {
      try {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      } catch {}
    }, 150);
  };

  const handleAutoGenerateFromProgress = (
    targetWeek: number,
    splitDays = true,
    overrideWeeks?: ProjectProgressWeek[]
  ) => {
    generateTransactionsForWeeks([targetWeek], splitDays, overrideWeeks);
  };

  const handleAutoGenerateDailyAndWeekly = (selectedWeeks: number[], splitDays: boolean) => {
    generateTransactionsForWeeks(selectedWeeks, splitDays);
  };

  const handleAutoGenerateAllWeeks = () => {
    // Collect all weeks that have realisasi > 0 or divisions with progress > 0
    const activeWeeks = appState.progressWeeks
      .filter((w) => (w.bobotRealisasi && w.bobotRealisasi > 0) || w.divisions?.some((d) => d.prestasiMingguIni > 0))
      .map((w) => w.mingguKe);

    const targetList = activeWeeks.length > 0 ? activeWeeks : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    generateTransactionsForWeeks(targetList, true);
  };

  // BKB Handlers
  const handleAddBkbRecord = (tx: Omit<BkbTransaction, 'id'>) => {
    const newTx: BkbTransaction = {
      ...tx,
      id: `bkb-manual-${Date.now()}`,
    };
    isDirtyRef.current = true;
    setAppState((prev) => ({
      ...prev,
      bkbRecords: [...(prev.bkbRecords || []), newTx],
    }));
  };

  const handleUpdateBkbRecord = (updatedTx: BkbTransaction) => {
    isDirtyRef.current = true;
    setAppState((prev) => ({
      ...prev,
      bkbRecords: (prev.bkbRecords || []).map((b) => (b.id === updatedTx.id ? updatedTx : b)),
    }));
  };

  const handleDeleteBkbRecord = (txToDelete: BkbTransaction) => {
    isDirtyRef.current = true;
    setAppState((prev) => ({
      ...prev,
      bkbRecords: (prev.bkbRecords || []).filter((b) => b.id !== txToDelete.id),
    }));
  };

  const handleResetData = () => {
    if (confirm(`Kembalikan data ${currentTenant.namaSekolah} ke template standar awal?`)) {
      const reset = createSchoolStateForTenant(currentTenant, 'full');
      isDirtyRef.current = true;
      setAppState(reset);
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `LPJ_${currentTenant.npsn}_${appState.school.namaSekolah.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target?.result as string);
            if (parsed.school && parsed.rpdItems) {
              isDirtyRef.current = true;
              setAppState(parsed);
              alert(`Data LPJ untuk ${parsed.school.namaSekolah || currentTenant.namaSekolah} berhasil dipulihkan!`);
            } else {
              alert('Format file JSON tidak sesuai dengan skema LPJ Revitalisasi.');
            }
          } catch (err) {
            alert('Gagal membaca file JSON.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleOpenPrint = (docType = 'ALL', month?: string, week?: number, kwId?: string) => {
    setPrintDocType(docType);
    setPrintMonth(month);
    setPrintWeekNum(week);
    setPrintKwitansiId(kwId);
    setIsPrintModalOpen(true);
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/30 mb-4 animate-pulse">
          <Database className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Memuat Database Multi-Sekolah...</h2>
        <p className="text-sm text-slate-400 mt-1 max-w-md">
          Menghubungkan ke Google Cloud Firestore ({firestoreDatabaseId}) dan memuat data terisolasi untuk {currentTenant.namaSekolah}...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Header with Multi-Tenant School Switcher */}
      <Header
        school={appState.school}
        currentTenant={currentTenant}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPrintModal={(type) => handleOpenPrint(type || 'ALL')}
        onReset={handleResetData}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onOpenSchoolPortal={() => setIsSchoolPortalOpen(true)}
        isSyncing={isSyncing}
        lastSyncedText={lastSyncedText}
        onManualSave={handleManualSaveNow}
      />

      {/* Tenant Switch Notification Toast Banner */}
      {switchNotification && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs font-medium animate-in slide-in-from-top duration-200 print:hidden">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>{switchNotification}</span>
            </div>
            <button
              onClick={() => setSwitchNotification(null)}
              className="text-emerald-100 hover:text-white p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Views */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 print:hidden">
        {activeTab === 'dashboard' && (
          <Dashboard
            school={appState.school}
            rpdItems={appState.rpdItems}
            kwitansiList={appState.kwitansiList}
            wageReports={appState.wageReports}
            progressWeeks={appState.progressWeeks}
            taxRecords={taxRecords}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenPrintModal={(type) => handleOpenPrint(type)}
            onOpenQuickReceipt={() => setIsQuickReceiptOpen(true)}
          />
        )}

        {activeTab === 'realdata' && (
          <RealSchoolDataManager
            realData={appState.realSchoolData || defaultRealSchoolData}
            onUpdateRealData={handleUpdateRealData}
            onApplyToAllModules={handleApplyRealDataToAll}
          />
        )}

        {activeTab === 'master' && (
          <MasterDataForm
            school={appState.school}
            onSave={handleUpdateSchool}
            onOpenPrintModal={(doc) => handleOpenPrint(doc)}
            onDeleteSchool={() => handleDeleteTenant(currentTenant)}
          />
        )}

        {activeTab === 'rpd' && (
          <RpdManager
            items={appState.rpdItems}
            onUpdateItems={handleUpdateRpd}
            onOpenPrintModal={() => handleOpenPrint('RPD')}
            availableStores={appState.stores || []}
          />
        )}

        {activeTab === 'progress' && (
          <WeeklyProgressManager
            progressWeeks={appState.progressWeeks}
            workers={appState.workers}
            rpdItems={appState.rpdItems}
            school={appState.school}
            onUpdateWeeks={handleUpdateProgressWeeks}
            onAutoGenerateFromProgress={handleAutoGenerateFromProgress}
            onAutoGenerateAllWeeks={handleAutoGenerateAllWeeks}
            onOpenPrintModal={(weekNum) => handleOpenPrint('PROGRESS', undefined, weekNum)}
            bkuList={bkuList}
            kwitansiList={appState.kwitansiList}
            onAddTransaction={(tx, weekNum) => handleAddManualBku(tx, weekNum)}
            onUpdateTransaction={handleUpdateBku}
            onDeleteTransaction={handleDeleteBku}
          />
        )}

        {activeTab === 'bku' && (
          <BkuManager
            bkuList={bkuList}
            school={appState.school}
            progressWeeks={appState.progressWeeks}
            onOpenPrintModal={(month) => handleOpenPrint('BKU', month)}
            onAddTransaction={handleAddManualBku}
            onUpdateTransaction={handleUpdateBku}
            onDeleteTransaction={handleDeleteBku}
          />
        )}

        {activeTab === 'bkt' && (
          <BktManager
            bktList={bktList}
            school={appState.school}
            progressWeeks={appState.progressWeeks}
            onOpenPrintModal={(month) => handleOpenPrint('BKT', month)}
            onAddTransaction={handleAddManualBku}
            onUpdateTransaction={handleUpdateBku}
            onDeleteTransaction={handleDeleteBku}
          />
        )}

        {activeTab === 'bkb' && (
          <BkbManager
            bkbList={appState.bkbRecords}
            school={appState.school}
            progressWeeks={appState.progressWeeks}
            onOpenPrintModal={(period) => handleOpenPrint('BKB', period)}
            onAddBkbRecord={handleAddBkbRecord}
            onUpdateBkbRecord={handleUpdateBkbRecord}
            onDeleteBkbRecord={handleDeleteBkbRecord}
          />
        )}

        {activeTab === 'pajak' && (
          <TaxManager
            taxRecords={taxRecords}
            school={appState.school}
            onOpenPrintModal={(month) => handleOpenPrint('PAJAK', month)}
          />
        )}

        {activeTab === 'kwitansi' && (
          <KwitansiManager
            kwitansiList={appState.kwitansiList}
            school={appState.school}
            progressWeeks={appState.progressWeeks}
            onOpenPrintKwitansi={(kwId, mode) => handleOpenPrint(mode, undefined, undefined, kwId)}
            onAddNewKwitansi={() => setIsQuickReceiptOpen(true)}
            onDeleteKwitansi={handleDeleteKwitansi}
            onAutoGenerateDailyAndWeekly={handleAutoGenerateDailyAndWeekly}
          />
        )}

        {activeTab === 'upah' && (
          <WageManager
            wageReports={appState.wageReports}
            workers={appState.workers}
            school={appState.school}
            onUpdateWageReports={handleUpdateWageReports}
            onUpdateWorkers={handleUpdateWorkers}
            onOpenPrintModal={(weekNum) => handleOpenPrint('UPAH', undefined, weekNum)}
          />
        )}

        {activeTab === 'toko' && (
          <StoreVendorManager
            stores={appState.stores || []}
            onUpdateStores={handleUpdateStores}
            onSelectForKwitansi={() => {
              setActiveTab('kwitansi');
              setIsQuickReceiptOpen(true);
            }}
          />
        )}
      </main>

      {/* Footer with Multi-Tenancy Info */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            Aplikasi Penyusunan LPJ Revitalisasi Sekolah Terintegrasi • Sesuai Standar Juknis DAK Fisik & Kemendikdasmen RI
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-mono text-[11px] text-slate-600">
              Tenant Aktif: {currentTenant.id} ({currentTenant.namaSekolah})
            </span>
          </div>
        </div>
      </footer>

      {/* Multi-Tenant School Portal Modal */}
      <SchoolTenantPortalModal
        isOpen={isSchoolPortalOpen}
        onClose={() => setIsSchoolPortalOpen(false)}
        currentTenant={currentTenant}
        tenants={tenants}
        onSelectTenant={handleSelectTenant}
        onDeleteTenant={handleDeleteTenant}
        onRegisterSchool={handleRegisterNewSchool}
        cloudDatabaseId={firestoreDatabaseId}
      />

      {/* Quick Receipt Modal */}
      <QuickReceiptModal
        isOpen={isQuickReceiptOpen}
        onClose={() => setIsQuickReceiptOpen(false)}
        onSave={handleAddKwitansi}
        availableStores={appState.stores || []}
      />

      {/* Full Document Printable Viewer Modal */}
      <PrintDocumentViewer
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        documentType={printDocType}
        selectedMonth={printMonth}
        selectedWeekNum={printWeekNum}
        selectedKwitansiId={printKwitansiId}
        school={appState.school}
        rpdItems={appState.rpdItems}
        kwitansiList={appState.kwitansiList}
        wageReports={appState.wageReports}
        bkuList={bkuList}
        bktList={bktList}
        bkbList={appState.bkbRecords}
        taxRecords={taxRecords}
        progressWeeks={appState.progressWeeks}
      />
    </div>
  );
}
