import { DivisionProgressItem, ProjectProgressWeek, KwitansiDocument, WeeklyWageReport, WorkerItem, SchoolMasterData, RpdItem, TokoItem } from '../types';

/**
 * Convert positive integer to Roman numeral string (1 -> I, 2 -> II, 4 -> IV, etc.)
 */
export function toRoman(num: number): string {
  if (num <= 0 || !Number.isFinite(num)) return '';
  const romanMap: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let res = '';
  let n = Math.floor(num);
  for (const [val, roman] of romanMap) {
    while (n >= val) {
      res += roman;
      n -= val;
    }
  }
  return res;
}

/**
 * Renumber items sequentially using Roman numerals according to their category ('FISIK' or 'MANAJEMEN')
 */
export function renumberDivisions<T extends { kode: string; kategori: 'FISIK' | 'MANAJEMEN' }>(items: T[]): T[] {
  let fisikIndex = 0;
  let manIndex = 0;
  return items.map((item) => {
    if (item.kategori === 'FISIK') {
      fisikIndex += 1;
      return { ...item, kode: toRoman(fisikIndex) };
    } else {
      manIndex += 1;
      return { ...item, kode: toRoman(manIndex) };
    }
  });
}

export const DEFAULT_DIVISIONS: Omit<DivisionProgressItem, 'prestasiMingguLalu' | 'prestasiMingguIni' | 'prestasiSdMingguIni'>[] = [
  { id: 'div-1', kode: 'I', kategori: 'FISIK', uraian: 'PEKERJAAN PERSIAPAN', bobotTotal: 2.66, materialRef: ['Papan Nama', 'APD', 'SMKK'] },
  { id: 'div-2', kode: 'II', kategori: 'FISIK', uraian: 'PEKERJAAN GALIAN & URUGAN', bobotTotal: 1.79, materialRef: ['Tanah Timbun', 'Pasir Uruk'] },
  { id: 'div-3', kode: 'III', kategori: 'FISIK', uraian: 'PEKERJAAN PASANGAN', bobotTotal: 14.96, materialRef: ['Bata Merah', 'Batu Bata', 'Batu Kali', 'Pasir Pasang'] },
  { id: 'div-4', kode: 'IV', kategori: 'FISIK', uraian: 'PEKERJAAN BETON', bobotTotal: 13.66, materialRef: ['Besi Polos', 'Kerikil', 'Pasir Beton', 'Kawat tali beton', 'Semen PC'] },
  { id: 'div-5', kode: 'V', kategori: 'FISIK', uraian: 'PEKERJAAN KAYU, KACA, DAN BESI', bobotTotal: 8.36, materialRef: ['Kayu', 'Kusen', 'Daun Pintu', 'Daun Jendela', 'Besi Strip'] },
  { id: 'div-6', kode: 'VI', kategori: 'FISIK', uraian: 'PEKERJAAN ATAP', bobotTotal: 17.62, materialRef: ['Seng Spandek', 'Baja Profil', 'Baja ringan', 'Rangka Metal', 'Rabung'] },
  { id: 'div-7', kode: 'VII', kategori: 'FISIK', uraian: 'PEKERJAAN LANGIT-LANGIT', bobotTotal: 9.94, materialRef: ['Plafon PVC', 'Papan Gypsum', 'Rangka Furing', 'List Profil'] },
  { id: 'div-8', kode: 'VIII', kategori: 'FISIK', uraian: 'PEKERJAAN LANTAI', bobotTotal: 10.05, materialRef: ['Keramik', 'Semen Warna'] },
  { id: 'div-9', kode: 'IX', kategori: 'FISIK', uraian: 'PEKERJAAN CAT-CATAN', bobotTotal: 5.32, materialRef: ['Cat Dasar', 'Cat Penutup', 'Cat Tembok', 'Tinner', 'Ampelas', 'Kuas'] },
  { id: 'div-10', kode: 'X', kategori: 'FISIK', uraian: 'PEKERJAAN INSTALASI LISTRIK', bobotTotal: 1.60, materialRef: ['Kabel NYM', 'Downlight', 'Lampu LED', 'Saklar', 'Stop Kontak', 'MCB'] },
  { id: 'div-11', kode: 'XI', kategori: 'FISIK', uraian: 'PEKERJAAN MEBELER', bobotTotal: 7.62, materialRef: ['Kursi Guru', 'Meja Guru', 'Kursi Siswa', 'Meja Siswa', 'Meja & Kursi'] },
  { id: 'div-m1', kode: 'I', kategori: 'MANAJEMEN', uraian: 'BIAYA PERENCANAAN', bobotTotal: 1.85, materialRef: ['Perencanaan'] },
  { id: 'div-m2', kode: 'II', kategori: 'MANAJEMEN', uraian: 'BIAYA PENGAWASAN', bobotTotal: 2.19, materialRef: ['Pengawasan'] },
  { id: 'div-m3', kode: 'III', kategori: 'MANAJEMEN', uraian: 'BIAYA PENGELOLAAN', bobotTotal: 2.41, materialRef: ['Pengelolaan', 'ATK'] },
];

