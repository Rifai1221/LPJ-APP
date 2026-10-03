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
import { resolveWeekDates, parseTxDateToIso } from '../utils/monthHelper';
import { getAhspWageRateForRole } from '../utils/divisionHelper';

export function getDateInWeek(startDateIso: string, dayOffset: number) {
  const sBase = new Date(`${startDateIso}T00:00:00`);
  const clampedOffset = Math.min(6, Math.max(0, dayOffset));
  const targetDate = new Date(sBase.getTime() + clampedOffset * 86400000);

  const d = String(targetDate.getDate()).padStart(2, '0');
  const m = targetDate.getMonth();
  const y = targetDate.getFullYear();
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const fullMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  return {
    dateSlash: `${d}/${String(m + 1).padStart(2, '0')}/${y}`,
    dateFormatted: `${d} ${shortMonths[m]} ${y}`,
    bulan: `${fullMonths[m]} ${y}`,
    dateIso: `${y}-${String(m + 1).padStart(2, '0')}-${d}`,
  };
}

/**
 * Smart Commercial Material Rounding with Unit-Price Reconciliation:
 * Mengubah banyaknya volume bahan menjadi bulat/wajar seperti pembelian riil di toko material
 * tanpa mengubah nominal total (jumlah Rp) sedikitpun agar 100% klop dengan RAB/Realisasi.
 */
/**
 * Smart Commercial Material Rounding & Aggregation:
 * 1. Mengubah banyaknya volume bahan menjadi bulat/wajar seperti pembelian riil di toko material (Zak, m³, btg, lbr, dll).
 * 2. Melakukan AGREGASI / PENGGABUNGAN barang sejenis dalam kwitansi yang sama, sehingga tidak ada barang yang muncul berulang kali dengan harga satuan berbeda.
 * 3. Menghitung harga satuan rata-rata tertimbang (harmonized price) secara presisi sehingga total nominal tetap 100% klop dengan RAB.
 */
/**
 * Universal Detector for Pure Direct Retail Materials:
 * Identifies if a line item is already a physical single commercial store material
 * (e.g. Semen, Pasir, Paku, Besi, Cat, Bata, Kayu, Keramik) or a composite scope/trade that
 * needs decomposition into physical store materials.
 */
export function isPureDirectMaterial(name: string): boolean {
  const n = (name || '').toLowerCase().trim();
  if (!n) return true;
  // If it starts with or contains job verbs or trade scopes, it's definitely NOT a pure single material:
  if (/pekerjaan|pasang|pemasangan|pengadaan|pembuatan|perbaikan|rehab|renovasi|bongkar|cor\b|pengecoran|plesteran|acian|urugan|uruk|galian|instalasi|pengecatan|pengukuran|bowplank|bouwplank|finishing|pembersihan|pondasi|aanstamping|tebal|\d+\s*cm|\d+\s*mm|bawah|campuran|manual/i.test(n)) {
    return false;
  }
  // Composite trades
  if (/rangka atap|penutup atap|struktur|kuda-kuda|kuda kuda|titik lampu|titik saklar|titik stop|sanitasi|saluran air/i.test(n)) {
    return false;
  }
  // Otherwise check if it matches standard physical single retail materials:
  return /semen|pasir|batu\b|split|kerikil|sirtu|bata\b|hebel|batako|besi\b|kawat|bendrat|paku\b|baut|sekrup|amplas|kertas gosok|lem\b|seal|sealant|lakban|thinner|tiner|cat\b|plamir|kuas|roll\b|hollow|gypsum|grc|kalsiboard|spandek|genteng|asbes|seng\b|nok\b|talang|reng\b|kanal\b|kabel|lampu|saklar|stop kontak|steker|fitting|pipa\b|kran\b|knee\b|socket|teflon|keramik|granit|ubin|grout|oker|engsel|grendel|kunci|handle|hak angin|kaca\b|papan\b|kaso\b|balok\b|triplek|plywood|multiplek|dolken|bambu/i.test(n);
}

export function normalizeMaterialItems<T extends { namaBarang: string; volume: number; satuan: string; hargaSatuan: number; jumlah: number }>(
  rawItems: T[]
): T[] {
  if (!rawItems || rawItems.length === 0) return [];

  // 0. Universal Auto-Decompose any composite / non-pure-material items into physical store materials
  const expandedItems: T[] = [];
  rawItems.forEach((item) => {
    const rawName = (item.namaBarang || '').trim();
    const rawJml = item.jumlah || 0;
    const isCompositeJob = !isPureDirectMaterial(rawName);

    if (isCompositeJob && rawJml >= 25000) {
      const decomposed = decomposeRealisticBahanAndUpah(rawName, rawJml, 0);
      if (decomposed.bahanItems.length > 0) {
        decomposed.bahanItems.forEach((bi) => {
          expandedItems.push({
            ...item,
            namaBarang: bi.namaBarang,
            volume: bi.volume,
            satuan: bi.satuan,
            hargaSatuan: bi.hargaSatuan,
            jumlah: bi.jumlah,
          } as T);
        });
        return;
      }
    }
    expandedItems.push(item);
  });

  // 1. Standarisasi nama dan konversi satuan komersial dasar
  const preProcessed = expandedItems.map((item) => {
    const rawVol = item.volume || 0;
    const rawJml = item.jumlah || 0;
    const rawSatuan = (item.satuan || '').toLowerCase().trim();
    const rawName = (item.namaBarang || '').trim();

    let convertedVol = rawVol;
    let convertedSatuan = item.satuan || 'unit';

    // Semen Kg -> Zak (1 Zak = 40 kg standar AHSP/SNI)
    if (/semen|pc\b|portland/i.test(rawName) && /kg|kilogram/i.test(rawSatuan)) {
      convertedVol = rawVol / 40;
      convertedSatuan = 'Zak';
    } else if (/pasir|batu|tanah|sirtu|agregat|kerikil/i.test(rawName) && /m3|m³|m2|m²/i.test(rawSatuan)) {
      convertedSatuan = /m3|m³/i.test(rawSatuan) ? 'm³' : 'm²';
    }

    return {
      ...item,
      namaBarang: rawName,
      volume: convertedVol,
      satuan: convertedSatuan,
      jumlah: rawJml,
    };
  });

  // 2. Kelompokkan barang sejenis (Grouping by normalized name and unit)
  const groupMap = new Map<string, { items: typeof preProcessed; namaBarang: string; satuan: string }>();

  preProcessed.forEach((item) => {
    const normName = item.namaBarang.toLowerCase().replace(/\s+/g, ' ').trim();
    const normSat = item.satuan.toLowerCase().replace(/\s+/g, ' ').trim();
    const key = `${normName}__${normSat}`;

    const existing = groupMap.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groupMap.set(key, {
        items: [item],
        namaBarang: item.namaBarang,
        satuan: item.satuan,
      });
    }
  });

  // 3. Gabungkan volume, nominal, dan hitung harga satuan seragam
  const result: T[] = [];

  groupMap.forEach((group) => {
    const totalRawVol = group.items.reduce((s, it) => s + it.volume, 0);
    const totalRawJml = group.items.reduce((s, it) => s + it.jumlah, 0);
    const sampleItem = group.items[0];
    const rawSatuan = (group.satuan || '').toLowerCase().trim();
    const rawName = group.namaBarang.toLowerCase();

    let realisticVolume: number;
    let realisticSatuan = group.satuan;

    // A. Semen (Zak)
    if (/semen|pc\b|portland/i.test(rawName) && /zak|sak/i.test(rawSatuan)) {
      realisticVolume = Math.max(1, Math.round(totalRawVol));
      realisticSatuan = 'Zak';
    }
    // B. Pasir, Batu, Tanah (m³)
    else if (/pasir|batu|tanah|sirtu|agregat|kerikil/i.test(rawName) && /m3|m³|m2|m²/i.test(rawSatuan)) {
      realisticVolume = Math.max(1, Math.round(totalRawVol));
      realisticSatuan = /m3|m³/i.test(rawSatuan) ? 'm³' : 'm²';
    }
    // C. Unit diskrit: lembar, batang, buah, dus, klg, set, roll, unit, rit, dll.
    else if (
      /lbr|lembar|btg|batang|zak|sak|buah|bh|dus|box|kotak|ktk|unit|set|roll|rol|klg|kaleng|pail|drum|rit/i.test(rawSatuan) ||
      /triplek|multiplex|papan|kaso|balok|besi|helm|rompi|sepatu|sarung tangan|p3k|rambu|tali/i.test(rawName)
    ) {
      if (totalRawVol <= 0.05) {
        realisticVolume = 1;
      } else if (totalRawVol < 1) {
        realisticVolume = 1;
        if (/m3|m³/.test(rawSatuan) && /kayu|balok|kaso|tiang/i.test(rawName)) {
          realisticSatuan = 'btg';
        }
      } else {
        realisticVolume = Math.max(1, Math.round(totalRawVol));
      }
    }
    // D. Berat / Volume (Kg, Liter)
    else if (/kg|liter|ltr/i.test(rawSatuan)) {
      if (totalRawVol < 0.5) {
        realisticVolume = 1;
        if (/cat/i.test(rawName)) realisticSatuan = 'klg';
        else if (/paku/i.test(rawName)) realisticSatuan = 'kg';
      } else {
        realisticVolume = Math.max(1, Math.round(totalRawVol));
      }
    }
    // E. Kubikasi / Meter persegi
    else if (/m3|m³|m2|m²|m\b/i.test(rawSatuan)) {
      realisticVolume = Math.max(1, Math.round(totalRawVol));
    }
    // F. Default fallback
    else {
      realisticVolume = totalRawVol < 1 ? 1 : Math.round(totalRawVol);
    }

    // Price Balancing: Reconcile hargaSatuan agar realisticVolume * hargaSatuan = totalRawJml
    const reconciledHargaSatuan = Math.max(1, Math.round((totalRawJml / realisticVolume) * 100) / 100);

    result.push({
      ...sampleItem,
      namaBarang: group.namaBarang,
      volume: realisticVolume,
      satuan: realisticSatuan,
      hargaSatuan: reconciledHargaSatuan,
      jumlah: totalRawJml, // TOTAL NOMINAL PERSIS SAMA DENGAN RAB!
    });
  });

  return result;
}

/**
 * Harmonizes Kwitansi Uraian:
 * Ensures the parentheses inside kw.uraian accurately reflect real physical store materials
 * without showing raw composite job sub-titles.
 */
export function getHarmonizedKwitansiUraian(kw: {
  tipe?: string;
  uraian: string;
  items?: Array<{ namaBarang: string; volume: number; satuan: string; hargaSatuan: number; jumlah: number }>;
}): string {
  if (!kw || !kw.uraian) return '';
  if (kw.tipe !== 'MATERIAL' || !kw.items || kw.items.length === 0) {
    return kw.uraian;
  }
  const displayItems = normalizeMaterialItems(kw.items);
  if (displayItems.length === 0) return kw.uraian;

  const topNames = displayItems.map((it) => it.namaBarang).slice(0, 3).join(', ');
  if (/\([^)]*\)/.test(kw.uraian)) {
    return kw.uraian.replace(/\([^)]*\)/, `(${topNames})`);
  }
  return kw.uraian;
}

