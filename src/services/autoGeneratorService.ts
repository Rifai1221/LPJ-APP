import {
  BkuTransaction,
  BktTransaction,
  BkbTransaction,
  KwitansiDocument,
  TaxRecord,
  SchoolMasterData,
  RpdItem,
  ProjectProgressWeek,
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
  if (!deletedIds.includes('bku-init-1')) {
    if (manualInit1) {
      result.push(manualInit1);
    } else {
      result.push({
        id: 'bku-init-1',
        tanggal: startProjectDateSlash,
        tanggalObj: startProjectDateIso,
        bulan: startProjectBulan,
        jenis: 'PENERIMAAN',
        uraian: 'Penarikan dari Bank (Termin 1 - 70%)',
        noBukti: 'BKT-01',
        penerimaan: school.termin1Nilai || 537580794,
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

    // Enforce invariant: tanggal transaksi otomatis jangan kurang dari tanggal mulai Laporan Mingguan & Bobot
    if (kw.mingguKeRef && progressWeeks && progressWeeks.length > 0) {
      const matchW = progressWeeks.find((w) => w.mingguKe === kw.mingguKeRef);
      if (matchW) {
        const resolvedW = resolveWeekDates(matchW, yearStr);
        if (sortDate < resolvedW.startDate) {
          sortDate = resolvedW.startDate;
          displayTanggal = resolvedW.startDateSlash;
        }
      }
    }
    if (sortDate < startProjectDateIso) {
      sortDate = startProjectDateIso;
      displayTanggal = startProjectDateSlash;
    }

    result.push({
      id: kwBkuId,
      tanggal: displayTanggal,
      tanggalObj: sortDate,
      bulan: kw.bulan || startProjectBulan,
      jenis: 'PENGELUARAN',
      uraian: kw.tipe === 'UPAH' 
        ? kw.uraian.replace('Pembayaran Lunas Biaya ', 'Bayar ') 
        : `Bayar Bahan Dari ${kw.namaToko || kw.penerimaNama}`,
      noBukti: kw.noBukti,
      penerimaan: 0,
      pengeluaran: kw.nominal,
      kategoriBiaya: kw.kategoriBiayaPajak,
      kwitansiIdRef: kw.id,
    });
  });

  // 3. Add Termin 2 bank withdrawal
  const manualInit2 = manualTransactions.find((m) => m.id === 'bku-init-2');
  if (!deletedIds.includes('bku-init-2')) {
    if (manualInit2) {
      result.push(manualInit2);
    } else {
      result.push({
        id: 'bku-init-2',
        tanggal: termin2DateSlash,
        tanggalObj: termin2DateIso,
        bulan: termin2Bulan,
        jenis: 'PENERIMAAN',
        uraian: 'Penarikan dari Bank (Termin 2 - 30%)',
        noBukti: 'BKT-02',
        penerimaan: school.termin2Nilai || 230391769,
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