interface WeekPlanItem {
  m: number;
  p: string;
  r: number;
  wkFisik: Record<string, number>;
  wkAdm: Record<string, number>;
  ket: string;
}

/**
 * Generate weekly progression with realistic weekly incremental weights for all 14 weeks
 */
export function buildDefaultWeeklyProgress(): ProjectProgressWeek[] {
  const weeksPlan: WeekPlanItem[] = [
    { m: 1, p: '01 Jul - 07 Jul 2026', r: 1.73, wkFisik: { 'div-1': 0.84 }, wkAdm: { 'div-m1': 0.55, 'div-m2': 0.22, 'div-m3': 0.24 }, ket: 'Pekerjaan persiapan, papan nama, K3, perencanaan teknis' },
    { m: 2, p: '08 Jul - 14 Jul 2026', r: 5.50, wkFisik: { 'div-1': 1.82, 'div-2': 1.79, 'div-3': 1.50 }, wkAdm: { 'div-m1': 0.30, 'div-m2': 0.20 }, ket: 'Pembersihan lapangan, galian tanah pondasi, pondasi batu kali' },
    { m: 3, p: '15 Jul - 21 Jul 2026', r: 12.80, wkFisik: { 'div-3': 4.00, 'div-4': 3.50, 'div-5': 1.20 }, wkAdm: { 'div-m2': 0.30, 'div-m3': 0.30 }, ket: 'Pasangan dinding bata merah, cor sloof dan kolom praktis' },
    { m: 4, p: '22 Jul - 28 Jul 2026', r: 21.00, wkFisik: { 'div-3': 4.50, 'div-4': 3.80, 'div-5': 1.80 }, wkAdm: { 'div-m2': 0.30 }, ket: 'Lanjutan dinding bata, ring balok, persiapan kusen pintu/jendela' },
    { m: 5, p: '29 Jul - 04 Agu 2026', r: 33.50, wkFisik: { 'div-3': 4.96, 'div-6': 6.50, 'div-5': 2.00 }, wkAdm: { 'div-m2': 0.30 }, ket: 'Kuda-kuda rangka baja profil, gording, dan atap spandek' },
    { m: 6, p: '05 Agu - 11 Agu 2026', r: 47.00, wkFisik: { 'div-6': 11.12, 'div-7': 3.50, 'div-5': 1.50 }, wkAdm: { 'div-m3': 0.50 }, ket: 'Penutupan atap spandek tuntas, rangka plafon furing' },
    { m: 7, p: '12 Agu - 18 Agu 2026', r: 58.00, wkFisik: { 'div-7': 6.44, 'div-8': 4.00, 'div-4': 3.00 }, wkAdm: { 'div-m2': 0.30 }, ket: 'Pemasangan plafon PVC, rabat lantai kerja' },
    { m: 8, p: '19 Agu - 25 Agu 2026', r: 70.00, wkFisik: { 'div-8': 6.05, 'div-4': 3.36, 'div-5': 1.86 }, wkAdm: { 'div-m1': 0.50, 'div-m2': 0.20 }, ket: 'Pemasangan lantai keramik 40x40, evaluasi termin 1 (70%)' },
    { m: 9, p: '26 Agu - 01 Sep 2026', r: 78.50, wkFisik: { 'div-9': 2.50, 'div-10': 0.80, 'div-11': 2.50 }, wkAdm: { 'div-m2': 0.20 }, ket: 'Pengecatan dasar interior/eksterior, instalasi pipa kabel listrik' },
    { m: 10, p: '02 Sep - 08 Sep 2026', r: 87.00, wkFisik: { 'div-9': 2.82, 'div-10': 0.80, 'div-11': 2.50 }, wkAdm: { 'div-m3': 0.40 }, ket: 'Finishing cat penutup tembok & kayu, pemasangan armatur lampu' },
    { m: 11, p: '09 Sep - 15 Sep 2026', r: 92.50, wkFisik: { 'div-11': 2.62 }, wkAdm: { 'div-m1': 0.50, 'div-m2': 0.20 }, ket: 'Pengiriman perabot mebeler meja siswa dan guru' },
    { m: 12, p: '16 Sep - 22 Sep 2026', r: 96.00, wkFisik: {}, wkAdm: { 'div-m2': 0.17, 'div-m3': 0.47 }, ket: 'Penataan mebeler, instalasi kunci & engsel, cek fungsi' },
    { m: 13, p: '23 Sep - 29 Sep 2026', r: 98.50, wkFisik: {}, wkAdm: { 'div-m3': 0.30 }, ket: 'Pembersihan sisa material, perapihan lanskap, uji operasional' },
    { m: 14, p: '30 Sep - 06 Okt 2026', r: 100.00, wkFisik: {}, wkAdm: { 'div-m3': 0.20 }, ket: 'Pekerjaan 100% tuntas, penyusunan LPJ final dan serah terima' },
  ];

  // Accumulator for cumulative weights
  const cumulativeMap: Record<string, number> = {};
  DEFAULT_DIVISIONS.forEach((d) => (cumulativeMap[d.id] = 0));

  return weeksPlan.map((wp) => {
    const combinedWk: Record<string, number> = { ...wp.wkFisik, ...wp.wkAdm };
    
    const divisions: DivisionProgressItem[] = DEFAULT_DIVISIONS.map((def) => {
      const lalu = cumulativeMap[def.id] || 0;
      const ini = combinedWk[def.id] || 0;
      const sdIni = Math.min(def.bobotTotal, Math.round((lalu + ini) * 100) / 100);
      cumulativeMap[def.id] = sdIni;

      return {
        ...def,
        prestasiMingguLalu: lalu,
        prestasiMingguIni: ini,
        prestasiSdMingguIni: sdIni,
      };
    });

    const totalRealSdIni = divisions.reduce((s, d) => s + d.prestasiSdMingguIni, 0);
    const roundedReal = Math.min(100, Math.round(totalRealSdIni * 100) / 100);
    const dev = Math.round((roundedReal - wp.r) * 100) / 100;

    return {
      mingguKe: wp.m,
      periode: wp.p,
      bobotRencana: wp.r,
      bobotRealisasi: roundedReal,
      deviasi: dev,
      keterangan: wp.ket,
      itemPekerjaan: Object.keys(wp.wkFisik),
      rencanaWaktuHK: 112,
      waktuTerlaksanaHK: wp.m * 7,
      sisaWaktuHK: Math.max(0, 112 - (wp.m * 7)),
      divisions,
    };
  });
}