export const DEFAULT_SMKK_ITEMS: Array<{
  namaBarang: string;
  volume: number;
  satuan: string;
  hargaSatuan: number;
  jumlah: number;
}> = [
  { namaBarang: 'Penerapan SMKK - Tali keselamatan', volume: 1, satuan: 'roll', hargaSatuan: 550206, jumlah: 550206 },
  { namaBarang: 'Penerapan SMKK - Peralatan P3K', volume: 1, satuan: 'set', hargaSatuan: 2500000, jumlah: 2500000 },
  { namaBarang: 'Penerapan SMKK - Rambu-Rambu dan Pengendalian Resiko K3', volume: 1, satuan: 'set', hargaSatuan: 912302, jumlah: 912302 },
  { namaBarang: 'Penerapan SMKK - Helm kepala', volume: 10, satuan: 'buah', hargaSatuan: 83431, jumlah: 834310 },
  { namaBarang: 'Penerapan SMKK - Rompi', volume: 10, satuan: 'buah', hargaSatuan: 88852, jumlah: 888520 },
  { namaBarang: 'Penerapan SMKK - Sepatu boot', volume: 10, satuan: 'buah', hargaSatuan: 134195, jumlah: 1341950 },
  { namaBarang: 'Penerapan SMKK - Sarung tangan', volume: 10, satuan: 'buah', hargaSatuan: 59763, jumlah: 597630 },
];

/**
 * Universal Auto-Healer for Kwitansi Items:
 * 1. Restores SMKK kwitansi with safety equipment items.
 * 2. Restores Konsultan Perencana, Pengawas, and Pengelola Administrasi LPJ with clean professional services/honorarium items instead of store materials.
 * 3. Normalizes composite materials for pure MATERIAL transactions.
 */
export function getAutoHealedKwitansiItems<
  T extends { namaBarang: string; volume: number; satuan: string; hargaSatuan: number; jumlah: number }
>(
  kw: {
    noBukti?: string;
    tipe?: string;
    uraian?: string;
    nominal?: number;
    penerimaPekerjaan?: string;
    penerimaNama?: string;
    items?: T[];
  } | null | undefined
): T[] {
  if (!kw) return [];

  const noBuktiStr = (kw.noBukti || '').toLowerCase();
  const uraianStr = (kw.uraian || '').toLowerCase();
  const perStr = (kw.penerimaPekerjaan || '').toLowerCase();
  const combined = `${noBuktiStr} ${uraianStr} ${perStr} ${(kw.penerimaNama || '').toLowerCase()}`;
  const nom = kw.nominal || 0;

  // 1. SMKK / K3
  const isSmkk =
    /smkk/i.test(noBuktiStr) ||
    /smkk|k3|keselamatan kerja|apd/i.test(uraianStr) ||
    kw.tipe === 'SMKK';

  if (isSmkk) {
    const isCorrupted =
      !kw.items ||
      kw.items.length === 0 ||
      kw.items.some((it) => /semen|pasir|split|kaso|batu|paku campuran/i.test(it.namaBarang));

    if (isCorrupted) {
      return DEFAULT_SMKK_ITEMS as unknown as T[];
    }
    return kw.items || [];
  }

  // 2. Konsultan Perencana Teknis
  const isPerencana =
    /kons-p/i.test(noBuktiStr) ||
    /perencana/i.test(uraianStr) ||
    /perencana/i.test(perStr) ||
    (kw.tipe === 'KONSULTAN' && /perencana/i.test(combined));

  if (isPerencana) {
    return [
      {
        namaBarang: 'Jasa Konsultansi Perencanaan Teknis & Penyusunan Dokumen RAB / Gambar Kerja',
        volume: 1,
        satuan: 'Ls',
        hargaSatuan: nom,
        jumlah: nom,
      },
    ] as unknown as T[];
  }

  // 3. Konsultan Pengawas Lapangan
  const isPengawas =
    /kons-w/i.test(noBuktiStr) ||
    /pengawas/i.test(uraianStr) ||
    /pengawas/i.test(perStr) ||
    (kw.tipe === 'KONSULTAN' && /pengawas/i.test(combined));

  if (isPengawas) {
    return [
      {
        namaBarang: 'Jasa Konsultansi Pengawasan Teknis Lapangan & Laporan Kemajuan Pekerjaan',
        volume: 1,
        satuan: 'Ls',
        hargaSatuan: nom,
        jumlah: nom,
      },
    ] as unknown as T[];
  }

  // 4. Biaya Pengelolaan Administrasi LPJ
  const isPengelolaAdm =
    /\badm\b/i.test(noBuktiStr) ||
    /pengelola.*(spj|administrasi|lpj)/i.test(uraianStr) ||
    /administrasi lpj/i.test(uraianStr) ||
    /administrasi/i.test(perStr) ||
    /pengelola spj/i.test(combined);

  if (isPengelolaAdm) {
    return [
      {
        namaBarang: 'Honorarium Biaya Pengelolaan Administrasi SPJ & Pelaporan Kegiatan',
        volume: 1,
        satuan: 'Keg',
        hargaSatuan: nom,
        jumlah: nom,
      },
    ] as unknown as T[];
  }

  // 5. Pure MATERIAL kwitansi
  if (kw.tipe === 'MATERIAL' && kw.items && kw.items.length > 0) {
    return normalizeMaterialItems(kw.items);
  }

  return kw.items || [];
}

/**
 * Harmonizes Kwitansi or SPB number by making sure the trailing year matches
 * either the school fiscal year (tahunAnggaran) or transaction date year.
 */
export function getHarmonizedKwitansiNoBukti(
  kw?: { noBukti?: string; tanggal?: string },
  targetYear?: string
): string {
  if (!kw?.noBukti) return '';
  let effYear = targetYear?.trim();
  if (!effYear && kw.tanggal) {
    const match = kw.tanggal.match(/\b(20\d\d|19\d\d)\b/);
    if (match) effYear = match[1];
  }
  if (!effYear) effYear = '2026';
  return kw.noBukti.replace(/\/(19\d\d|20\d\d)$/, `/${effYear}`);
}

/**
 * Removes duplicate kwitansi documents based on unique signature:
 * - noBukti + nominal
 * - noBukti + tanggal
 * - recipient/store + tanggal + nominal + tipe + mingguRef
 * Keeps the first occurrence and discards duplicate copies.
 */
export function deduplicateKwitansiList<
  K extends {
    id?: string;
    noBukti?: string;
    noSpb?: string;
    tanggal?: string;
    nominal?: number;
    tipe?: string;
    namaToko?: string;
    penerimaNama?: string;
    uraian?: string;
    mingguKeRef?: number;
    items?: any[];
  }
>(list: K[]): K[] {
  if (!Array.isArray(list)) return [];
  const seenKeys = new Set<string>();
  const seenNoBukti = new Set<string>();
  const seenUpahWeek = new Set<number>();
  const result: K[] = [];

  for (const item of list) {
    const normNoBukti = (item.noBukti || '').trim().toUpperCase();
    const normTanggal = (item.tanggal || '').trim();
    const normNominal = Math.round(item.nominal || 0);
    const normTipe = (item.tipe || '').trim().toUpperCase();
    const normStore = (item.namaToko || item.penerimaNama || '').trim().toLowerCase();
    const normUraian = (item.uraian || '').trim().toLowerCase();
    const normWeek = item.mingguKeRef || 0;

    let isDuplicate = false;

    // Signature 1: Exact No Bukti
    if (normNoBukti) {
      if (seenNoBukti.has(normNoBukti)) {
        isDuplicate = true;
      }
    }

    // Signature 2: Single Upah payment per week
    if (!isDuplicate && normTipe === 'UPAH' && normWeek > 0) {
      if (seenUpahWeek.has(normWeek)) {
        isDuplicate = true;
      }
    }

    // Signature 3: Duplicate Uraian + Nominal + Week
    const keyUraianNom = `UR:${normUraian}|NOM:${normNominal}|W:${normWeek}`;
    if (!isDuplicate && normNominal > 0 && seenKeys.has(keyUraianNom)) {
      isDuplicate = true;
    }

    // Signature 4: Duplicate Store + Date + Nominal
    const keyStoreDateNom = `STORE:${normStore}|TGL:${normTanggal}|NOM:${normNominal}`;
    if (!isDuplicate && normNominal > 0 && normStore && seenKeys.has(keyStoreDateNom)) {
      isDuplicate = true;
    }

    if (!isDuplicate) {
      if (normNoBukti) seenNoBukti.add(normNoBukti);
      if (normTipe === 'UPAH' && normWeek > 0) seenUpahWeek.add(normWeek);
      if (normNominal > 0) {
        seenKeys.add(keyUraianNom);
        if (normStore) seenKeys.add(keyStoreDateNom);
      }
      result.push(item);
    }
  }

  return result;
}

/**
 * Heals an entire list of Kwitansi documents, ensuring SMKK items are permanently restored,
 * trailing year matches active tahunAnggaran, and any duplicate documents are removed.
 */
export function healKwitansiList<
  K extends {
    id?: string;
    noBukti?: string;
    noSpb?: string;
    tipe?: string;
    uraian?: string;
    nominal?: number;
    tanggal?: string;
    namaToko?: string;
    penerimaNama?: string;
    mingguKeRef?: number;
    penerimaPekerjaan?: string;
    items?: any[];
  }
>(list: K[], targetYear?: string): K[] {
  if (!Array.isArray(list)) return [];
  const processed = list.map((kw) => {
    let updatedKw = { ...kw };

    let effYear = targetYear?.trim();
    if (!effYear && updatedKw.tanggal) {
      const match = updatedKw.tanggal.match(/\b(20\d\d|19\d\d)\b/);
      if (match) effYear = match[1];
    }
    if (!effYear) effYear = '2026';

    if (updatedKw.noBukti && /\/(19\d\d|20\d\d)$/.test(updatedKw.noBukti)) {
      updatedKw.noBukti = updatedKw.noBukti.replace(/\/(19\d\d|20\d\d)$/, `/${effYear}`);
    }

    if (updatedKw.noSpb && /\/(19\d\d|20\d\d)$/.test(updatedKw.noSpb)) {
      updatedKw.noSpb = updatedKw.noSpb.replace(/\/(19\d\d|20\d\d)$/, `/${effYear}`);
    }

    if (updatedKw.uraian && /Tahun\s+(19\d\d|20\d\d)/i.test(updatedKw.uraian)) {
      updatedKw.uraian = updatedKw.uraian.replace(/Tahun\s+(19\d\d|20\d\d)/gi, `Tahun ${effYear}`);
    }

    const isSmkk =
      /smkk/i.test(updatedKw.noBukti || '') ||
      /smkk|k3|keselamatan kerja|apd/i.test(updatedKw.uraian || '') ||
      updatedKw.tipe === 'SMKK';

    if (isSmkk) {
      const isCorrupted =
        !updatedKw.items ||
        updatedKw.items.length === 0 ||
        updatedKw.items.some((it) => /semen|pasir|split|kaso|batu|paku campuran/i.test(it.namaBarang));

      if (isCorrupted) {
        updatedKw = {
          ...updatedKw,
          items: DEFAULT_SMKK_ITEMS as any,
          penerimaPekerjaan: 'Penyedia APD & Keselamatan Kerja',
        };
      }
    }

    // Always heal items for consulting, management, and clean material
    updatedKw.items = getAutoHealedKwitansiItems(updatedKw) as any;

    return updatedKw;
  });

  return deduplicateKwitansiList(processed);
}

