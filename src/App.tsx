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
  generateWeeklyTransactionsFromProgressAndRealData,
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
  checkIsQuotaExhausted,
} from './services/schoolTenantService';
import { getMonthFromPeriodString, resolveWeekDates } from './utils/monthHelper';
import { firestoreDatabaseId } from './services/firebase';
import { initialProgressWeeks, initialWorkers, initialStores } from './data/initialData';

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
import { CheckCircle2, Database, ShieldAlert, Sparkles, X, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
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
  const [printFilterOptions, setPrintFilterOptions] = useState<any | undefined>(undefined);

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
        if (checkIsQuotaExhausted()) {
          setLastSyncedText(`Tersimpan di Memori Lokal ${timeStr}`);
        } else if (ok) {
          setLastSyncedText(`Tersimpan ${timeStr}`);
        } else {
          setLastSyncedText(`Tersimpan Offline ${timeStr}`);
        }
      } catch (err) {
        console.warn('Auto-save notice:', err);
        setIsSyncing(false);
        setLastSyncedText('Tersimpan di Memori Lokal');
      }
    }, 1800);

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
    jenjang: 'TK/PAUD' | 'SD' | 'SMP/MTs' | 'SMA/SMK' | string;
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

  // Delete School Tenant Confirmation Modal State
  const [tenantToDeleteConfirm, setTenantToDeleteConfirm] = useState<SchoolTenant | null>(null);
  const [isDeletingTenantLoading, setIsDeletingTenantLoading] = useState(false);

  // Trigger in-app confirmation modal for deleting school
  const handleDeleteTenant = (tenantToDelete: SchoolTenant) => {
    setTenantToDeleteConfirm(tenantToDelete);
  };

  // Execute permanent deletion of selected school and its database
  const handleConfirmDeleteTenant = async () => {
    if (!tenantToDeleteConfirm) return;
    const tenantToDelete = tenantToDeleteConfirm;
    setIsDeletingTenantLoading(true);

    // 1. Optimistic UI update: Remove the tenant immediately from local state (0ms delay)
    let updatedTenants = tenants.filter((t) => t.id !== tenantToDelete.id);

    // If no tenants left, automatically spawn a clean blank school database
    let nextTenant: SchoolTenant;
    if (updatedTenants.length === 0) {
      nextTenant = {
        id: `sch_${Date.now()}`,
        npsn: '',
        namaSekolah: 'SEKOLAH SAYA (LENGKAPI IDENTITAS)',
        jenjang: 'SD',
        kabKota: '',
        provinsi: '',
        email: '',
        isDemo: false,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      updatedTenants = [nextTenant];
    } else {
      nextTenant = updatedTenants[0];
    }

    setTenants(updatedTenants);

    // 2. If the active tenant was deleted, switch immediately in UI
    if (tenantToDelete.id === currentTenant.id) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      isDirtyRef.current = false;
      isLoadedRef.current = false;
      setIsSyncing(true);
      setStoredActiveTenantId(nextTenant.id);
      setCurrentTenant(nextTenant);

      try {
        const loaded = await loadSchoolTenantAppState(nextTenant);
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
      } catch (err) {
        console.error('Error switching tenant during delete:', err);
        setIsSyncing(false);
      }
    }

    // 3. Run Firestore & localStorage deletion asynchronously
    try {
      await deleteSchoolTenant(tenantToDelete.id);
    } catch (err) {
      console.warn('Notice on background tenant deletion:', err);
    }

    setIsDeletingTenantLoading(false);
    setTenantToDeleteConfirm(null);
    setSwitchNotification(`Database sekolah "${tenantToDelete.namaSekolah}" berhasil dihapus beserta databasenya dan dihilangkan dari tampilan.`);
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
      if (checkIsQuotaExhausted()) {
        setLastSyncedText(`Tersimpan di Memori Lokal ${timeStr}`);
        setSwitchNotification(`Data ${currentTenant.namaSekolah} tersimpan aman di memori lokal browser (Batas kuota harian cloud tercapai).`);
      } else if (ok) {
        setLastSyncedText(`Tersimpan ${timeStr}`);
        setSwitchNotification(`Data ${currentTenant.namaSekolah} berhasil disimpan permanen ke Google Cloud Firestore.`);
      } else {
        setLastSyncedText(`Tersimpan Offline ${timeStr}`);
        setSwitchNotification(`Data tersimpan aman di memori lokal perangkat.`);
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

  const handleUpdateKwitansiList = (updatedKwitansi: KwitansiDocument[]) => {
    isDirtyRef.current = true;
    setAppState((prev) => ({ ...prev, kwitansiList: updatedKwitansi }));
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

  // Core generator that breaks down Laporan Mingguan & Bobot into real Bahan, Upah, Alat, SMKK, & Manajemen transactions
  const generateTransactionsForWeeks = (
    targetWeeks: number[],
    splitDays = true,
    overrideWeeks?: ProjectProgressWeek[]
  ) => {
    if (targetWeeks.length === 0) return;
    const weeksToUse = overrideWeeks || appState.progressWeeks;

    let currentKwitansi = [...appState.kwitansiList];
    let currentWageReports = [...appState.wageReports];
    let currentBkb = [...appState.bkbRecords];

    let totalBahan = 0;
    let totalUpah = 0;
    let totalAlat = 0;
    let totalSmkk = 0;

    targetWeeks.forEach((targetWeek) => {
      const weekObj = weeksToUse.find((w) => w.mingguKe === targetWeek);
      if (!weekObj) return;

      const res = generateWeeklyTransactionsFromProgressAndRealData({
        targetWeek,
        weekObj,
        weeksToUse,
        school: appState.school,
        workers: appState.workers,
        stores: appState.stores || [],
        rpdItems: appState.rpdItems,
        realSchoolData: appState.realSchoolData,
        existingKwitansi: currentKwitansi,
        existingWageReports: currentWageReports,
        existingBkb: currentBkb,
        splitDays,
      });

      currentKwitansi = res.updatedKwitansi;
      currentWageReports = res.updatedWageReports;
      currentBkb = res.updatedBkb;

      totalBahan += res.generatedCount.bahan;
      totalUpah += res.generatedCount.upah;
      totalAlat += res.generatedCount.alat;
      totalSmkk += res.generatedCount.smkk;
    });

    isDirtyRef.current = true;
    setAppState((prev) => ({
      ...prev,
      progressWeeks: overrideWeeks || prev.progressWeeks,
      kwitansiList: currentKwitansi,
      wageReports: currentWageReports,
      bkbRecords: currentBkb,
    }));

    setSwitchNotification(
      `✅ Transaksi berhasil dialokasikan: ${totalBahan} Kwitansi & Bon Bahan, ${totalUpah} Kwitansi & Absensi Upah, ${totalAlat} Alat, ${totalSmkk} SMKK/K3.`
    );
    setTimeout(() => setSwitchNotification(null), 5000);

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
    if (
      confirm(`Kosongkan seluruh data transaksi & pembukuan untuk ${appState.school.namaSekolah || currentTenant.namaSekolah}?

Data yang DIPERTAHANKAN:
- Ringkasan Proyek
- Data Real Sekolah
- Data Master Sekolah
- Upah Tenaga Kerja (Daftar Master Pekerja & Tukang)
- Toko Rekanan & Penyedia

Data yang DIKOSONGKAN:
- RPD, Laporan Mingguan & Bobot, BKU/BKT/BKB, Kwitansi & Absensi Upah.

Lanjutkan pengosongan data transaksi?`)
    ) {
      const cleanProgressWeeks = (appState.progressWeeks || initialProgressWeeks).map((w) => ({
        ...w,
        bobotRealisasi: 0,
        deviasi: Math.round((0 - w.bobotRencana) * 100) / 100,
        divisions: (w.divisions || []).map((d) => ({
          ...d,
          prestasiMingguLalu: 0,
          prestasiMingguIni: 0,
          prestasiSdMingguIni: 0,
        })),
      }));

      const cleanWageReports = (appState.wageReports || []).map((rep) => ({
        ...rep,
        totalUpah: 0,
        attendance: (rep.attendance || []).map((att) => ({
          ...att,
          days: [0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number],
          hok: 0,
          totalUpah: 0,
        })),
      }));

      const resetState: AppStateData = {
        school: { ...appState.school },
        realSchoolData: appState.realSchoolData || defaultRealSchoolData,
        workers: appState.workers && appState.workers.length > 0 ? appState.workers : initialWorkers,
        stores: appState.stores && appState.stores.length > 0 ? appState.stores : initialStores,
        rpdItems: [],
        kwitansiList: [],
        manualBkuTransactions: [],
        bkbRecords: [],
        deletedBkuIds: [],
        wageReports: cleanWageReports,
        progressWeeks: cleanProgressWeeks,
      };

      isDirtyRef.current = true;
      setAppState(resetState);
      setSwitchNotification('✅ Seluruh lembar transaksi & pembukuan berhasil dikosongkan. Data Master Sekolah, Data Real, Pekerja/Tukang & Toko Rekanan tetap tersimpan utuh.');
      setTimeout(() => setSwitchNotification(null), 5000);
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

  const handleOpenPrint = (
    docType = 'ALL',
    month?: string,
    week?: number,
    kwId?: string,
    filterOptions?: any
  ) => {
    setPrintDocType(docType);
    setPrintMonth(month);
    setPrintWeekNum(week);
    setPrintKwitansiId(kwId);
    setPrintFilterOptions(filterOptions);
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
            realSchoolData={appState.realSchoolData || defaultRealSchoolData}
            onSyncFromRealData={() => {
              handleApplyRealDataToAll(appState.realSchoolData || defaultRealSchoolData);
              setSwitchNotification(
                '✅ Data acuan, harga satuan, dan analisa dari Data Real Sekolah berhasil disinkronkan ke RPD & Progres Mingguan!'
              );
              setTimeout(() => setSwitchNotification(null), 4000);
            }}
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
            stores={appState.stores || []}
            onOpenPrintModal={(month, filterOpts) =>
              handleOpenPrint('BKU', month, filterOpts?.weekNum, undefined, filterOpts)
            }
            onAddTransaction={handleAddManualBku}
            onUpdateTransaction={handleUpdateBku}
            onDeleteTransaction={handleDeleteBku}
            onUpdateStores={handleUpdateStores}
          />
        )}

        {activeTab === 'bkt' && (
          <BktManager
            bktList={bktList}
            school={appState.school}
            progressWeeks={appState.progressWeeks}
            stores={appState.stores || []}
            onOpenPrintModal={(month, filterOpts) =>
              handleOpenPrint('BKT', month, filterOpts?.weekNum, undefined, filterOpts)
            }
            onAddTransaction={handleAddManualBku}
            onUpdateTransaction={handleUpdateBku}
            onDeleteTransaction={handleDeleteBku}
            onUpdateStores={handleUpdateStores}
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
            stores={appState.stores || []}
            onOpenPrintModal={(month) => handleOpenPrint('PAJAK', month)}
            onUpdateStores={handleUpdateStores}
          />
        )}

        {activeTab === 'kwitansi' && (
          <KwitansiManager
            kwitansiList={appState.kwitansiList}
            school={appState.school}
            progressWeeks={appState.progressWeeks}
            stores={appState.stores || []}
            onOpenPrintKwitansi={(kwId, mode) => handleOpenPrint(mode, undefined, undefined, kwId)}
            onAddNewKwitansi={() => setIsQuickReceiptOpen(true)}
            onDeleteKwitansi={handleDeleteKwitansi}
            onAutoGenerateDailyAndWeekly={handleAutoGenerateDailyAndWeekly}
            onUpdateStores={handleUpdateStores}
          />
        )}

        {activeTab === 'upah' && (
          <WageManager
            wageReports={appState.wageReports}
            workers={appState.workers}
            school={appState.school}
            realSchoolData={appState.realSchoolData}
            divisions={appState.realSchoolData?.divisions}
            progressWeeks={appState.progressWeeks}
            kwitansiList={appState.kwitansiList}
            onUpdateWageReports={handleUpdateWageReports}
            onUpdateWorkers={handleUpdateWorkers}
            onUpdateKwitansiList={handleUpdateKwitansiList}
            onOpenPrintModal={(weekNum, mode) => handleOpenPrint(mode || 'UPAH', undefined, weekNum)}
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
        realSchoolData={appState.realSchoolData}
      />

      {/* Full Document Printable Viewer Modal */}
      <PrintDocumentViewer
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        documentType={printDocType}
        selectedMonth={printMonth}
        selectedWeekNum={printWeekNum}
        selectedKwitansiId={printKwitansiId}
        filterOptions={printFilterOptions}
        school={appState.school}
        rpdItems={appState.rpdItems}
        kwitansiList={appState.kwitansiList}
        wageReports={appState.wageReports}
        bkuList={bkuList}
        bktList={bktList}
        bkbList={appState.bkbRecords}
        taxRecords={taxRecords}
        progressWeeks={appState.progressWeeks}
        workers={appState.workers}
        realSchoolData={appState.realSchoolData}
      />

      {/* Confirmation Modal: Delete School & Database */}
      {tenantToDeleteConfirm && (
        <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-md w-full p-6 text-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Sekolah</h3>
                <p className="text-xs text-rose-600 font-semibold">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
              <p>
                Anda akan menghapus permanen database sekolah:
              </p>
              <p className="font-bold text-sm text-rose-950 font-sans">
                {tenantToDeleteConfirm.namaSekolah}
              </p>
              <div className="text-[11px] text-slate-600 flex items-center gap-2">
                <span>NPSN: <b className="font-mono">{tenantToDeleteConfirm.npsn || '-'}</b></span>
                <span>•</span>
                <span>{tenantToDeleteConfirm.kabKota || '-'}</span>
              </div>
              <p className="text-[11px] text-rose-700 pt-2 border-t border-rose-200/60 font-medium">
                ⚠️ Seluruh database cloud Firestore, data RPD, analisa AHSP, Kwitansi, Bon Toko, Buku Kas (BKU/BKT/BKB), dan laporan pajak sekolah ini akan dihapus secara permanen dan dihilangkan dari tampilan.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingTenantLoading}
                onClick={() => setTenantToDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingTenantLoading}
                onClick={handleConfirmDeleteTenant}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
              >
                {isDeletingTenantLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus Database...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Sekolah & Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
