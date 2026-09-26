import {
  BkuTransaction,
  BktTransaction,
  BkbTransaction,
  KwitansiDocument,
  TaxRecord,
  SchoolMasterData,
  RpdItem,
  ProjectProgressWeek,
  WorkerItem,
  StoreVendor,
  WeeklyWageReport,
  RealSchoolData,
  RabDivision,
  RabSubItem,
} from '../types';
import { resolveWeekDates } from '../utils/monthHelper';

export function calculateBkuFromTransactions(
  kwitansiList: KwitansiDocument[],
  school: SchoolMasterData,
  manualTransactions: BkuTransaction[] = [],
  progressWeeks: ProjectProgressWeek[] = [],
  deletedIds: string[] = []
): BkuTransaction[] {
  const result: BkuTransaction[] = [];
  const yearStr = school?.tahunAnggaran?.trim() || '2026';

  // Determine starting date strictly from Laporan Mingguan & Bobot input
  let startProjectDateIso = `${yearStr}-07-01`;
  let startProjectDateSlash = `01/07/${yearStr}`;
  let startProjectBulan = `Juli ${yearStr}`;

  if (progressWeeks && progressWeeks.length > 0) {
    const week1 = progressWeeks.find((w) => w.mingguKe === 1) || progressWeeks[0];
    const resolved1 = resolveWeekDates(week1, yearStr);
    startProjectDateIso = resolved1.startDate;
    startProjectDateSlash = resolved1.startDateSlash;
    startProjectBulan = resolved1.bulan;
  }

  // Determine Termin 2 date from mid-project week (e.g. week 8)
  let termin2DateIso = `${yearStr}-09-01`;
  let termin2DateSlash = `01/09/${yearStr}`;
  let termin2Bulan = `September ${yearStr}`;

  if (progressWeeks && progressWeeks.length > 0) {
    const week8 = progressWeeks.find((w) => w.mingguKe === 8) || progressWeeks[Math.min(7, progressWeeks.length - 1)];
    const resolved8 = resolveWeekDates(week8, yearStr);
    termin2DateIso = resolved8.startDate;
    termin2DateSlash = resolved8.startDateSlash;
    termin2Bulan = resolved8.bulan;
  }

  // 1. Initial Deposit / Penarikan Termin 1 (70%)
  // Sesuai juknis: Tanggal mulai pencatatan tidak boleh kurang dari tanggal mulai Laporan Mingguan & Bobot
  const manualInit1 = manualTransactions.find((m) => m.id === 'bku-init-1');
  const termin1Amount = school?.termin1Nilai || (school?.totalAnggaran ? Math.round(school.totalAnggaran * ((school.termin1Persen || 70) / 100)) : 0);

  if (!deletedIds.includes('bku-init-1')) {
    if (manualInit1) {
      result.push(manualInit1);
    } else if (termin1Amount > 0 && (kwitansiList.length > 0 || manualTransactions.length > 0)) {
      result.push({
        id: 'bku-init-1',
        tanggal: startProjectDateSlash,
        tanggalObj: startProjectDateIso,
        bulan: startProjectBulan,
        jenis: 'PENERIMAAN',
        uraian: 'Penarikan dari Bank (Termin 1 - 70%)',
        noBukti: 'BKT-01',
        penerimaan: termin1Amount,
        pengeluaran: 0,
      });
    }
  }

  // 2. Map all Kwitansi into BKU rows
  kwitansiList.forEach((kw) => {
    const kwBkuId = `bku-kw-${kw.id}`;
    if (deletedIds.includes(kw.id) || deletedIds.includes(kwBkuId)) {
      return;
    }

    // Check if user manually edited this transaction in BKU
    const manualKwOverride = manualTransactions.find(
      (m) => m.id === kwBkuId || m.kwitansiIdRef === kw.id
    );
    if (manualKwOverride) {
      result.push(manualKwOverride);
      return;
    }

    // Determine sortable date format YYYY-MM-DD and display DD/MM/YYYY
    let sortDate = startProjectDateIso;
    let displayTanggal = kw.tanggal || startProjectDateSlash;

    if (kw.tanggal) {
      if (kw.tanggal.includes('/')) {
        const parts = kw.tanggal.split('/');
        if (parts.length === 3) {
          const [d, m, y] = parts;
          sortDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          displayTanggal = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
        }
      } else if (kw.tanggal.includes('-')) {
        const parts = kw.tanggal.split('-');
        if (parts.length === 3) {
          const [y, m, d] = parts;
          sortDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          displayTanggal = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
        }
      }
    }

    // Enforce business rules:
    // 1. Pembayaran upah tukang, perencana, pengawas, dan administrasi dibayarkan pada setiap tanggal AKHIR MINGGU
    // 2. Tanggal transaksi belanja/material jangan pernah kurang dari tanggal mulai Laporan Mingguan & Bobot
    if (kw.mingguKeRef && progressWeeks && progressWeeks.length > 0) {
      const matchW = progressWeeks.find((w) => w.mingguKe === kw.mingguKeRef);
      if (matchW) {
        const resolvedW = resolveWeekDates(matchW, yearStr);
        const isAkhirMingguPayment =
          kw.tipe === 'UPAH' ||
          kw.tipe === 'KONSULTAN' ||
          /upah|tukang|pekerja|perencana|pengawas|administrasi|pengelolaan/i.test(kw.uraian) ||
          /uk\/|kons-p|kons-w|adm\//i.test(kw.noBukti || '') ||
          /upah|tukang|pekerja|perencana|pengawas|administrasi|pengelolaan/i.test(kw.keteranganSpb || '');

        if (isAkhirMingguPayment) {
          sortDate = resolvedW.endDate;
          displayTanggal = resolvedW.endDateSlash;
        } else if (sortDate < resolvedW.startDate) {
          sortDate = resolvedW.startDate;
          displayTanggal = resolvedW.startDateSlash;
        }
      }
    }
    if (sortDate < startProjectDateIso) {
      sortDate = startProjectDateIso;
      displayTanggal = startProjectDateSlash;
    }

    let bkuUraian = kw.uraian;
    if (kw.tipe === 'UPAH') {
      bkuUraian = kw.uraian.replace('Pembayaran Lunas Biaya ', 'Bayar ');
    } else if (/perencana/i.test(kw.uraian)) {
      bkuUraian = `Bayar Honorarium Jasa Perencana Teknis (${kw.penerimaNama || 'Zulfahmi, ST'})`;
    } else if (/pengawas/i.test(kw.uraian)) {
      bkuUraian = `Bayar Honorarium Jasa Pengawas Lapangan (${kw.penerimaNama || 'M. Aris Syahputra, ST'})`;
    } else if (/administrasi|pengelolaan/i.test(kw.uraian)) {
      bkuUraian = `Bayar Biaya Pengelolaan Administrasi LPJ (${kw.penerimaNama || 'IRWAN YUSUF'})`;
    } else {
      bkuUraian = `Bayar Bahan Dari ${kw.namaToko || kw.penerimaNama}`;
    }

    result.push({
      id: kwBkuId,
      tanggal: displayTanggal,
      tanggalObj: sortDate,
      bulan: kw.bulan || startProjectBulan,
      jenis: 'PENGELUARAN',
      uraian: bkuUraian,
      noBukti: kw.noBukti,
      penerimaan: 0,
      pengeluaran: kw.nominal,
      kategoriBiaya: kw.kategoriBiayaPajak,
      kwitansiIdRef: kw.id,
    });
  });

  // 3. Add Termin 2 bank withdrawal
  const manualInit2 = manualTransactions.find((m) => m.id === 'bku-init-2');
  const termin2Amount = school?.termin2Nilai || (school?.totalAnggaran ? Math.round(school.totalAnggaran * ((school.termin2Persen || 30) / 100)) : 0);

  if (!deletedIds.includes('bku-init-2')) {
    if (manualInit2) {
      result.push(manualInit2);
    } else if (termin2Amount > 0 && kwitansiList.some((k) => (k.mingguKeRef || 0) >= 8)) {
      result.push({
        id: 'bku-init-2',
        tanggal: termin2DateSlash,
        tanggalObj: termin2DateIso,
        bulan: termin2Bulan,
        jenis: 'PENERIMAAN',
        uraian: 'Penarikan dari Bank (Termin 2 - 30%)',
        noBukti: 'BKT-02',
        penerimaan: termin2Amount,
        pengeluaran: 0,
      });
    }
  }

  // 4. Merge other manual transactions
  manualTransactions.forEach((tx) => {
    if (
      !deletedIds.includes(tx.id) &&
      tx.id !== 'bku-init-1' &&
      tx.id !== 'bku-init-2' &&
      !result.some((r) => r.id === tx.id)
    ) {
      result.push(tx);
    }
  });

  // Sort chronologically
  result.sort((a, b) => {
    if (a.tanggalObj === b.tanggalObj) {
      if (a.jenis === 'PENERIMAAN' && b.jenis === 'PENGELUARAN') return -1;
      if (a.jenis === 'PENGELUARAN' && b.jenis === 'PENERIMAAN') return 1;
      return 0;
    }
    return a.tanggalObj.localeCompare(b.tanggalObj);
  });

  // Compute running balance
  let currentSaldo = 0;
  return result.map((tx) => {
    if (tx.jenis === 'PENERIMAAN') {
      currentSaldo += tx.penerimaan;
    } else {
      currentSaldo -= tx.pengeluaran;
    }
    return {
      ...tx,
      saldo: currentSaldo,
    };
  });
}