export interface DecomposedItem {
  namaBarang: string;
  volume: number;
  satuan: string;
  hargaSatuan: number;
  jumlah: number;
}

interface MaterialTemplate {
  nama: string;
  satuan: string;
  typicalPrice: number;
  weight: number;
}

/**
 * Intelligent Material Decomposition Engine:
 * Transforms job-level titles (especially for UPAH_BAHAN or items without direct AHSP)
 * into realistic, commercial store materials with exact nominal conservation.
 */
export function decomposeRealisticBahanAndUpah(
  uraian: string,
  bahanNominal: number,
  upahNominal: number
): {
  bahanItems: DecomposedItem[];
  upahComponents: DecomposedItem[];
} {
  const lower = uraian.toLowerCase();

  // A raw item is ONLY a direct single material if it has NO job scope, trade or spec words:
  const hasJobScope =
    /pekerjaan|pasang|pemasangan|pengadaan|pembuatan|perbaikan|rehab|renovasi|bongkar|urugan|uruk|galian|cor\b|pengecoran|plesteran|acian|instalasi|pengecatan|pengukuran|bowplank|bouwplank|rangka|penutup|pondasi|struktur|titik|bawah|tebal|\d+\s*cm|\d+\s*mm|campuran|manual/i.test(
      lower
    );

  const isDirectRawMaterial =
    !hasJobScope &&
    /semen|paku|pasir|cat|bata|genteng|spandek|pipa|kabel|keramik|hollow|gypsum|grc|besi|kayu|baut|engsel|kunci|saklar/i.test(lower);

  let materialTemplates: MaterialTemplate[] = [];
  let upahRoleTukang = 'Tukang Terampil Lapangan';
  let upahRolePekerja = 'Pekerja Konstruksi';

  if (isDirectRawMaterial) {
    const typicalP = /semen/i.test(lower) ? 68000 : /pasir/i.test(lower) ? 220000 : /cat/i.test(lower) ? 350000 : 50000;
    const vol = Math.max(1, Math.round((bahanNominal / typicalP) * 10) / 10);
    return {
      bahanItems: [
        {
          namaBarang: uraian,
          volume: vol,
          satuan: /semen/i.test(lower) ? 'Zak' : /pasir/i.test(lower) ? 'm³' : /cat/i.test(lower) ? 'Galon' : 'Unit',
          hargaSatuan: Math.round(bahanNominal / vol),
          jumlah: bahanNominal,
        },
      ],
      upahComponents:
        upahNominal > 0
          ? [
              {
                namaBarang: 'Tukang Terampil',
                volume: Math.max(1, Math.round((upahNominal * 0.6) / 135000)),
                satuan: 'OH',
                hargaSatuan: 135000,
                jumlah: Math.round(upahNominal * 0.6),
              },
              {
                namaBarang: 'Pekerja Lapangan',
                volume: Math.max(1, Math.round((upahNominal * 0.4) / 110000)),
                satuan: 'OH',
                hargaSatuan: 110000,
                jumlah: upahNominal - Math.round(upahNominal * 0.6),
              },
            ]
          : [],
    };
  }

  // 0. Urugan Pasir / Tanah / Timbunan / Sirtu
  if (/urugan|uruk|timbunan|sirtu/i.test(lower)) {
    if (/pasir/i.test(lower)) {
      materialTemplates = [
        { nama: 'Pasir Urug Pilihan / Timbunan Bersih', satuan: 'm³', typicalPrice: 175000, weight: 1.0 },
      ];
      upahRoleTukang = 'Pekerja Perata Pasir Urug';
      upahRolePekerja = 'Pekerja Langsir & Pemadatan';
    } else {
      materialTemplates = [
        { nama: 'Tanah Urug Sub-grade Pilihan', satuan: 'm³', typicalPrice: 135000, weight: 1.0 },
      ];
      upahRoleTukang = 'Pekerja Perata Tanah Urug';
      upahRolePekerja = 'Pekerja Langsir & Pemadatan';
    }
  }
  // 0B. Pondasi Batu Kali / Aanstamping / Batu Belah
  else if (/batu kali|pondasi batu|pasangan batu|aanstamping|batu kosong|batu belah/i.test(lower)) {
    if (/aanstamping|batu kosong/i.test(lower)) {
      materialTemplates = [
        { nama: 'Batu Kali Belah 15/20 cm', satuan: 'm³', typicalPrice: 280000, weight: 0.75 },
        { nama: 'Pasir Urug Alas Aanstamping', satuan: 'm³', typicalPrice: 175000, weight: 0.25 },
      ];
    } else {
      materialTemplates = [
        { nama: 'Batu Kali Belah 15/20 cm', satuan: 'm³', typicalPrice: 280000, weight: 0.50 },
        { nama: 'Semen Portland (PC) 50 Kg', satuan: 'Zak', typicalPrice: 68000, weight: 0.32 },
        { nama: 'Pasir Pasang Ayak Bersih', satuan: 'm³', typicalPrice: 220000, weight: 0.18 },
      ];
    }
    upahRoleTukang = 'Tukang Batu Pondasi';
    upahRolePekerja = 'Pekerja Adukan & Langsir';
  }
  // 1. Pengecatan
  else if (/cat|pengecatan|plamir|melamik|politur/i.test(lower)) {
    materialTemplates = [
      { nama: 'Cat Tembok Eksterior/Interior Weatherproof', satuan: 'Pail', typicalPrice: 380000, weight: 0.55 },
      { nama: 'Plamir Tembok / Wall Putty Instan', satuan: 'Zak', typicalPrice: 135000, weight: 0.20 },
      { nama: 'Kuas Roll Cat, Kuas Bulu 3" & Baki Cat', satuan: 'Set', typicalPrice: 85000, weight: 0.10 },
      { nama: 'Kertas Gosok / Amplas No. 120 & 180', satuan: 'Lembar', typicalPrice: 12000, weight: 0.08 },
      { nama: 'Lakban Kertas / Masking Tape Pelindung', satuan: 'Roll', typicalPrice: 18000, weight: 0.07 },
    ];
    upahRoleTukang = 'Tukang Cat & Finishing';
    upahRolePekerja = 'Pekerja Pengecatan';
  }
  // 2. Atap / Seng / Baja Ringan
  else if (/atap|seng|genteng|baja ringan|kuda|jurai|nok|bubungan|talang/i.test(lower)) {
    materialTemplates = [
      { nama: 'Rangka Baja Ringan Canal C75 Standar SNI', satuan: 'Batang', typicalPrice: 115000, weight: 0.40 },
      { nama: 'Atap Spandek Gelombang 0.30mm SNI', satuan: 'Lembar', typicalPrice: 165000, weight: 0.30 },
      { nama: 'Reng Baja Ringan Asimetris U-30', satuan: 'Batang', typicalPrice: 55000, weight: 0.15 },
      { nama: 'Baut Roofing / SDS Fastener Hex Head', satuan: 'Kotak', typicalPrice: 95000, weight: 0.08 },
      { nama: 'Seng Plat Talang / Nok Bubungan 0.3mm', satuan: 'Lembar', typicalPrice: 80000, weight: 0.07 },
    ];
    upahRoleTukang = 'Tukang Pasang Rangka Atap';
    upahRolePekerja = 'Pekerja Lapangan';
  }
  // 3. Plafon / Gypsum / GRC
  else if (/plafon|langit|gypsum|grc|akustik|triplek|list plafon/i.test(lower)) {
    materialTemplates = [
      { nama: 'Papan Gypsum / GRC Tebal 9 mm Standar SNI', satuan: 'Lembar', typicalPrice: 85000, weight: 0.45 },
      { nama: 'Rangka Besi Hollow Galvanis 4x4 & 2x4', satuan: 'Batang', typicalPrice: 38000, weight: 0.30 },
      { nama: 'Compound Tepung Gypsum & Kasa Textile Tape', satuan: 'Zak', typicalPrice: 65000, weight: 0.10 },
      { nama: 'List Profil Plafon / Cornice Gypsum', satuan: 'Batang', typicalPrice: 28000, weight: 0.08 },
      { nama: 'Sekrup Fastener Gypsum Hitam 1"', satuan: 'Kotak', typicalPrice: 45000, weight: 0.07 },
    ];
    upahRoleTukang = 'Tukang Plafon Gypsum';
    upahRolePekerja = 'Pekerja Pasang Plafon';
  }
  // 4. Keramik / Lantai
  else if (/keramik|lantai|ubin|granit|homogeneous|tegel|plint/i.test(lower)) {
    materialTemplates = [
      { nama: 'Ubin Keramik Lantai 40x40 / 50x50 SNI', satuan: 'Dus', typicalPrice: 95000, weight: 0.52 },
      { nama: 'Semen Portland (PC) 50 Kg', satuan: 'Zak', typicalPrice: 68000, weight: 0.26 },
      { nama: 'Pasir Pasang Ayak Halus', satuan: 'm³', typicalPrice: 220000, weight: 0.15 },
      { nama: 'Semen Warna Pengisi Nat Keramik (Grouting)', satuan: 'Kg', typicalPrice: 18000, weight: 0.07 },
    ];
    upahRoleTukang = 'Tukang Pasang Keramik';
    upahRolePekerja = 'Pekerja Adukan & Langsir';
  }
  // 5. Pintu / Jendela / Kusen / Kaca
  else if (/pintu|jendela|kusen|kaca|ventilasi|boven|jalusi/i.test(lower)) {
    materialTemplates = [
      { nama: 'Kusen & Daun Pintu/Jendela Kayu/Alumunium', satuan: 'Unit', typicalPrice: 850000, weight: 0.65 },
      { nama: 'Kunci Tanam / Handle Silinder Stainless', satuan: 'Set', typicalPrice: 165000, weight: 0.13 },
      { nama: 'Kaca Polos Bening Tebal 5 mm', satuan: 'm²', typicalPrice: 140000, weight: 0.12 },
      { nama: 'Engsel Pintu/Jendela Stainless Steel 4"', satuan: 'Set', typicalPrice: 45000, weight: 0.10 },
    ];
    upahRoleTukang = 'Tukang Kayu / Kusen';
    upahRolePekerja = 'Pekerja Pembantu Tukang';
  }
  // 6. Listrik / Lampu
  else if (/listrik|lampu|stop kontak|saklar|kabel|penerangan|titik/i.test(lower)) {
    materialTemplates = [
      { nama: 'Kabel Listrik NYM 2x1.5 mm / 2x2.5 mm Standar SNI', satuan: 'Roll', typicalPrice: 450000, weight: 0.40 },
      { nama: 'Lampu LED Hemat Energi 18W / 24W SNI', satuan: 'Buah', typicalPrice: 65000, weight: 0.28 },
      { nama: 'Saklar Ganda & Tunggal Inbow Standar Broco', satuan: 'Buah', typicalPrice: 28000, weight: 0.12 },
      { nama: 'Stop Kontak Dinding & Box Inbow', satuan: 'Buah', typicalPrice: 28000, weight: 0.12 },
      { nama: 'Pipa Konduit Pelindung Kabel & Klem', satuan: 'Batang', typicalPrice: 15000, weight: 0.08 },
    ];
    upahRoleTukang = 'Tukang Instalasi Listrik';
    upahRolePekerja = 'Pekerja Pembantu Listrik';
  }
  // 7. Sanitasi / Kloset / Pipa / Toilet / Saluran
  else if (/sanitasi|toilet|kloset|wc|pipa|saluran|air bersih|drainase|kran|wastafel|septictank|floor drain/i.test(lower)) {
    materialTemplates = [
      { nama: 'Kloset Jongkok Porselen Putih Standar SNI', satuan: 'Unit', typicalPrice: 280000, weight: 0.38 },
      { nama: 'Pipa PVC AW 3" & 1/2" Air Bersih/Kotor', satuan: 'Batang', typicalPrice: 95000, weight: 0.32 },
      { nama: 'Kran Air Stainless Steel & Sambungan Knee/Socket', satuan: 'Buah', typicalPrice: 45000, weight: 0.16 },
      { nama: 'Lem Pipa PVC, Seal Tape & Floor Drain Stainless', satuan: 'Set', typicalPrice: 35000, weight: 0.14 },
    ];
    upahRoleTukang = 'Tukang Pipa & Sanitasi';
    upahRolePekerja = 'Pekerja Galian & Saluran';
  }
  // 8. Cor Beton / Pondasi / Kolom / Balok / Sloof / Ringbalk
  else if (/beton|cor|pondasi|kolom|balok|sloof|ringbalk|pembesian|begisting|plat/i.test(lower)) {
    materialTemplates = [
      { nama: 'Besi Beton Ulir / Polos Standar SNI', satuan: 'Batang', typicalPrice: 95000, weight: 0.42 },
      { nama: 'Semen Portland (PC) 50 Kg', satuan: 'Zak', typicalPrice: 68000, weight: 0.28 },
      { nama: 'Pasir Beton Ayak Bersih', satuan: 'm³', typicalPrice: 240000, weight: 0.14 },
      { nama: 'Batu Split / Kerikil Beton 2/3', satuan: 'm³', typicalPrice: 260000, weight: 0.10 },
      { nama: 'Kawat Ikat Beton / Bendrat & Paku', satuan: 'Kg', typicalPrice: 28000, weight: 0.06 },
    ];
    upahRoleTukang = 'Tukang Besi & Cor Beton';
    upahRolePekerja = 'Pekerja Adukan & Cor';
  }
  // 9. Dinding / Bata / Plesteran / Acian
  else if (/dinding|bata|batako|hebel|plesteran|acian/i.test(lower)) {
    const isOnlyPlester = /plesteran|acian/i.test(lower) && !/bata|batako|hebel/i.test(lower);
    if (isOnlyPlester) {
      materialTemplates = [
        { nama: 'Semen Portland (PC) 50 Kg', satuan: 'Zak', typicalPrice: 68000, weight: 0.65 },
        { nama: 'Pasir Pasang Ayak Halus', satuan: 'm³', typicalPrice: 220000, weight: 0.35 },
      ];
    } else {
      materialTemplates = [
        { nama: 'Bata Merah Bakar Standar Konstruksi', satuan: 'Buah', typicalPrice: 900, weight: 0.45 },
        { nama: 'Semen Portland (PC) 50 Kg', satuan: 'Zak', typicalPrice: 68000, weight: 0.32 },
        { nama: 'Pasir Pasang Ayak Bersih', satuan: 'm³', typicalPrice: 220000, weight: 0.23 },
      ];
    }
    upahRoleTukang = 'Tukang Batu & Plester';
    upahRolePekerja = 'Pekerja Adukan Semen';
  }
  // 10. Persiapan / Bouwplank / Pengukuran / Pagar
  else if (/persiapan|bouwplank|bowplank|pengukuran|pembersihan|pagar/i.test(lower)) {
    materialTemplates = [
      { nama: 'Kayu Kaso 5/7 cm Meranti / Sengon', satuan: 'Batang', typicalPrice: 35000, weight: 0.50 },
      { nama: 'Kayu Papan 3/20 cm Standar Bekisting', satuan: 'Lembar', typicalPrice: 45000, weight: 0.30 },
      { nama: 'Paku Campuran 5 cm - 10 cm', satuan: 'Kg', typicalPrice: 25000, weight: 0.20 },
    ];
    upahRoleTukang = 'Tukang Kayu Persiapan';
    upahRolePekerja = 'Pekerja Pembersihan Lapangan';
  }
  // 11. Perabot / Meja / Kursi / Whiteboard / Mebeler
  else if (/meja|kursi|lemari|whiteboard|perabot|mebeler/i.test(lower)) {
    materialTemplates = [
      { nama: 'Meja Siswa / Guru Rangka Besi & Kayu Solid', satuan: 'Unit', typicalPrice: 450000, weight: 0.50 },
      { nama: 'Kursi Siswa / Guru Rangka Besi Dudukan Kayu', satuan: 'Unit', typicalPrice: 280000, weight: 0.40 },
      { nama: 'Papan Tulis Whiteboard Magnetik & Aksesoris', satuan: 'Set', typicalPrice: 350000, weight: 0.10 },
    ];
    upahRoleTukang = 'Tukang Perakitan Mebeler';
    upahRolePekerja = 'Pekerja Langsir Perabot';
  }
  // 12. Fallback Umum
  else {
    materialTemplates = [
      { nama: 'Semen Portland (PC) 50 Kg', satuan: 'Zak', typicalPrice: 68000, weight: 0.45 },
      { nama: 'Pasir Pasang Pilihan', satuan: 'm³', typicalPrice: 220000, weight: 0.25 },
      { nama: 'Kayu Kaso 5/7 cm', satuan: 'Batang', typicalPrice: 35000, weight: 0.20 },
      { nama: 'Paku Campuran 5 cm - 10 cm', satuan: 'Kg', typicalPrice: 25000, weight: 0.10 },
    ];
    upahRoleTukang = 'Tukang Terampil';
    upahRolePekerja = 'Pekerja Lapangan';
  }

  // Decompose Bahan
  const bahanItems: DecomposedItem[] = [];
  let allocatedBahanNominal = 0;

  materialTemplates.forEach((tpl, idx) => {
    const isLast = idx === materialTemplates.length - 1;
    const subJml = isLast ? bahanNominal - allocatedBahanNominal : Math.round(bahanNominal * tpl.weight);
    allocatedBahanNominal += subJml;

    if (subJml <= 0) return;

    let subVol = Math.max(1, Math.round((subJml / tpl.typicalPrice) * 10) / 10);
    if (/zak|buah|dus|set|batang|lembar|pail|unit|roll|kotak/i.test(tpl.satuan)) {
      subVol = Math.max(1, Math.round(subVol));
    }
    const hargaSatuan = Math.round(subJml / subVol);

    bahanItems.push({
      namaBarang: tpl.nama,
      volume: subVol,
      satuan: tpl.satuan,
      hargaSatuan: hargaSatuan,
      jumlah: subJml,
    });
  });

  // Decompose Upah
  const upahComponents: DecomposedItem[] = [];
  if (upahNominal > 0) {
    const tukangNominal = Math.round(upahNominal * 0.62);
    const pekerjaNominal = upahNominal - tukangNominal;

    const rateTukang = 135000;
    const ratePekerja = 110000;

    const volTukang = Math.max(0.5, Math.round((tukangNominal / rateTukang) * 10) / 10);
    const volPekerja = Math.max(0.5, Math.round((pekerjaNominal / ratePekerja) * 10) / 10);

    upahComponents.push({
      namaBarang: upahRoleTukang,
      volume: volTukang,
      satuan: 'OH',
      hargaSatuan: Math.round(tukangNominal / volTukang),
      jumlah: tukangNominal,
    });

    if (pekerjaNominal > 0) {
      upahComponents.push({
        namaBarang: upahRolePekerja,
        volume: volPekerja,
        satuan: 'OH',
        hargaSatuan: Math.round(pekerjaNominal / volPekerja),
        jumlah: pekerjaNominal,
      });
    }
  }

  return { bahanItems, upahComponents };
}


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
    // 1. Pembayaran upah tukang & konsultan dibayarkan pada tanggal akhir minggu (Sabtu / endDate)
    // 2. Transaksi belanja material, persiapan, SMKK, alat, dan administrasi disebar proporsional dan tidak menumpuk
    // 3. Seluruh tanggal transaksi dijaga agar selalu berada di dalam rentang minggu (startDate s.d endDate)
    if (kw.mingguKeRef && progressWeeks && progressWeeks.length > 0) {
      const matchW = progressWeeks.find((w) => w.mingguKe === kw.mingguKeRef);
      if (matchW) {
        const resolvedW = resolveWeekDates(matchW, yearStr);
        const isStrictAkhirMingguPayment =
          kw.tipe === 'UPAH' ||
          /uk\//i.test(kw.noBukti || '') ||
          /upah tukang|upah pekerja|daftar hadir/i.test(kw.uraian);

        if (isStrictAkhirMingguPayment) {
          sortDate = resolvedW.endDate;
          displayTanggal = resolvedW.endDateSlash;
        } else {
          // If transaction has its own designated date within the week range, preserve it!
          if (sortDate < resolvedW.startDate) {
            sortDate = resolvedW.startDate;
            displayTanggal = resolvedW.startDateSlash;
          } else if (sortDate > resolvedW.endDate) {
            sortDate = resolvedW.endDate;
            displayTanggal = resolvedW.endDateSlash;
          }
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
    } else if (
      termin2Amount > 0 &&
      (kwitansiList.some((k) => (k.mingguKeRef || 0) >= 6) ||
        result.reduce((s, r) => s + r.pengeluaran, 0) >= termin1Amount * 0.9)
    ) {
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

export function generateTaxesFromKwitansi(
  kwitansiList: KwitansiDocument[],
  manualTaxRecords: TaxRecord[] = [],
  deletedTaxIds: string[] = []
): TaxRecord[] {
  const result: TaxRecord[] = [];
  const deletedSet = new Set(deletedTaxIds || []);
  const manualMap = new Map((manualTaxRecords || []).map((m) => [m.id, m]));

  // 1. Process from kwitansi
  kwitansiList.forEach((kw) => {
    const taxId = `tax-${kw.id}`;
    if (deletedSet.has(taxId) || deletedSet.has(kw.id)) {
      return;
    }

    // Check if user manually edited/overrode this tax record
    if (manualMap.has(taxId)) {
      result.push(manualMap.get(taxId)!);
      return;
    }

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
      ppn = kw.ppnAmount || Math.round((kw.nominal / 1.11) * 0.11);
    }
    if (kw.isPph22) {
      pph22 = kw.pph22Amount || Math.round((kw.nominal / 1.11) * 0.015);
    }
    if (kw.isPph23) {
      pph23 = kw.pph23Amount || Math.round(kw.nominal * 0.02);
    }

    result.push({
      id: taxId,
      noUrut: 0,
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
      kwitansiIdRef: kw.id,
      namaToko: kw.namaToko || kw.penerimaNama,
      penerimaNama: kw.penerimaNama,
      statusSetor: ppn + pph22 + pph23 > 0 ? 'LUNAS' : undefined,
    });
  });

  // 2. Add manual standalone tax records (not tied to kwitansi)
  manualTaxRecords.forEach((m) => {
    if (!deletedSet.has(m.id) && !result.some((r) => r.id === m.id)) {
      result.push(m);
    }
  });

  // 3. Sort chronologically by date
  result.sort((a, b) => {
    const isoA = parseTxDateToIso(a.tanggal) || a.tanggal || '';
    const isoB = parseTxDateToIso(b.tanggal) || b.tanggal || '';
    return isoA.localeCompare(isoB);
  });

  // 4. Assign clean sequential noUrut (1, 2, 3...)
  return result.map((t, idx) => ({
    ...t,
    noUrut: idx + 1,
  }));
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

  // 1. Clean previous auto-generated kwitansi for this targetWeek to prevent duplication
  const cleanExistingKwitansi = existingKwitansi.filter(
    (k) => k.mingguKeRef !== targetWeek
  );
  const newKwitansiList: KwitansiDocument[] = [...cleanExistingKwitansi];
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
  const weeklyAhspUpahComponents: { namaBarang: string; volume: number; satuan: string; hargaSatuan: number; jumlah: number }[] = [];

  // PRIORITY RULE FOR WEEK 1:
  // "ketika laporan mingguan & bobot di input di minggu pertama bagian persiapan itu akan memprioritaskan AHSP Pasang papan nama proyek dan pembelian SMKK karna itu harus terlebih dahulu dilaksanakan sebelum kegiatan lain."
  let week1PapanNamaGenerated = false;
  let week1SmkkGenerated = false;

  const isWeek1OrHasPersiapan = targetWeek === 1 && (
    activeDivisions.some((d) => d.kode.toUpperCase() === 'I' || /persiapan/i.test(d.uraian)) ||
    activeDivisions.length > 0
  );

  if (isWeek1OrHasPersiapan) {
    // 1. Prioritize AHSP Pasang Papan Nama Proyek
    const ahspPapan = (realSchoolData?.ahspList || []).find((ah) =>
      /papan nama/i.test(ah.namaPekerjaan || '') || ah.kodePekerjaan === 'I.1'
    );

    if (ahspPapan && ahspPapan.komponen && ahspPapan.komponen.length > 0) {
      const papanBahanComps = ahspPapan.komponen.filter(
        (c) => c.kategori === 'BAHAN' || (!/tukang|pekerja|mandor/i.test(c.uraian) && !/alat|sewa/i.test(c.uraian))
      );
      const papanUpahComps = ahspPapan.komponen.filter(
        (c) => c.kategori === 'UPAH' || /tukang|pekerja|mandor/i.test(c.uraian)
      );

      // Record upah components for papan nama
      papanUpahComps.forEach((c) => {
        const uJml = Math.round(c.koefisien * c.hargaSatuan);
        totalWageAmountForWeek += uJml;
        weeklyAhspUpahComponents.push({
          namaBarang: c.uraian,
          volume: c.koefisien,
          satuan: c.satuan || 'Hr',
          hargaSatuan: c.hargaSatuan,
          jumlah: uJml,
        });
      });

      if (papanBahanComps.length > 0) {
        const rawPapanItems = papanBahanComps.map((c) => ({
          namaBarang: c.uraian,
          volume: c.koefisien,
          satuan: c.satuan || 'unit',
          hargaSatuan: c.hargaSatuan,
          jumlah: Math.round(c.koefisien * c.hargaSatuan),
        }));
        const papanItems = normalizeMaterialItems(rawPapanItems);
        const papanNominal = papanItems.reduce((s, it) => s + it.jumlah, 0);

        const kwPapanBukti = `01/KW-MAT/${yearStr}`;
        const spbPapanBukti = `SPB-01/MAT/${yearStr}`;
        const isTaxablePapan = papanNominal >= 2000000;

        const kwPapanDoc: KwitansiDocument = {
          id: `kw-mat-m1-papan-${Date.now()}`,
          noBukti: kwPapanBukti,
          noSpb: spbPapanBukti,
          tipe: 'MATERIAL',
          tanggal: weekDates.startDateSlash, // Senin / Hari pertama minggu ke-1
          tanggalFormatted: weekDates.startDateFormatted,
          bulan: weekDates.bulan,
          uraian: `Pembayaran Lunas Biaya Pembelian Bahan Pasang Papan Nama Proyek Revitalisasi ${school.namaSekolah}, Tahun ${yearStr}, Rincian Terlampir.`,
          penerimaNama: defaultMaterialStore.pemilikNama || 'Pemilik Toko Rekanan',
          penerimaPekerjaan: `Pemilik ${defaultMaterialStore.namaToko}`,
          penerimaAlamat: defaultMaterialStore.alamat || school.kabKota,
          namaToko: defaultMaterialStore.namaToko,
          items: papanItems,
          nominal: papanNominal,
          isPpn: isTaxablePapan,
          isPph22: isTaxablePapan,
          isPph23: false,
          ppnAmount: isTaxablePapan ? Math.round((papanNominal / 1.11) * 0.11) : 0,
          pph22Amount: isTaxablePapan ? Math.round((papanNominal / 1.11) * 0.015) : 0,
          pph23Amount: 0,
          kategoriBiayaPajak: 'Konstruksi',
          keteranganSpb: `Surat Perintah Bayar Pembelian Bahan Papan Nama Proyek (${weekDates.startDateFormatted})`,
          mingguKeRef: 1,
        };

        const existIdx = newKwitansiList.findIndex((k) => k.noBukti === kwPapanBukti);
        if (existIdx >= 0) {
          newKwitansiList[existIdx] = kwPapanDoc;
        } else {
          newKwitansiList.push(kwPapanDoc);
        }
        generatedCount.bahan++;
        week1PapanNamaGenerated = true;
      }
    }

    // 2. Prioritize Pengadaan Perlengkapan SMKK & K3 Lapangan (Dibuatkan di Hari ke-1 Proyek)
    const realDivI = realSchoolData?.divisions?.find((d) => d.kode.toUpperCase() === 'I' || /persiapan/i.test(d.uraian));
    const smkkRabs = (realDivI?.items || []).filter(
      (it) => it.kategoriBiaya === 'SMKK' || /smkk|k3|helm|rompi|sepatu|p3k|rambu/i.test(it.uraian)
    );

    const smkkRawItems = smkkRabs.length > 0 ? smkkRabs.map((it) => ({
      namaBarang: it.uraian,
      volume: it.volume,
      satuan: it.satuan,
      hargaSatuan: it.hargaSatuan,
      jumlah: Math.round(it.volume * it.hargaSatuan),
    })) : [
      { namaBarang: 'Penerapan SMKK - Helm kepala', volume: 10, satuan: 'buah', hargaSatuan: 83431, jumlah: 834310 },
      { namaBarang: 'Penerapan SMKK - Rompi', volume: 10, satuan: 'buah', hargaSatuan: 88852, jumlah: 888520 },
      { namaBarang: 'Penerapan SMKK - Sepatu boot', volume: 10, satuan: 'buah', hargaSatuan: 134195, jumlah: 1341950 },
      { namaBarang: 'Penerapan SMKK - Sarung tangan', volume: 10, satuan: 'buah', hargaSatuan: 59763, jumlah: 597630 },
      { namaBarang: 'Penerapan SMKK - Peralatan P3K', volume: 1, satuan: 'set', hargaSatuan: 2500000, jumlah: 2500000 },
      { namaBarang: 'Penerapan SMKK - Rambu-Rambu dan Pengendalian Resiko K3', volume: 1, satuan: 'set', hargaSatuan: 912302, jumlah: 912302 },
      { namaBarang: 'Penerapan SMKK - Tali keselamatan', volume: 1, satuan: 'roll', hargaSatuan: 550206, jumlah: 550206 },
    ];

    const smkkNominal = smkkRawItems.reduce((s, it) => s + it.jumlah, 0);
    const kwSmkkBukti = `01/KW-SMKK/${yearStr}`;
    const spbSmkkBukti = `SPB-01/SMKK/${yearStr}`;
    const isTaxableSmkk = smkkNominal >= 2000000;

    const kwSmkkDoc: KwitansiDocument = {
      id: `kw-smkk-m1-${Date.now()}`,
      noBukti: kwSmkkBukti,
      noSpb: spbSmkkBukti,
      tipe: 'OPERASIONAL',
      tanggal: weekDates.startDateSlash, // Senin / Hari pertama minggu ke-1
      tanggalFormatted: weekDates.startDateFormatted,
      bulan: weekDates.bulan,
      uraian: `Pembayaran Lunas Pengadaan Perlengkapan SMKK & K3 Lapangan (${smkkRawItems.map((i) => i.namaBarang.replace('Penerapan SMKK - ', '')).slice(0, 4).join(', ')}), Revitalisasi ${school.namaSekolah}, Tahun ${yearStr}, Rincian Terlampir.`,
      penerimaNama: defaultMaterialStore.pemilikNama || 'Penyedia SMKK',
      penerimaPekerjaan: `Penyedia APD & Keselamatan Kerja`,
      penerimaAlamat: defaultMaterialStore.alamat || school.kabKota,
      namaToko: defaultMaterialStore.namaToko,
      items: smkkRawItems,
      nominal: smkkNominal,
      isPpn: isTaxableSmkk,
      isPph22: isTaxableSmkk,
      isPph23: false,
      ppnAmount: isTaxableSmkk ? Math.round((smkkNominal / 1.11) * 0.11) : 0,
      pph22Amount: isTaxableSmkk ? Math.round((smkkNominal / 1.11) * 0.015) : 0,
      pph23Amount: 0,
      kategoriBiayaPajak: 'Peralatan',
      keteranganSpb: `Surat Perintah Bayar Pengadaan SMKK & K3 Minggu Ke-1 (${weekDates.startDateFormatted})`,
      mingguKeRef: 1,
    };

    const existSmkkIdx = newKwitansiList.findIndex((k) => k.noBukti === kwSmkkBukti);
    if (existSmkkIdx >= 0) {
      newKwitansiList[existSmkkIdx] = kwSmkkDoc;
    } else {
      newKwitansiList.push(kwSmkkDoc);
    }
    generatedCount.smkk++;
    week1SmkkGenerated = true;
  }

  // Filter out any stale/non-RAB kwitansi (e.g. legacy kwitansi with Pompa Jet, Genset, or unexecuted Air Kerja/Listrik in early weeks)
  for (let i = newKwitansiList.length - 1; i >= 0; i--) {
    const kw = newKwitansiList[i];
    const hasExtraneousItems = (kw.items || []).some(
      (it) => /pompa jet|generator genset|stop kontak|tukang listrik|tukang pipa/i.test(it.namaBarang || '')
    ) || /pompa jet|generator genset/i.test(kw.uraian || '');
    if (hasExtraneousItems) {
      newKwitansiList.splice(i, 1);
    }
  }

  // Iterate each active division
  activeDivisions.forEach((div, dIdx) => {
    activeDivisionDescriptions.push(div.uraian);
    const progressRatio = div.bobotTotal > 0 ? div.prestasiMingguIni / div.bobotTotal : 0.1;
    const divCode = div.kode.toUpperCase();

    // Find real division in RealSchoolData or AHSP list
    const realDiv = realSchoolData?.divisions?.find(
      (rd: RabDivision) =>
        rd.kode.toUpperCase() === divCode ||
        rd.uraian.toLowerCase().includes(div.uraian.toLowerCase()) ||
        div.uraian.toLowerCase().includes(rd.uraian.toLowerCase())
    );

    // Group items strictly derived from RAB & validated AHSP breakdowns
    const bahanItems: { namaBarang: string; volume: number; satuan: string; hargaSatuan: number; jumlah: number }[] = [];
    const alatItems: { namaBarang: string; volume: number; satuan: string; hargaSatuan: number; jumlah: number }[] = [];
    const smkkItems: { namaBarang: string; volume: number; satuan: string; hargaSatuan: number; jumlah: number }[] = [];
    let divUpahTotal = 0;

    if (realDiv && realDiv.items && realDiv.items.length > 0) {
      realDiv.items.forEach((it: RabSubItem) => {
        // If SMKK or Papan Nama was generated in Week 1, skip repeating
        if (week1SmkkGenerated && (/smkk/i.test(it.kategoriBiaya || '') || /smkk|k3|helm|rompi/i.test(it.uraian))) {
          return;
        }
        if (week1PapanNamaGenerated && /papan nama/i.test(it.uraian)) {
          return;
        }

        // Check if this sub-item is Air Kerja / Listrik / Pipa and ensure it's actually executed in active keywords
        const subUraianLower = it.uraian.toLowerCase();
        const matRefs = (div.materialRef || []).map((r) => r.toLowerCase());
        const weekItems = (weekObj.itemPekerjaan || []).map((r) => r.toLowerCase());
        const allActiveKeywords = [...matRefs, ...weekItems];

        const isAirKerjaOrListrik = /air kerja|instalasi listrik|stop kontak|tukang listrik|tukang pipa/i.test(subUraianLower);
        const mentionsAirKerjaOrListrik = allActiveKeywords.some((kw) => /air kerja|listrik|pipa|stop kontak/i.test(kw));

        if (isAirKerjaOrListrik && !mentionsAirKerjaOrListrik && allActiveKeywords.length > 0) {
          return; // Skip Air Kerja / Listrik sub-item if not executed in this week's progress!
        }

        const execRabVol = Math.max(0.01, Math.round(it.volume * progressRatio * 100) / 100);
        const execRabJml = Math.round(execRabVol * it.hargaSatuan);
        if (execRabJml <= 0 && execRabVol <= 0) return;

        // Search for matching AHSP breakdown for this RAB item (Prioritize explicit ahspIdRef)
        const ahspMatch = (realSchoolData?.ahspList || []).find((ah) => {
          if (it.ahspIdRef && ah.id === it.ahspIdRef) return true;
          const lowerAh = (ah.namaPekerjaan || '').toLowerCase().trim();
          const lowerRab = it.uraian.toLowerCase().trim();
          if (lowerAh === lowerRab || lowerAh.includes(lowerRab) || lowerRab.includes(lowerAh)) return true;

          // Special smart alias mappings for standard construction trades:
          if (/bowplank|bouwplank|pengukuran|utzet/i.test(lowerRab) && /bowplank|bouwplank|pengukuran|utzet/i.test(lowerAh)) return true;
          if (/papan nama/i.test(lowerRab) && /papan nama/i.test(lowerAh)) return true;
          if (/galian/i.test(lowerRab) && /galian/i.test(lowerAh)) return true;
          if (/urugan pasir/i.test(lowerRab) && /urugan pasir/i.test(lowerAh)) return true;
          if (/pondasi|batu kali/i.test(lowerRab) && /pondasi|batu kali/i.test(lowerAh)) return true;
          if (/beton/i.test(lowerRab) && /beton/i.test(lowerAh)) return true;
          if (/bata/i.test(lowerRab) && /bata/i.test(lowerAh)) return true;
          if (/plesteran/i.test(lowerRab) && /plesteran/i.test(lowerAh)) return true;
          if (/keramik/i.test(lowerRab) && /keramik/i.test(lowerAh)) return true;
          if (/plafon|gypsum/i.test(lowerRab) && /plafon|gypsum|langit/i.test(lowerAh)) return true;
          if (/atap|spandek|baja ringan/i.test(lowerRab) && /atap|spandek|baja ringan/i.test(lowerAh)) return true;
          if (/cat|pengecatan/i.test(lowerRab) && /cat|pengecatan/i.test(lowerAh)) return true;
          if (/pintu|jendela|kusen/i.test(lowerRab) && /pintu|jendela|kusen/i.test(lowerAh)) return true;
          if (/listrik|lampu/i.test(lowerRab) && /listrik|lampu/i.test(lowerAh)) return true;
          if (/sanitasi|kloset|pipa/i.test(lowerRab) && /sanitasi|kloset|pipa/i.test(lowerAh)) return true;

          const keywords = lowerRab
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 3 && !/pekerjaan|pasang|pemasangan|pengadaan/i.test(w));
          return keywords.length > 0 && keywords.some((kw) => lowerAh.includes(kw));
        });

        if (ahspMatch && ahspMatch.komponen && ahspMatch.komponen.length > 0) {
          ahspMatch.komponen.forEach((comp) => {
            const compVol = Math.max(0.01, Math.round((comp.koefisien || 1) * execRabVol * 100) / 100);
            const compJml = Math.round(compVol * (comp.hargaSatuan || 10000));
            const isUpah = comp.kategori === 'UPAH' || /tukang|pekerja|mandor/i.test(comp.uraian);
            const isAlat = comp.kategori === 'ALAT' || /molen|sewa|scaffolding|perancah|gerobak/i.test(comp.uraian);

            // If user explicitly specified single category, honor it:
            if (it.kategoriBiaya === 'BAHAN' && (isUpah || isAlat)) return;
            if (it.kategoriBiaya === 'UPAH' && !isUpah) return;
            if (it.kategoriBiaya === 'ALAT' && !isAlat) return;

            if (isUpah) {
              divUpahTotal += compJml;
              weeklyAhspUpahComponents.push({
                namaBarang: comp.uraian,
                volume: compVol,
                satuan: comp.satuan || 'Hr',
                hargaSatuan: comp.hargaSatuan || 174748,
                jumlah: compJml,
              });
            } else if (isAlat && (it.kategoriBiaya === 'ALAT' || /sewa|alat/i.test(it.uraian))) {
              alatItems.push({
                namaBarang: comp.uraian,
                volume: compVol,
                satuan: comp.satuan || 'set',
                hargaSatuan: comp.hargaSatuan || 50000,
                jumlah: compJml,
              });
            } else if (comp.kategori !== 'ALAT') {
              bahanItems.push({
                namaBarang: comp.uraian,
                volume: compVol,
                satuan: comp.satuan || 'unit',
                hargaSatuan: comp.hargaSatuan || 50000,
                jumlah: compJml,
              });
            }
          });
        } else {
          // Direct RAB SubItem (No AHSP match or direct decomposition)
          const isUpahBahan =
            it.kategoriBiaya === 'UPAH_BAHAN' ||
            (it.kategoriBiaya as string) === 'UPAH&BAHAN' ||
            /upah.*bahan|bahan.*upah/i.test(it.kategoriBiaya || '');

          const cat = isUpahBahan
            ? 'UPAH_BAHAN'
            : it.kategoriBiaya || (
                /upah|gaji|pekerja|tukang|mandor/i.test(it.uraian) ? 'UPAH' :
                /alat|sewa|molen|scaffolding|perancah|gerobak/i.test(it.uraian) ? 'ALAT' :
                /smkk|k3|helm|rompi|sepatu|p3k|rambu|papan nama/i.test(it.uraian) ? 'SMKK' :
                'BAHAN'
              );

          if (cat === 'UPAH_BAHAN') {
            // Pemisahan Otomatis Paket "Upah & Bahan"
            // Rasio Standar Konstruksi: 65% Belanja Bahan/Material, 35% Upah Tenaga Kerja/Tukang
            const bahanNominal = Math.round(execRabJml * 0.65);
            const upahNominal = execRabJml - bahanNominal;

            // 1. Porsi BAHAN -> Terdekomposisi cerdas menjadi rincian barang nyata toko bangunan (bukan judul pekerjaan)
            const decomposed = decomposeRealisticBahanAndUpah(it.uraian, bahanNominal, upahNominal);
            bahanItems.push(...decomposed.bahanItems);

            // 2. Porsi UPAH -> Masuk ke Kwitansi Upah, Tanda Terima/Absensi Pekerja, BKU Kas Upah
            divUpahTotal += upahNominal;
            weeklyAhspUpahComponents.push(...decomposed.upahComponents);
          } else if (cat === 'UPAH') {
            divUpahTotal += execRabJml;
            const decomposedUpah = decomposeRealisticBahanAndUpah(it.uraian, 0, execRabJml);
            if (decomposedUpah.upahComponents.length > 0) {
              weeklyAhspUpahComponents.push(...decomposedUpah.upahComponents);
            } else {
              weeklyAhspUpahComponents.push({
                namaBarang: it.uraian,
                volume: execRabVol,
                satuan: it.satuan,
                hargaSatuan: it.hargaSatuan,
                jumlah: execRabJml,
              });
            }
          } else if (cat === 'ALAT') {
            alatItems.push({
              namaBarang: it.uraian,
              volume: execRabVol,
              satuan: it.satuan,
              hargaSatuan: it.hargaSatuan,
              jumlah: execRabJml,
            });
          } else if (cat === 'SMKK' || cat === 'LAINNYA') {
            smkkItems.push({
              namaBarang: it.uraian,
              volume: execRabVol,
              satuan: it.satuan,
              hargaSatuan: it.hargaSatuan,
              jumlah: execRabJml,
            });
          } else {
            // Kategori BAHAN langsung: Dekomposisi jika bukan merupakan bahan retail murni tunggal
            const isCompositeJob = !isPureDirectMaterial(it.uraian);
            if (isCompositeJob && execRabJml >= 25000) {
              const decomposedBahan = decomposeRealisticBahanAndUpah(it.uraian, execRabJml, 0);
              bahanItems.push(...decomposedBahan.bahanItems);
            } else {
              bahanItems.push({
                namaBarang: it.uraian,
                volume: execRabVol,
                satuan: it.satuan,
                hargaSatuan: it.hargaSatuan,
                jumlah: execRabJml,
              });
            }
          }
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

          // Sebar jadwal belanja material di hari kerja aktif (Selasa s.d Jumat) sesuai urutan divisi dan batch pengiriman
          const matDayOffset = Math.min(4, Math.max(1, 1 + ((dIdx * 2 + c) % 4)));
          const matDateInfo = getDateInWeek(weekDates.startDate, matDayOffset);
          const seqNo = targetWeek * 10 + dIdx * 2 + c + 1;
          const kwMatBukti = `${String(seqNo).padStart(2, '0')}/KW-MAT/${yearStr}`;
          const spbBukti = `SPB-${String(seqNo).padStart(2, '0')}/MAT/${yearStr}`;

          const isTaxable = chunkNominal >= 2000000;
          const ppn = isTaxable ? Math.round((chunkNominal / 1.11) * 0.11 * 100) / 100 : 0;
          const pph22 = isTaxable ? Math.round((chunkNominal / 1.11) * 0.015 * 100) / 100 : 0;

          const isPerabot = div.kode === 'XII' || /perabot|mebeler|meja|kursi/i.test(div.uraian);
          const targetStore = isPerabot ? defaultPerabotStore : defaultMaterialStore;

          // Normalize items volume and unit prices for realism
          const normalizedChunkItems = normalizeMaterialItems(chunkItems);

          const matKwDoc: KwitansiDocument = {
            id: `kw-mat-m${targetWeek}-${dIdx}-${c}-${Date.now()}`,
            noBukti: kwMatBukti,
            noSpb: spbBukti,
            tipe: isPerabot ? 'PERABOT' : 'MATERIAL',
            tanggal: matDateInfo.dateSlash,
            tanggalFormatted: matDateInfo.dateFormatted,
            bulan: matDateInfo.bulan,
            uraian: `Pembayaran Lunas Biaya Pembelian Material/Bahan (${normalizedChunkItems.map((i) => i.namaBarang).slice(0, 3).join(', ')}), Untuk Pekerjaan ${div.uraian} Revitalisasi ${school.namaSekolah}, Tahun ${yearStr}, Daftar Terlampir.`,
            penerimaNama: targetStore.pemilikNama || 'Pemilik Toko',
            penerimaPekerjaan: `Pemilik ${targetStore.namaToko}`,
            penerimaAlamat: targetStore.alamat || school.kabKota,
            namaToko: targetStore.namaToko,
            items: normalizedChunkItems,
            nominal: chunkNominal,
            isPpn: isTaxable,
            isPph22: isTaxable,
            isPph23: false,
            ppnAmount: ppn,
            pph22Amount: pph22,
            pph23Amount: 0,
            kategoriBiayaPajak: isPerabot ? 'Perabot' : 'Konstruksi',
            keteranganSpb: `Surat Perintah Bayar Pembelian Bahan Material ${div.uraian} Minggu Ke-${targetWeek} (${matDateInfo.dateFormatted})`,
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

          // Sewa / penggunaan alat di pertengahan minggu (Rabu atau Kamis)
          const alatDayOffset = Math.min(3, Math.max(1, 2 + (dIdx % 2)));
          const alatDateInfo = getDateInWeek(weekDates.startDate, alatDayOffset);

          const normalizedAlatItems = normalizeMaterialItems(alatItems);

          const alatDoc: KwitansiDocument = {
            id: `kw-alat-m${targetWeek}-${dIdx}-${Date.now()}`,
            noBukti: kwAlatBukti,
            noSpb: spbAlatBukti,
            tipe: 'OPERASIONAL',
            tanggal: alatDateInfo.dateSlash,
            tanggalFormatted: alatDateInfo.dateFormatted,
            bulan: alatDateInfo.bulan,
            uraian: `Pembayaran Lunas Biaya Sewa/Pengadaan Alat Bantu Kerja (${normalizedAlatItems.map((i) => i.namaBarang).join(', ')}), Untuk Pekerjaan ${div.uraian} Revitalisasi ${school.namaSekolah}, Tahun ${yearStr}.`,
            penerimaNama: defaultMaterialStore.pemilikNama || 'Penyedia Sewa Alat',
            penerimaPekerjaan: `Penyedia Alat & Perlengkapan`,
            penerimaAlamat: defaultMaterialStore.alamat || school.kabKota,
            namaToko: defaultMaterialStore.namaToko,
            items: normalizedAlatItems,
            nominal: alatNominal,
            isPpn: false,
            isPph22: false,
            isPph23: true,
            ppnAmount: 0,
            pph22Amount: 0,
            pph23Amount: pph23,
            kategoriBiayaPajak: 'Peralatan',
            keteranganSpb: `Surat Perintah Bayar Sewa/Alat Bantu Kerja ${div.uraian} Minggu Ke-${targetWeek} (${alatDateInfo.dateFormatted})`,
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

          // Perlengkapan SMKK / K3 (Helm, Rompi, P3K, Papan Nama) disiapkan pada hari pertama minggu (Senin / Day 0)
          const smkkDateInfo = getDateInWeek(weekDates.startDate, 0);

          const smkkDoc: KwitansiDocument = {
            id: `kw-smkk-m${targetWeek}-${dIdx}-${Date.now()}`,
            noBukti: kwSmkkBukti,
            noSpb: spbSmkkBukti,
            tipe: 'OPERASIONAL',
            tanggal: smkkDateInfo.dateSlash,
            tanggalFormatted: smkkDateInfo.dateFormatted,
            bulan: smkkDateInfo.bulan,
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
            keteranganSpb: `Surat Perintah Bayar Pengadaan SMKK & K3 Minggu Ke-${targetWeek} (${smkkDateInfo.dateFormatted})`,
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
        const rawTokoItems = rpdCandidates.map((it) => {
          const volProp = Math.max(0.1, Math.round(progressRatio * it.volume100 * 100) / 100);
          return {
            namaBarang: it.uraian,
            volume: volProp,
            satuan: it.satuan,
            hargaSatuan: it.hargaSatuan,
            jumlah: Math.round(volProp * it.hargaSatuan),
          };
        });

        const tokoItems = normalizeMaterialItems(rawTokoItems);
        const nominalMaterial = tokoItems.reduce((s, it) => s + it.jumlah, 0);
        if (nominalMaterial > 0) {
          const rpdMatDayOffset = Math.min(4, Math.max(1, 1 + (dIdx % 4)));
          const rpdDateInfo = getDateInWeek(weekDates.startDate, rpdMatDayOffset);
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
            tanggal: rpdDateInfo.dateSlash,
            tanggalFormatted: rpdDateInfo.dateFormatted,
            bulan: rpdDateInfo.bulan,
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
            keteranganSpb: `Surat Perintah Bayar Bahan Material ${div.uraian} Minggu Ke-${targetWeek} (${rpdDateInfo.dateFormatted})`,
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

      // Administrasi LPJ dibayarkan pada hari Jumat (Day 4) saat penyusunan laporan mingguan & dokumentasi selesai
      // Honor Konsultan Perencana & Pengawas pada hari Sabtu (Day 5 / Akhir Minggu)
      const opDayOffset = isAdm ? 4 : 5;
      const opDateInfo = getDateInWeek(weekDates.startDate, opDayOffset);

      const manKwDoc: KwitansiDocument = {
        id: `kw-man-m${targetWeek}-${dIdx}-${Date.now()}`,
        noBukti: kwBukti,
        noSpb: `SPB-${kwBukti}`,
        tipe: tipeKw,
        tanggal: opDateInfo.dateSlash,
        tanggalFormatted: opDateInfo.dateFormatted,
        bulan: opDateInfo.bulan,
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
            namaBarang: isAdm
              ? `Biaya Pengelolaan Administrasi, ATK & Dokumentasi Minggu Ke-${targetWeek}`
              : `Honorarium Jasa / Pengelolaan Minggu Ke-${targetWeek}`,
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
        keteranganSpb: `Surat Perintah Bayar ${isAdm ? 'Biaya Administrasi' : 'Honor Jasa'} Minggu Ke-${targetWeek} (${opDateInfo.dateFormatted})`,
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

  // 6. Process UPAH & Weekly Wage Report with Full-Capacity Sequential Core Worker Allocation
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

  const targetWage = totalWageAmountForWeek > 0 ? totalWageAmountForWeek : 2740737;
  let remainingWageBudget = targetWage;
  const sequentialAttendance: any[] = [];

  for (let i = 0; i < activeWorkersList.length; i++) {
    if (remainingWageBudget <= 0) break;

    const w = activeWorkersList[i];
    const safeDomisili: 'Dalam Desa' | 'Luar Desa' = w.domisili === 'Luar Desa' ? 'Luar Desa' : 'Dalam Desa';
    const exactRate = getAhspWageRateForRole(w.peran, w.peranLabel, realSchoolData?.ahspList, w.upahHarian);
    const isLastWorker = i === activeWorkersList.length - 1;

    let assignedHok = 0;
    let assignedTotal = 0;
    let assignedDailyRate = exactRate;

    if (isLastWorker || remainingWageBudget < exactRate * 2) {
      assignedTotal = remainingWageBudget;
      let calculatedHok = Math.round(assignedTotal / exactRate);
      assignedHok = Math.min(7, Math.max(1, calculatedHok));
      assignedDailyRate = Math.round((assignedTotal / assignedHok) * 100) / 100;
      remainingWageBudget = 0;
    } else {
      const maxHokPossible = Math.min(7, Math.max(1, Math.floor(remainingWageBudget / exactRate)));
      assignedHok = maxHokPossible;
      assignedTotal = Math.round(assignedHok * exactRate);
      remainingWageBudget -= assignedTotal;
    }

    const days: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0];
    for (let d = 0; d < Math.min(7, assignedHok); d++) {
      days[d] = 1;
    }

    sequentialAttendance.push({
      workerId: w.id,
      nama: w.nama,
      jenisKelamin: w.jenisKelamin,
      domisili: safeDomisili,
      peran: w.peran,
      peranLabel: w.peranLabel,
      days,
      hok: assignedHok,
      upahHarian: assignedDailyRate,
      totalUpah: assignedTotal,
    });
  }

  // Sisa selisih terakhir diserap tepat
  if (remainingWageBudget > 0 && sequentialAttendance.length > 0) {
    const lastIdx = sequentialAttendance.length - 1;
    sequentialAttendance[lastIdx].totalUpah += remainingWageBudget;
    sequentialAttendance[lastIdx].upahHarian = Math.round((sequentialAttendance[lastIdx].totalUpah / (sequentialAttendance[lastIdx].hok || 1)) * 100) / 100;
  }

  const totCalculatedUpah = sequentialAttendance.reduce((s, a) => s + a.totalUpah, 0);

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
    attendance: sequentialAttendance,
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
    items: (() => {
      // 1. Prioritize AHSP UPAH components from active division (Tukang Kayu, Tukang Cat, Pekerja, Tukang Batu, dll.)
      if (weeklyAhspUpahComponents.length > 0) {
        const groupedUpah = new Map<string, { volume: number; satuan: string; hargaSatuan: number; jumlah: number }>();
        weeklyAhspUpahComponents.forEach((c) => {
          const existing = groupedUpah.get(c.namaBarang);
          if (existing) {
            existing.volume = Math.round((existing.volume + c.volume) * 100) / 100;
            existing.jumlah += c.jumlah;
          } else {
            groupedUpah.set(c.namaBarang, {
              volume: c.volume,
              satuan: 'HOK',
              hargaSatuan: c.hargaSatuan,
              jumlah: c.jumlah,
            });
          }
        });

        const rawList = Array.from(groupedUpah.entries()).map(([nama, data]) => ({
          namaBarang: nama,
          volume: data.volume,
          satuan: 'HOK',
          hargaSatuan: data.hargaSatuan,
          jumlah: data.jumlah,
        }));

        const rawTotal = rawList.reduce((s, it) => s + it.jumlah, 0);
        if (rawTotal > 0 && totCalculatedUpah > 0) {
          // REALISTIC INTEGER HOK BALANCING (Absensi Bulat Tanpa Pecahan Koma)
          // Menghitung HOK bulat riil (5-7 HOK per orang/minggu) dengan tarif resmi AHSP/RAB
          // Total nominal tetap 100% klop persis dengan totCalculatedUpah tanpa selisih 1 rupiah pun
          let runningSum = 0;
          return rawList.map((it, idx) => {
            if (idx === rawList.length - 1) {
              const lastJml = totCalculatedUpah - runningSum;
              // Dihitung HOK bulat (atau setengah hari 0.5 jika diperlukan), minimal 1 HOK
              let integerHok = Math.round(lastJml / it.hargaSatuan);
              if (integerHok < 1) integerHok = 1;
              const roundedUnitPrice = Math.round(lastJml / integerHok);
              return {
                ...it,
                volume: integerHok,
                satuan: 'HOK',
                hargaSatuan: roundedUnitPrice,
                jumlah: lastJml,
              };
            }
            const scaledJml = Math.round((it.jumlah / rawTotal) * totCalculatedUpah);
            runningSum += scaledJml;
            let integerHok = Math.round(scaledJml / it.hargaSatuan);
            if (integerHok < 1) integerHok = 1;
            const roundedUnitPrice = Math.round(scaledJml / integerHok);
            return {
              ...it,
              volume: integerHok,
              satuan: 'HOK',
              hargaSatuan: roundedUnitPrice,
              jumlah: scaledJml,
            };
          });
        }
        return rawList;
      }

      // 2. Intelligent Auto-Generation of Specialized Worker Roles from Active Divisions
      // Jika belum ada tenaga khusus di master atau data ahsp spesifik, buatkan otomatis
      // (Tukang Kayu, Tukang Cat, Pekerja, Tukang Pipa, Tukang Listrik, Tukang Gali, Tukang Batu)
      const detectedSpecialties: { peranLabel: string; tarif: number; hokRatio: number }[] = [];
      const divNames = activeDivisions.map((d) => (d.uraian || '').toLowerCase()).join(' ');

      if (/galian|tanah|urugan|pondasi/i.test(divNames)) {
        detectedSpecialties.push({ peranLabel: 'Tukang Gali', tarif: 150000, hokRatio: 0.35 });
        detectedSpecialties.push({ peranLabel: 'Tukang Batu', tarif: 150000, hokRatio: 0.35 });
        detectedSpecialties.push({ peranLabel: 'Pekerja Lapangan', tarif: 120000, hokRatio: 0.30 });
      } else if (/pasangan|dinding|bata|plesteran/i.test(divNames)) {
        detectedSpecialties.push({ peranLabel: 'Kepala Tukang Batu', tarif: 180000, hokRatio: 0.25 });
        detectedSpecialties.push({ peranLabel: 'Tukang Batu', tarif: 150000, hokRatio: 0.45 });
        detectedSpecialties.push({ peranLabel: 'Pekerja Pengaduk & Angkut', tarif: 120000, hokRatio: 0.30 });
      } else if (/beton|sloof|kolom|balok|dak/i.test(divNames)) {
        detectedSpecialties.push({ peranLabel: 'Tukang Besi & Cor', tarif: 150000, hokRatio: 0.40 });
        detectedSpecialties.push({ peranLabel: 'Tukang Batu / Cor', tarif: 150000, hokRatio: 0.30 });
        detectedSpecialties.push({ peranLabel: 'Pekerja Lapangan', tarif: 120000, hokRatio: 0.30 });
      } else if (/kayu|kusen|pintu|jendela/i.test(divNames)) {
        detectedSpecialties.push({ peranLabel: 'Kepala Tukang Kayu', tarif: 180000, hokRatio: 0.25 });
        detectedSpecialties.push({ peranLabel: 'Tukang Kayu', tarif: 150000, hokRatio: 0.50 });
        detectedSpecialties.push({ peranLabel: 'Pekerja Pembantu', tarif: 120000, hokRatio: 0.25 });
      } else if (/atap|kuda-kuda|spandek|baja/i.test(divNames)) {
        detectedSpecialties.push({ peranLabel: 'Tukang Rangka Baja & Atap', tarif: 160000, hokRatio: 0.55 });
        detectedSpecialties.push({ peranLabel: 'Pekerja Lapangan', tarif: 120000, hokRatio: 0.45 });
      } else if (/langit|plafon|gypsum|pvc/i.test(divNames)) {
        detectedSpecialties.push({ peranLabel: 'Tukang Plafon & Gypsum', tarif: 150000, hokRatio: 0.55 });
        detectedSpecialties.push({ peranLabel: 'Pekerja Lapangan', tarif: 120000, hokRatio: 0.45 });
      } else if (/lantai|keramik|granit/i.test(divNames)) {
        detectedSpecialties.push({ peranLabel: 'Tukang Pasang Keramik', tarif: 150000, hokRatio: 0.60 });
        detectedSpecialties.push({ peranLabel: 'Pekerja Pemotong & Pengaduk', tarif: 120000, hokRatio: 0.40 });
      } else if (/cat|finishing|pengecatan/i.test(divNames)) {
        detectedSpecialties.push({ peranLabel: 'Tukang Cat & Finishing', tarif: 150000, hokRatio: 0.60 });
        detectedSpecialties.push({ peranLabel: 'Pekerja Pengamplas', tarif: 120000, hokRatio: 0.40 });
      } else if (/listrik|instalasi/i.test(divNames)) {
        detectedSpecialties.push({ peranLabel: 'Tukang Listrik & Instalatur', tarif: 160000, hokRatio: 0.70 });
        detectedSpecialties.push({ peranLabel: 'Pekerja Pembantu', tarif: 120000, hokRatio: 0.30 });
      } else if (/sanitasi|pipa|plambing|wc/i.test(divNames)) {
        detectedSpecialties.push({ peranLabel: 'Tukang Pipa & Plambing', tarif: 150000, hokRatio: 0.65 });
        detectedSpecialties.push({ peranLabel: 'Pekerja Galian Pipa', tarif: 120000, hokRatio: 0.35 });
      }

      if (detectedSpecialties.length > 0 && totCalculatedUpah > 0) {
        let runningSum = 0;
        return detectedSpecialties.map((spec, sIdx) => {
          if (sIdx === detectedSpecialties.length - 1) {
            const lastJml = totCalculatedUpah - runningSum;
            let integerHok = Math.round(lastJml / spec.tarif);
            if (integerHok < 1) integerHok = 1;
            const unitPrice = Math.round(lastJml / integerHok);
            return {
              namaBarang: `Upah ${spec.peranLabel}`,
              volume: integerHok,
              satuan: 'HOK',
              hargaSatuan: unitPrice,
              jumlah: lastJml,
            };
          }
          const sNominal = Math.round(totCalculatedUpah * spec.hokRatio);
          runningSum += sNominal;
          let integerHok = Math.round(sNominal / spec.tarif);
          if (integerHok < 1) integerHok = 1;
          const unitPrice = Math.round(sNominal / integerHok);
          return {
            namaBarang: `Upah ${spec.peranLabel}`,
            volume: integerHok,
            satuan: 'HOK',
            hargaSatuan: unitPrice,
            jumlah: sNominal,
          };
        });
      }

      // 3. Fallback: Detailed worker role attendance list (Mandor, Kepala Tukang, Pekerja)
      return sequentialAttendance.map((att: any) => ({
        namaBarang: `Upah ${att.peranLabel} (${att.nama})`,
        volume: att.hok,
        satuan: 'HOK',
        hargaSatuan: att.upahHarian,
        jumlah: att.totalUpah,
      }));
    })(),
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

  const finalizedKwitansi = newKwitansiList.map((kw) => {
    if (kw.items && kw.items.length > 0 && kw.tipe !== 'UPAH') {
      return {
        ...kw,
        items: normalizeMaterialItems(kw.items),
      };
    }
    return kw;
  });

  return {
    updatedKwitansi: deduplicateKwitansiList(finalizedKwitansi),
    updatedWageReports,
    updatedBkb,
    generatedCount,
  };
}

/**
 * Complete Reset & Rebalancing Engine:
 * Purges all accumulated/duplicate material & wage kwitansis and cleanly rebuilds
 * all weekly expenditures to perfectly match the school's total budget (100% Pagu).
 */
export function rebalanceAndResyncAllKwitansiToBudget(params: {
  school: SchoolMasterData;
  kwitansiList: KwitansiDocument[];
  progressWeeks: ProjectProgressWeek[];
  workers?: any[];
  stores?: StoreVendor[];
  rpdItems?: any[];
  realSchoolData?: any;
}): {
  rebalancedKwitansi: KwitansiDocument[];
  rebalancedWageReports: WeeklyWageReport[];
  rebalancedBkb: BkbTransaction[];
} {
  const { school, kwitansiList, progressWeeks, workers = [], stores = [], rpdItems = [], realSchoolData } = params;
  const targetYear = school?.tahunAnggaran?.trim() || '2026';

  // 1. Keep core non-accumulated documents: Konsultan (Perencana, Pengawas), Pengelola ADM, SMKK
  const preservedBase = kwitansiList.filter((k) => {
    const isKons = k.tipe === 'KONSULTAN' || /kons-p|kons-w|perencana|pengawas/i.test(`${k.noBukti} ${k.uraian}`);
    const isAdm = k.tipe === 'OPERASIONAL' || /\badm\b|pengelola/i.test(`${k.noBukti} ${k.uraian}`);
    const isSmkk = k.tipe === 'SMKK' || /smkk|k3/i.test(`${k.noBukti} ${k.uraian}`);
    return isKons || isAdm || isSmkk;
  });

  // Deduplicate and heal base documents
  const healedPreserved = healKwitansiList(preservedBase, targetYear);

  let currentKwitansi: KwitansiDocument[] = [...healedPreserved];
  let currentWageReports: WeeklyWageReport[] = [];
  let currentBkb: BkbTransaction[] = [];

  // Determine active weeks to generate
  const activeWeeks = progressWeeks
    .filter((w) => (w.bobotRealisasi && w.bobotRealisasi > 0) || w.divisions?.some((d) => d.prestasiMingguIni > 0))
    .map((w) => w.mingguKe);
  const targetWeekNums = activeWeeks.length > 0 ? activeWeeks : Array.from({ length: Math.min(progressWeeks.length || 12, 14) }, (_, i) => i + 1);

  // Run generation cleanly starting from base
  targetWeekNums.forEach((targetWeek) => {
    const weekObj = progressWeeks.find((w) => w.mingguKe === targetWeek);
    if (!weekObj) return;

    const res = generateWeeklyTransactionsFromProgressAndRealData({
      targetWeek,
      weekObj,
      weeksToUse: progressWeeks,
      school,
      workers,
      stores,
      rpdItems,
      realSchoolData,
      existingKwitansi: currentKwitansi,
      existingWageReports: currentWageReports,
      existingBkb: currentBkb,
      splitDays: true,
    });

    currentKwitansi = res.updatedKwitansi;
    currentWageReports = res.updatedWageReports;
    currentBkb = res.updatedBkb;
  });

  return {
    rebalancedKwitansi: deduplicateKwitansiList(currentKwitansi),
    rebalancedWageReports: currentWageReports,
    rebalancedBkb: currentBkb,
  };
}
