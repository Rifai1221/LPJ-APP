import {
  BkuTransaction,
  BktTransaction,
  BkbTransaction,
  KwitansiDocument,
  TaxRecord,
  SchoolMasterData,
  RpdItem,
} from '../types';

export function calculateBkuFromTransactions(
  kwitansiList: KwitansiDocument[],
  school: SchoolMasterData,
  manualTransactions: BkuTransaction[] = []
): BkuTransaction[] {
  const result: BkuTransaction[] = [];

  // 1. Initial Deposit / Penarikan Termin 1 (Oktober 2025)
  result.push({
    id: 'bku-init-1',
    tanggal: '13/10/2025',
    tanggalObj: '2025-10-13',
    bulan: 'Oktober 2025',
    jenis: 'PENERIMAAN',
    uraian: 'Penarikan dari Bank',
    noBukti: '-',
    penerimaan: school.termin1Nilai || 537580794,
    pengeluaran: 0,
  });

  // 2. Map all Kwitansi into BKU rows
  kwitansiList.forEach((kw) => {
    // Determine sortable date format YYYY-MM-DD
    let sortDate = '2025-10-15';
    if (kw.tanggal.includes('/')) {
      const [d, m, y] = kw.tanggal.split('/');
      sortDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    result.push({
      id: `bku-kw-${kw.id}`,
      tanggal: kw.tanggal,
      tanggalObj: sortDate,
      bulan: kw.bulan || 'Oktober 2025',
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

  // 3. Add Termin 2 bank withdrawal in December
  result.push({
    id: 'bku-init-2',
    tanggal: '16/12/2025',
    tanggalObj: '2025-12-16',
    bulan: 'Desember 2025',
    jenis: 'PENERIMAAN',
    uraian: 'Penarikan dari Bank (Termin 2 - 30%)',
    noBukti: '-',
    penerimaan: school.termin2Nilai || 230391769,
    pengeluaran: 0,
  });

  // Merge manual transactions if any
  manualTransactions.forEach((tx) => {
    if (!result.some((r) => r.id === tx.id)) {
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