export function calculateBktFromBku(bkuList: BkuTransaction[]): BktTransaction[] {
  let saldo = 0;
  return bkuList.map((item) => {
    if (item.jenis === 'PENERIMAAN') {
      saldo += item.penerimaan;
      return {
        id: `bkt-${item.id}`,
        tanggal: item.tanggal,
        tanggalObj: item.tanggalObj,
        bulan: item.bulan,
        uraian: item.uraian,
        noBukti: item.noBukti,
        pemasukan: item.penerimaan,
        pengeluaran: 0,
        saldo: saldo,
      };
    } else {
      saldo -= item.pengeluaran;
      return {
        id: `bkt-${item.id}`,
        tanggal: item.tanggal,
        tanggalObj: item.tanggalObj,
        bulan: item.bulan,
        uraian: item.uraian,
        noBukti: item.noBukti,
        pemasukan: 0,
        pengeluaran: item.pengeluaran,
        saldo: saldo,
      };
    }
  });
}

export function generateTaxesFromKwitansi(kwitansiList: KwitansiDocument[]): TaxRecord[] {
  let counter = 1;
  return kwitansiList.map((kw) => {
    const isKonsultan = kw.tipe === 'KONSULTAN' || kw.tipe === 'OPERASIONAL';
    const isPerabot = kw.tipe === 'PERABOT';
    const isPeralatan = false;
    const isKonstruksi = kw.tipe === 'MATERIAL' || kw.tipe === 'UPAH';

    const nominalKonstruksi = isKonstruksi ? kw.nominal : 0;
    const nominalPerabot = isPerabot ? kw.nominal : 0;
    const nominalPeralatan = isPeralatan ? kw.nominal : 0;
    const nominalKonsultanAdm = isKonsultan ? kw.nominal : 0;

    let ppn = 0;
    let pph22 = 0;
    let pph23 = 0;

    if (kw.isPpn) {
      ppn = kw.ppnAmount || Math.round((kw.nominal / 1.11) * 0.11 * 100) / 100;
    }
    if (kw.isPph22) {
      pph22 = kw.pph22Amount || Math.round((kw.nominal / 1.11) * 0.015 * 100) / 100;
    }
    if (kw.isPph23) {
      pph23 = kw.pph23Amount || Math.round(kw.nominal * 0.04 * 100) / 100;
    }

    return {
      id: `tax-${kw.id}`,
      noUrut: counter++,
      noBukti: kw.noBukti,
      tanggal: kw.tanggal,
      bulan: kw.bulan,
      keperluan: kw.uraian.replace('Pembayaran Lunas Biaya ', 'Bayar ').replace('Pembayaran Lunas ', 'Bayar '),
      nominalKonstruksi,
      nominalPerabot,
      nominalPeralatan,
      nominalKonsultanAdm,
      ppn11: ppn,
      pph22,
      pph23,
      totalPajak: ppn + pph22 + pph23,
    };
  });
}

export interface WeeklyGenerationParams {
  targetWeek: number;
  weekObj: ProjectProgressWeek;
  weeksToUse: ProjectProgressWeek[];
  school: SchoolMasterData;
  workers: WorkerItem[];
  stores: StoreVendor[];
  rpdItems: RpdItem[];
  realSchoolData?: RealSchoolData;
  existingKwitansi: KwitansiDocument[];
  existingWageReports: WeeklyWageReport[];
  existingBkb: BkbTransaction[];
  splitDays?: boolean;
}

export interface WeeklyGenerationResult {
  updatedKwitansi: KwitansiDocument[];
  updatedWageReports: WeeklyWageReport[];
  updatedBkb: BkbTransaction[];
  generatedCount: {
    bahan: number;
    upah: number;
    alat: number;
    smkk: number;
    manajemen: number;
  };
}

export function generateWeeklyTransactionsFromProgressAndRealData({
  targetWeek,
  weekObj,
  weeksToUse,
  school,
  workers = [],
  stores = [],
  rpdItems = [],
  realSchoolData,
  existingKwitansi,
  existingWageReports,
  existingBkb,
  splitDays = true,
}: WeeklyGenerationParams): WeeklyGenerationResult {
  const yearStr = school?.tahunAnggaran?.trim() || '2026';
  const weekDates = resolveWeekDates(weekObj, yearStr);
  const bulan = weekDates.bulan;
  const dateEndStr = weekDates.endDateSlash;
  const formattedDateEnd = weekDates.endDateFormatted;
  const formattedDateStart = weekDates.startDateFormatted;

  const newKwitansiList: KwitansiDocument[] = [...existingKwitansi];
  const updatedWageReports: WeeklyWageReport[] = [...existingWageReports];
  const updatedBkb: BkbTransaction[] = [...existingBkb];

  const generatedCount = {
    bahan: 0,
    upah: 0,
    alat: 0,
    smkk: 0,
    manajemen: 0,
  };

  // 1. Initial Deposit in BKB (Termin 1) if not existing yet and budget > 0
  const hasTermin1Bkb = updatedBkb.some((b) => b.noBukti === 'KREDIT-T1' || b.id === 'bkb-init-termin1');
  const termin1Amount = school?.termin1Nilai || (school?.totalAnggaran ? Math.round(school.totalAnggaran * 0.7) : 0);
  if (!hasTermin1Bkb && termin1Amount > 0 && weeksToUse.length > 0) {
    const w1 = weeksToUse[0];
    const w1Dates = resolveWeekDates(w1, yearStr);
    updatedBkb.unshift({
      id: 'bkb-init-termin1',
      tanggal: w1Dates.startDateSlash,
      tanggalObj: w1Dates.startDate,
      bulan: w1Dates.bulan,
      uraian: 'Penerimaan Dana Revitalisasi Termin 1 (70%) ke Rekening Bank',
      noBukti: 'KREDIT-T1',
      penerimaan: termin1Amount,
      pengeluaran: 0,
    });
  }

  // Find active divisions for this week
  const activeDivisions = (weekObj.divisions || []).filter((d) => d.prestasiMingguIni > 0);

  // Prepare fallback store
  const defaultMaterialStore = stores.find((s) => s.kategori === 'MATERIAL') || stores[0] || {
    id: 's-def-mat',
    namaToko: 'Penyedia Bahan Material',
    pemilikNama: 'Penyedia Toko Rekanan',
    pekerjaan: 'Penyedia Bahan Bangunan',
    alamat: school.kabKota || 'Kota/Kabupaten Setempat',
    telepon: '-',
    kategori: 'MATERIAL',
  };

  const defaultPerabotStore = stores.find((s) => s.kategori === 'PERABOT') || defaultMaterialStore;

  let totalWageAmountForWeek = 0;
  let activeDivisionDescriptions: string[] = [];

  // Iterate each active division
  activeDivisions.forEach((div, dIdx) => {
    activeDivisionDescriptions.push(div.uraian);
    const progressRatio = div.bobotTotal > 0 ? div.prestasiMingguIni / div.bobotTotal : 0.1;

    // Find real division in RealSchoolData
    const realDiv = realSchoolData?.divisions?.find(
      (rd: RabDivision) =>
        rd.kode.toUpperCase() === div.kode.toUpperCase() ||
        rd.uraian.toLowerCase().includes(div.uraian.toLowerCase()) ||
        div.uraian.toLowerCase().includes(rd.uraian.toLowerCase())
    );

    // If RealSchoolData division exists
    if (realDiv && realDiv.items && realDiv.items.length > 0) {
      // 1. Group items by category: BAHAN, UPAH, ALAT, SMKK, LAINNYA
      const bahanItems: { namaBarang: string; volume: number; satuan: string; hargaSatuan: number; jumlah: number }[] = [];
      const alatItems: { namaBarang: string; volume: number; satuan: string; hargaSatuan: number; jumlah: number }[] = [];
      const smkkItems: { namaBarang: string; volume: number; satuan: string; hargaSatuan: number; jumlah: number }[] = [];
      let divUpahTotal = 0;

      realDiv.items.forEach((it: RabSubItem) => {
        const cat = it.kategoriBiaya || (
          /upah|gaji|pekerja|tukang|mandor/i.test(it.uraian) ? 'UPAH' :
          /alat|sewa|molen|scaffolding|perancah|gerobak/i.test(it.uraian) ? 'ALAT' :
          /smkk|k3|helm|rompi|sepatu|p3k|rambu|papan nama/i.test(it.uraian) ? 'SMKK' :
          'BAHAN'
        );

        const itVol = Math.max(0.01, Math.round(it.volume * progressRatio * 100) / 100);
        const itJml = Math.round(itVol * it.hargaSatuan);

        if (cat === 'UPAH') {
          divUpahTotal += itJml;
        } else if (cat === 'ALAT') {
          alatItems.push({
            namaBarang: it.uraian,
            volume: itVol,
            satuan: it.satuan,
            hargaSatuan: it.hargaSatuan,
            jumlah: itJml,
          });
        } else if (cat === 'SMKK' || cat === 'LAINNYA') {
          smkkItems.push({
            namaBarang: it.uraian,
            volume: itVol,
            satuan: it.satuan,
            hargaSatuan: it.hargaSatuan,
            jumlah: itJml,
          });
        } else {
          // BAHAN
          bahanItems.push({
            namaBarang: it.uraian,
            volume: itVol,
            satuan: it.satuan,
            hargaSatuan: it.hargaSatuan,
            jumlah: itJml,
          });
        }
      });

      totalWageAmountForWeek += divUpahTotal;

      // 2. Process BAHAN Kwitansi, Bon Toko, & SPB
      if (bahanItems.length > 0) {
        const totalBahanNominal = bahanItems.reduce((s, it) => s + it.jumlah, 0);
        const chunkCount = splitDays && bahanItems.length > 2 ? 2 : 1;
        const halfIndex = Math.ceil(bahanItems.length / chunkCount);

        for (let c = 0; c < chunkCount; c++) {
          const chunkItems = chunkCount === 1 ? bahanItems : c === 0 ? bahanItems.slice(0, halfIndex) : bahanItems.slice(halfIndex);
          const chunkNominal = chunkItems.reduce((s, it) => s + it.jumlah, 0);
          if (chunkNominal <= 0) continue;

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
          const seqNo = targetWeek * 10 + dIdx * 2 + c + 1;
          const kwMatBukti = `${String(seqNo).padStart(2, '0')}/KW-MAT/${yearStr}`;
          const spbBukti = `SPB-${String(seqNo).padStart(2, '0')}/MAT/${yearStr}`;

          const isTaxable = chunkNominal >= 2000000;
          const ppn = isTaxable ? Math.round((chunkNominal / 1.11) * 0.11 * 100) / 100 : 0;
          const pph22 = isTaxable ? Math.round((chunkNominal / 1.11) * 0.015 * 100) / 100 : 0;

          const isPerabot = div.kode === 'XII' || /perabot|mebeler|meja|kursi/i.test(div.uraian);
          const targetStore = isPerabot ? defaultPerabotStore : defaultMaterialStore;

          const matKwDoc: KwitansiDocument = {
            id: `kw-mat-m${targetWeek}-${dIdx}-${c}-${Date.now()}`,
            noBukti: kwMatBukti,
            noSpb: spbBukti,
            tipe: isPerabot ? 'PERABOT' : 'MATERIAL',
            tanggal: dayOffsetStr,
            tanggalFormatted: dayOffsetFormatted,
            bulan: dayOffsetBulan,
            uraian: `Pembayaran Lunas Biaya Pembelian Material/Bahan (${chunkItems.map((i) => i.namaBarang).slice(0, 3).join(', ')}), Untuk Pekerjaan ${div.uraian} Revitalisasi ${school.namaSekolah}, Tahun ${yearStr}, Daftar Terlampir.`,
            penerimaNama: targetStore.pemilikNama || 'Pemilik Toko',
            penerimaPekerjaan: `Pemilik ${targetStore.namaToko}`,
            penerimaAlamat: targetStore.alamat || school.kabKota,
            namaToko: targetStore.namaToko,
            items: chunkItems,
            nominal: chunkNominal,
            isPpn: isTaxable,
            isPph22: isTaxable,
            isPph23: false,
            ppnAmount: ppn,
            pph22Amount: pph22,
            pph23Amount: 0,
            kategoriBiayaPajak: isPerabot ? 'Perabot' : 'Konstruksi',
            keteranganSpb: `Surat Perintah Bayar Pembelian Bahan Material ${div.uraian} Minggu Ke-${targetWeek} (${formattedDateStart} - ${formattedDateEnd})`,
            mingguKeRef: targetWeek,
          };

          const existingIdx = newKwitansiList.findIndex((k) => k.noBukti === kwMatBukti);
          if (existingIdx >= 0) {
            newKwitansiList[existingIdx] = matKwDoc;
          } else {
            newKwitansiList.push(matKwDoc);
          }
          generatedCount.bahan++;
        }
      }

      // 3. Process ALAT Kwitansi & SPB
      if (alatItems.length > 0) {
        const alatNominal = alatItems.reduce((s, it) => s + it.jumlah, 0);
        if (alatNominal > 0) {
          const seqAlat = targetWeek * 10 + dIdx + 7;
          const kwAlatBukti = `${String(seqAlat).padStart(2, '0')}/KW-ALAT/${yearStr}`;
          const spbAlatBukti = `SPB-${String(seqAlat).padStart(2, '0')}/ALAT/${yearStr}`;
          const pph23 = Math.round(alatNominal * 0.02 * 100) / 100;

          const alatDoc: KwitansiDocument = {
            id: `kw-alat-m${targetWeek}-${dIdx}-${Date.now()}`,
            noBukti: kwAlatBukti,
            noSpb: spbAlatBukti,
            tipe: 'OPERASIONAL',
            tanggal: dateEndStr,
            tanggalFormatted: formattedDateEnd,
            bulan: bulan,
            uraian: `Pembayaran Lunas Biaya Sewa/Pengadaan Alat Bantu Kerja (${alatItems.map((i) => i.namaBarang).join(', ')}), Untuk Pekerjaan ${div.uraian} Revitalisasi ${school.namaSekolah}, Tahun ${yearStr}.`,
            penerimaNama: defaultMaterialStore.pemilikNama || 'Penyedia Sewa Alat',
            penerimaPekerjaan: `Penyedia Alat & Perlengkapan`,
            penerimaAlamat: defaultMaterialStore.alamat || school.kabKota,
            namaToko: defaultMaterialStore.namaToko,
            items: alatItems,
            nominal: alatNominal,
            isPpn: false,
            isPph22: false,
            isPph23: true,
            ppnAmount: 0,
            pph22Amount: 0,
            pph23Amount: pph23,
            kategoriBiayaPajak: 'Peralatan',
            keteranganSpb: `Surat Perintah Bayar Sewa/Alat Bantu Kerja ${div.uraian} Minggu Ke-${targetWeek}`,
            mingguKeRef: targetWeek,
          };

          const existAlatIdx = newKwitansiList.findIndex((k) => k.noBukti === kwAlatBukti);
          if (existAlatIdx >= 0) {
            newKwitansiList[existAlatIdx] = alatDoc;
          } else {
            newKwitansiList.push(alatDoc);
          }
          generatedCount.alat++;
        }
      }

      // 4. Process SMKK & PERSIAPAN Kwitansi & SPB
      if (smkkItems.length > 0) {
        const smkkNominal = smkkItems.reduce((s, it) => s + it.jumlah, 0);
        if (smkkNominal > 0) {
          const seqSmkk = targetWeek * 10 + dIdx + 8;
          const kwSmkkBukti = `${String(seqSmkk).padStart(2, '0')}/KW-SMKK/${yearStr}`;
          const spbSmkkBukti = `SPB-${String(seqSmkk).padStart(2, '0')}/SMKK/${yearStr}`;
          const isTaxable = smkkNominal >= 2000000;
          const ppn = isTaxable ? Math.round((smkkNominal / 1.11) * 0.11 * 100) / 100 : 0;
          const pph22 = isTaxable ? Math.round((smkkNominal / 1.11) * 0.015 * 100) / 100 : 0;

          const smkkDoc: KwitansiDocument = {
            id: `kw-smkk-m${targetWeek}-${dIdx}-${Date.now()}`,
            noBukti: kwSmkkBukti,
            noSpb: spbSmkkBukti,
            tipe: 'OPERASIONAL',
            tanggal: dateEndStr,
            tanggalFormatted: formattedDateEnd,
            bulan: bulan,
            uraian: `Pembayaran Lunas Pengadaan Perlengkapan SMKK & K3 Lapangan (${smkkItems.map((i) => i.namaBarang).slice(0, 3).join(', ')}), Revitalisasi ${school.namaSekolah}, Tahun ${yearStr}.`,
            penerimaNama: defaultMaterialStore.pemilikNama || 'Penyedia SMKK',
            penerimaPekerjaan: `Penyedia APD & Keselamatan Kerja`,
            penerimaAlamat: defaultMaterialStore.alamat || school.kabKota,
            namaToko: defaultMaterialStore.namaToko,
            items: smkkItems,
            nominal: smkkNominal,
            isPpn: isTaxable,
            isPph22: isTaxable,
            isPph23: false,
            ppnAmount: ppn,
            pph22Amount: pph22,
            pph23Amount: 0,
            kategoriBiayaPajak: 'Peralatan',
            keteranganSpb: `Surat Perintah Bayar Pengadaan SMKK & K3 Minggu Ke-${targetWeek}`,
            mingguKeRef: targetWeek,
          };

          const existSmkkIdx = newKwitansiList.findIndex((k) => k.noBukti === kwSmkkBukti);
          if (existSmkkIdx >= 0) {
            newKwitansiList[existSmkkIdx] = smkkDoc;
          } else {
            newKwitansiList.push(smkkDoc);
          }
          generatedCount.smkk++;
        }
      }
    } else {
      // Fallback: Use RPD items if RealSchoolData division not available
      const matchedRpd = rpdItems.filter(
        (it) =>
          it.uraian.toLowerCase().includes(div.uraian.toLowerCase()) ||
          div.uraian.toLowerCase().includes(it.uraian.toLowerCase()) ||
          it.kategori === 'BAHAN_BARU' ||
          it.kategori === 'BAHAN_REHAB'
      );

      const rpdCandidates = matchedRpd.slice(0, 3);
      if (rpdCandidates.length > 0) {
        const tokoItems = rpdCandidates.map((it) => {
          const volProp = Math.max(0.1, Math.round(progressRatio * it.volume100 * 100) / 100);
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
          const seqNo = targetWeek * 10 + dIdx + 1;
          const kwMatBukti = `${String(seqNo).padStart(2, '0')}/KW-MAT/${yearStr}`;
          const spbBukti = `SPB-${String(seqNo).padStart(2, '0')}/MAT/${yearStr}`;
          const isTaxable = nominalMaterial >= 2000000;
          const ppn = isTaxable ? Math.round((nominalMaterial / 1.11) * 0.11 * 100) / 100 : 0;
          const pph22 = isTaxable ? Math.round((nominalMaterial / 1.11) * 0.015 * 100) / 100 : 0;

          const matDoc: KwitansiDocument = {
            id: `kw-mat-rpd-m${targetWeek}-${dIdx}-${Date.now()}`,
            noBukti: kwMatBukti,
            noSpb: spbBukti,
            tipe: 'MATERIAL',
            tanggal: dateEndStr,
            tanggalFormatted: formattedDateEnd,
            bulan: bulan,
            uraian: `Pembayaran Lunas Biaya Pembelian Material (${tokoItems.map((i) => i.namaBarang).join(', ')}), Pekerjaan ${div.uraian} Revitalisasi ${school.namaSekolah}`,
            penerimaNama: defaultMaterialStore.pemilikNama || 'Pemilik Toko',
            penerimaPekerjaan: `Pemilik ${defaultMaterialStore.namaToko}`,
            penerimaAlamat: defaultMaterialStore.alamat || school.kabKota,
            namaToko: defaultMaterialStore.namaToko,
            items: tokoItems,
            nominal: nominalMaterial,
            isPpn: isTaxable,
            isPph22: isTaxable,
            isPph23: false,
            ppnAmount: ppn,
            pph22Amount: pph22,
            pph23Amount: 0,
            kategoriBiayaPajak: 'Konstruksi',
            keteranganSpb: `Surat Perintah Bayar Bahan Material ${div.uraian} Minggu Ke-${targetWeek}`,
            mingguKeRef: targetWeek,
          };

          const existIdx = newKwitansiList.findIndex((k) => k.noBukti === kwMatBukti);
          if (existIdx >= 0) {
            newKwitansiList[existIdx] = matDoc;
          } else {
            newKwitansiList.push(matDoc);
          }
          generatedCount.bahan++;
        }
      }
    }

    // 5. Handle MANAJEMEN / KONSULTAN divisions
    if (div.kategori === 'MANAJEMEN' || /perencana|pengawas|administrasi/i.test(div.uraian)) {
      const isPerencana = /perencana/i.test(div.uraian);
      const isPengawas = /pengawas/i.test(div.uraian);
      const isAdm = /administrasi|pengelolaan/i.test(div.uraian);

      const nomBiaya = Math.max(
        250000,
        Math.round(progressRatio * (school.totalAnggaran || 500000000) * ((div.bobotTotal || 1) / 100))
      );

      let kwBukti = `ADM/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`;
      let penerimaNama = school.namaBendahara || 'Pengelola Administrasi';
      let penerimaPekerjaan = 'Pengelola Administrasi LPJ';
      let tipeKw: KwitansiDocument['tipe'] = 'OPERASIONAL';
      let isPph23 = false;
      let pph23Amount = 0;

      if (isPerencana) {
        kwBukti = `KONS-P/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`;
        penerimaNama = school.namaPerencana || 'Konsultan Perencana Teknis';
        penerimaPekerjaan = 'Konsultan Perencana Teknis';
        tipeKw = 'KONSULTAN';
        isPph23 = true;
        pph23Amount = Math.round(nomBiaya * 0.02 * 100) / 100;
      } else if (isPengawas) {
        kwBukti = `KONS-W/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`;
        penerimaNama = school.namaPengawas || 'Konsultan Pengawas Lapangan';
        penerimaPekerjaan = 'Konsultan Pengawas Lapangan';
        tipeKw = 'KONSULTAN';
        isPph23 = true;
        pph23Amount = Math.round(nomBiaya * 0.02 * 100) / 100;
      }

      const manKwDoc: KwitansiDocument = {
        id: `kw-man-m${targetWeek}-${dIdx}-${Date.now()}`,
        noBukti: kwBukti,
        noSpb: `SPB-${kwBukti}`,
        tipe: tipeKw,
        tanggal: dateEndStr,
        tanggalFormatted: formattedDateEnd,
        bulan: bulan,
        uraian: isPerencana
          ? `Pembayaran Lunas Honorarium Jasa Perencana Teknis Minggu Ke-${targetWeek} (${formattedDateStart} s.d ${formattedDateEnd}), Revitalisasi ${school.namaSekolah}`
          : isPengawas
          ? `Pembayaran Lunas Honorarium Jasa Pengawas Lapangan Minggu Ke-${targetWeek} (${formattedDateStart} s.d ${formattedDateEnd}), Revitalisasi ${school.namaSekolah}`
          : `Pembayaran Lunas Biaya Pengelolaan Administrasi LPJ Minggu Ke-${targetWeek} (${formattedDateStart} s.d ${formattedDateEnd}), Revitalisasi ${school.namaSekolah}`,
        penerimaNama,
        penerimaPekerjaan,
        penerimaAlamat: school.kabKota,
        nominal: nomBiaya,
        items: [
          {
            namaBarang: `Honorarium Jasa / Pengelolaan Minggu Ke-${targetWeek}`,
            volume: 1,
            satuan: 'Minggu',
            hargaSatuan: nomBiaya,
            jumlah: nomBiaya,
          },
        ],
        isPpn: false,
        isPph22: false,
        isPph23,
        ppnAmount: 0,
        pph22Amount: 0,
        pph23Amount,
        kategoriBiayaPajak: 'Perencanaan_Pengelolaan',
        keteranganSpb: `Surat Perintah Bayar Jasa/Honor Minggu Ke-${targetWeek} (${formattedDateStart} s.d ${formattedDateEnd})`,
        mingguKeRef: targetWeek,
      };

      const existManIdx = newKwitansiList.findIndex((k) => k.noBukti === kwBukti);
      if (existManIdx >= 0) {
        newKwitansiList[existManIdx] = manKwDoc;
      } else {
        newKwitansiList.push(manKwDoc);
      }
      generatedCount.manajemen++;
    }
  });

  // 6. Process UPAH & Weekly Wage Report
  // If upah was calculated from real items, use that; otherwise calculate from active workers
  const activeWorkersList: WorkerItem[] = workers && workers.length > 0 ? workers : [
    {
      id: 'w-def-1',
      nama: school.namaMandor || 'Mandor Proyek',
      jenisKelamin: 'L' as const,
      domisili: 'Dalam Desa' as const,
      peran: 'MANDOR',
      peranLabel: 'Mandor',
      upahHarian: 150000,
    },
    {
      id: 'w-def-2',
      nama: 'Tukang Ahli',
      jenisKelamin: 'L' as const,
      domisili: 'Dalam Desa' as const,
      peran: 'KEPALA_TUKANG',
      peranLabel: 'Kepala Tukang',
      upahHarian: 130000,
    },
    {
      id: 'w-def-3',
      nama: 'Pekerja Lapangan 1',
      jenisKelamin: 'L' as const,
      domisili: 'Dalam Desa' as const,
      peran: 'PEKERJA',
      peranLabel: 'Pekerja',
      upahHarian: 110000,
    },
    {
      id: 'w-def-4',
      nama: 'Pekerja Lapangan 2',
      jenisKelamin: 'L' as const,
      domisili: 'Dalam Desa' as const,
      peran: 'PEKERJA',
      peranLabel: 'Pekerja',
      upahHarian: 110000,
    },
  ];

  let currentWageReport = updatedWageReports.find((r) => r.mingguKe === targetWeek);
  const defaultAttendance = activeWorkersList.map((w, idx) => {
    const days: [number, number, number, number, number, number, number] = [1, 1, 1, 1, idx % 4 === 0 ? 0 : 1, 1, 1];
    const hok = days.reduce((a, b) => a + b, 0);
    const safeDomisili: 'Dalam Desa' | 'Luar Desa' = w.domisili === 'Luar Desa' ? 'Luar Desa' : 'Dalam Desa';
    return {
      workerId: w.id,
      nama: w.nama,
      jenisKelamin: w.jenisKelamin,
      domisili: safeDomisili,
      peran: w.peran,
      peranLabel: w.peranLabel,
      days,
      hok,
      upahHarian: w.upahHarian,
      totalUpah: hok * w.upahHarian,
    };
  });

  const totCalculatedUpah = totalWageAmountForWeek > 0
    ? totalWageAmountForWeek
    : defaultAttendance.reduce((s, a) => s + a.totalUpah, 0);

  const wageDocId = `wage-rep-m${targetWeek}`;
  const wageIdx = updatedWageReports.findIndex((r) => r.mingguKe === targetWeek);

  const wageReportDoc: WeeklyWageReport = {
    id: wageDocId,
    mingguKe: targetWeek,
    bulan,
    periodeStart: formattedDateStart,
    periodeEnd: formattedDateEnd,
    tanggalKwitansi: formattedDateEnd,
    noBuktiKwitansi: `UK/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`,
    penerimaNama: activeWorkersList[0]?.nama || 'Kepala Tukang',
    penerimaJabatan: activeWorkersList[0]?.peranLabel || 'Kepala Tukang',
    attendance: defaultAttendance,
    totalUpah: totCalculatedUpah,
    bobotMingguIni: weekObj.bobotRealisasi || 0,
    bobotKumulatif: weekObj.bobotRealisasi || 0,
  };

  if (wageIdx >= 0) {
    updatedWageReports[wageIdx] = wageReportDoc;
  } else {
    updatedWageReports.push(wageReportDoc);
  }

  // Generate or update Kwitansi Upah Tukang
  const kwUpahBukti = `UK/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`;
  const upahKwIdx = newKwitansiList.findIndex((k) => k.mingguKeRef === targetWeek || k.noBukti === kwUpahBukti);
  const upahKwDoc: KwitansiDocument = {
    id: upahKwIdx >= 0 ? newKwitansiList[upahKwIdx].id : `kw-wage-m${targetWeek}-${Date.now()}`,
    noBukti: kwUpahBukti,
    noSpb: `SPB-UPAH/${targetWeek < 10 ? '0' + targetWeek : targetWeek}/${yearStr}`,
    tipe: 'UPAH',
    tanggal: dateEndStr, // Dibayar setiap tanggal akhir minggu
    tanggalFormatted: formattedDateEnd,
    bulan: bulan,
    uraian: `Pembayaran Lunas Biaya Upah Tukang & Pekerja Minggu ${targetWeek} (${formattedDateStart} s.d ${formattedDateEnd}), Untuk Pekerjaan Revitalisasi ${school.namaSekolah}, Tahun ${yearStr}, Daftar Terlampir.`,
    penerimaNama: activeWorkersList[0]?.nama || 'Kepala Tukang',
    penerimaPekerjaan: activeWorkersList[0]?.peranLabel || 'Kepala Tukang',
    penerimaAlamat: school.kabKota,
    nominal: totCalculatedUpah,
    items: [
      {
        namaBarang: `Upah Tukang & Pekerja Minggu ${targetWeek} (${formattedDateStart} - ${formattedDateEnd})`,
        volume: 1,
        satuan: 'Minggu',
        hargaSatuan: totCalculatedUpah,
        jumlah: totCalculatedUpah,
      },
    ],
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
    newKwitansiList.push(upahKwDoc);
  }
  generatedCount.upah++;

  return {
    updatedKwitansi: newKwitansiList,
    updatedWageReports,
    updatedBkb,
    generatedCount,
  };
}
