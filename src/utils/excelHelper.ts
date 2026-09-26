import * as XLSX from 'xlsx';
import { RealSchoolData, RabDivision, RabSubItem, AhspItem, AhspKomponen } from '../types';

/**
 * Generate and download Excel Template for Real School Data
 * (Rekapitulasi Biaya, Rincian RAB Lengkap, AHSP Analisa Harga Satuan, & Identitas Sekolah)
 */
export function downloadRealDataExcelTemplate(currentData?: RealSchoolData) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: Identitas Sekolah
  const schoolIdentitasData = [
    [
      'Nama Sekolah',
      'Satuan Pendidikan',
      'Kegiatan / Pekerjaan',
      'Lokasi',
      'Kab/Kota',
      'Provinsi',
      'Tahun Anggaran',
      'Luas Bangunan (m2)',
    ],
    [
      currentData?.namaSekolah || 'SD NEGERI 1 BANDA ACEH',
      currentData?.satuanPendidikan || 'SD',
      currentData?.kegiatan || 'Rehabilitasi Ruang Kelas Rusak Sedang/Berat',
      currentData?.lokasi || 'Jl. Pendidikan No. 12',
      currentData?.kabKota || 'Kota Banda Aceh',
      currentData?.provinsi || 'Aceh',
      currentData?.tahunAnggaran || '2025',
      currentData?.luasBangunanM2 || 120,
    ],
  ];
  const wsIdentitas = XLSX.utils.aoa_to_sheet(schoolIdentitasData);
  // Set column widths
  wsIdentitas['!cols'] = [
    { wch: 30 },
    { wch: 20 },
    { wch: 45 },
    { wch: 30 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsIdentitas, 'Identitas_Sekolah');

  // 2. Sheet 2: Rekapitulasi & Rincian RAB Lengkap
  const rabRows: any[][] = [
    [
      'Kode Divisi',
      'Uraian Divisi / Pekerjaan',
      'Volume',
      'Satuan',
      'Harga Satuan (Rp)',
      'Kategori Biaya',
    ],
  ];

  if (currentData && currentData.divisions && currentData.divisions.length > 0) {
    currentData.divisions.forEach((div) => {
      // Division Header row
      rabRows.push([div.kode, div.uraian, '', '', '', '']);
      // Division items
      div.items.forEach((it) => {
        rabRows.push([
          div.kode,
          it.uraian,
          it.volume,
          it.satuan,
          it.hargaSatuan,
          it.kategoriBiaya || 'BAHAN',
        ]);
      });
    });
  } else {
    // Standard template default sample
    const sampleDivs = [
      {
        kode: 'I',
        uraian: 'PEKERJAAN PERSIAPAN / K3 / MANAJEMEN',
        items: [
          { uraian: 'Pembersihan Lapangan dan Perataan', volume: 120, satuan: 'm²', hargaSatuan: 18500, kat: 'SMKK' },
          { uraian: 'Pemasangan Bowplank / Pengukuran', volume: 48, satuan: 'm1', hargaSatuan: 42000, kat: 'SMKK' },
          { uraian: 'Papan Nama Proyek & Dokumentasi', volume: 1, satuan: 'Ls', hargaSatuan: 750000, kat: 'SMKK' },
        ],
      },
      {
        kode: 'II',
        uraian: 'PEKERJAAN PONDASI DAN STRUKTUR BETON',
        items: [
          { uraian: 'Galian Tanah Pondasi Footplat', volume: 18.5, satuan: 'm³', hargaSatuan: 85000, kat: 'UPAH' },
          { uraian: 'Urugan Pasir Bawah Pondasi t=10cm', volume: 3.2, satuan: 'm³', hargaSatuan: 220000, kat: 'BAHAN' },
          { uraian: 'Pekerjaan Beton Sloof 15/20 cm K-225', volume: 4.8, satuan: 'm³', hargaSatuan: 3850000, kat: 'BAHAN' },
          { uraian: 'Pekerjaan Kolom Praktis 12/12 cm', volume: 3.6, satuan: 'm³', hargaSatuan: 4200000, kat: 'BAHAN' },
        ],
      },
      {
        kode: 'III',
        uraian: 'PEKERJAAN DINDING, PLESTERAN & KERAMIK',
        items: [
          { uraian: 'Pasangan Dinding Bata Merah 1:4', volume: 145, satuan: 'm²', hargaSatuan: 135000, kat: 'BAHAN' },
          { uraian: 'Plesteran Dinding Halus 1:4 t=15mm', volume: 290, satuan: 'm²', hargaSatuan: 68000, kat: 'BAHAN' },
          { uraian: 'Acian Dinding Dalam & Luar', volume: 290, satuan: 'm²', hargaSatuan: 38000, kat: 'BAHAN' },
          { uraian: 'Pasangan Keramik Lantai 40x40 cm Polos', volume: 108, satuan: 'm²', hargaSatuan: 185000, kat: 'BAHAN' },
        ],
      },
      {
        kode: 'IV',
        uraian: 'PEKERJAAN ATAP, PLAFOND & FINISHING',
        items: [
          { uraian: 'Rangka Atap Baja Ringan C75.75', volume: 140, satuan: 'm²', hargaSatuan: 195000, kat: 'BAHAN' },
          { uraian: 'Penutup Atap Seng Gelombang Warna', volume: 140, satuan: 'm²', hargaSatuan: 125000, kat: 'BAHAN' },
          { uraian: 'Rangka & Plafond Gypsum Board 9mm', volume: 120, satuan: 'm²', hargaSatuan: 110000, kat: 'BAHAN' },
          { uraian: 'Pengecatan Tembok Interior & Eksterior', volume: 290, satuan: 'm²', hargaSatuan: 32000, kat: 'BAHAN' },
        ],
      },
    ];

    sampleDivs.forEach((div) => {
      rabRows.push([div.kode, div.uraian, '', '', '', '']);
      div.items.forEach((it) => {
        rabRows.push([div.kode, it.uraian, it.volume, it.satuan, it.hargaSatuan, it.kat]);
      });
    });
  }

  const wsRab = XLSX.utils.aoa_to_sheet(rabRows);
  wsRab['!cols'] = [
    { wch: 15 },
    { wch: 45 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRab, 'Rekapitulasi_dan_RAB');

  // 3. Sheet 3: AHSP Analisa Harga Satuan Pekerjaan
  const ahspRows: any[][] = [
    [
      'Kode Pekerjaan AHSP',
      'Nama Pekerjaan AHSP',
      'Satuan AHSP',
      'Kategori Komponen',
      'Uraian Komponen',
      'Koefisien',
      'Satuan Komponen',
      'Harga Satuan Komponen (Rp)',
    ],
  ];

  if (currentData && currentData.ahspList && currentData.ahspList.length > 0) {
    currentData.ahspList.forEach((ah) => {
      if (ah.komponen && ah.komponen.length > 0) {
        ah.komponen.forEach((k) => {
          ahspRows.push([
            ah.kodePekerjaan,
            ah.namaPekerjaan,
            ah.satuan,
            k.kategori,
            k.uraian,
            k.koefisien,
            k.satuan,
            k.hargaSatuan,
          ]);
        });
      } else {
        ahspRows.push([ah.kodePekerjaan, ah.namaPekerjaan, ah.satuan, '', '', '', '', '']);
      }
    });
  } else {
    // Sample AHSP rows
    const sampleAhsp = [
      {
        kode: 'A.2.2.1.1',
        nama: '1 m² Pembersihan Lapangan dan Perataan',
        satuan: 'm²',
        komponen: [
          { kat: 'UPAH', uraian: 'Pekerja', koef: 0.100, sat: 'OH', harga: 110000 },
          { kat: 'UPAH', uraian: 'Mandor', koef: 0.050, sat: 'OH', harga: 150000 },
        ],
      },
      {
        kode: 'A.3.2.1.2',
        nama: '1 m³ Galian Tanah Biasa Sedalam 1 Meter',
        satuan: 'm³',
        komponen: [
          { kat: 'UPAH', uraian: 'Pekerja', koef: 0.750, sat: 'OH', harga: 110000 },
          { kat: 'UPAH', uraian: 'Mandor', koef: 0.025, sat: 'OH', harga: 150000 },
          { kat: 'ALAT', uraian: 'Cangkul & Sekop', koef: 0.010, sat: 'Ls', harga: 50000 },
        ],
      },
      {
        kode: 'A.4.1.1.1',
        nama: '1 m³ Membuat Beton Mutu f\'c = 19.3 MPa (K-225)',
        satuan: 'm³',
        komponen: [
          { kat: 'BAHAN', uraian: 'Semen Portland (40 kg)', koef: 9.275, sat: 'Zak', harga: 72000 },
          { kat: 'BAHAN', uraian: 'Pasir Beton / Pasir Cor', koef: 0.520, sat: 'm³', harga: 220000 },
          { kat: 'BAHAN', uraian: 'Kerikil / Batu Spilit 2/3', koef: 0.780, sat: 'm³', harga: 280000 },
          { kat: 'UPAH', uraian: 'Pekerja', koef: 1.650, sat: 'OH', harga: 110000 },
          { kat: 'UPAH', uraian: 'Tukang Batu', koef: 0.275, sat: 'OH', harga: 135000 },
          { kat: 'UPAH', uraian: 'Kepala Tukang', koef: 0.028, sat: 'OH', harga: 150000 },
          { kat: 'UPAH', uraian: 'Mandor', koef: 0.083, sat: 'OH', harga: 150000 },
        ],
      },
    ];

    sampleAhsp.forEach((a) => {
      a.komponen.forEach((k) => {
        ahspRows.push([a.kode, a.nama, a.satuan, k.kat, k.uraian, k.koef, k.sat, k.harga]);
      });
    });
  }

  const wsAhsp = XLSX.utils.aoa_to_sheet(ahspRows);
  wsAhsp['!cols'] = [
    { wch: 18 },
    { wch: 45 },
    { wch: 10 },
    { wch: 18 },
    { wch: 35 },
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAhsp, 'AHSP_Analisa_Harga_Satuan');

  // Trigger download
  const fileName = `Template_Data_Real_Sekolah_RAB_AHSP_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Parse uploaded Excel file and update RealSchoolData state
 */
export async function parseRealDataExcelFile(file: File): Promise<{
  success: boolean;
  data?: Partial<RealSchoolData>;
  message: string;
  summary?: {
    divisionsCount: number;
    rabItemsCount: number;
    ahspCount: number;
  };
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return { success: false, message: 'File Excel kosong atau format tidak valid.' };
    }

    const updatedData: Partial<RealSchoolData> = {};
    let divisionsCount = 0;
    let rabItemsCount = 0;
    let ahspCount = 0;

    // 1. Check Sheet Identitas
    const identitasSheetName = wb.SheetNames.find(
      (s) => s.toLowerCase().includes('identitas') || s.toLowerCase().includes('sekolah')
    );
    if (identitasSheetName) {
      const sheet = wb.Sheets[identitasSheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (rows && rows.length >= 2) {
        const dataRow = rows[1];
        if (dataRow) {
          if (dataRow[0]) updatedData.namaSekolah = String(dataRow[0]).trim();
          if (dataRow[1]) updatedData.satuanPendidikan = String(dataRow[1]).trim();
          if (dataRow[2]) updatedData.kegiatan = String(dataRow[2]).trim();
          if (dataRow[3]) updatedData.lokasi = String(dataRow[3]).trim();
          if (dataRow[4]) updatedData.kabKota = String(dataRow[4]).trim();
          if (dataRow[5]) updatedData.provinsi = String(dataRow[5]).trim();
          if (dataRow[6]) updatedData.tahunAnggaran = String(dataRow[6]).trim();
          if (dataRow[7]) updatedData.luasBangunanM2 = parseFloat(dataRow[7]) || 120;
        }
      }
    }

    // 2. Check Sheet Rekapitulasi & RAB
    const rabSheetName = wb.SheetNames.find(
      (s) =>
        s.toLowerCase().includes('rab') ||
        s.toLowerCase().includes('rekap') ||
        s.toLowerCase().includes('rincian')
    ) || wb.SheetNames[0]; // fallback to 1st sheet if matching RAB name not found

    if (rabSheetName && wb.Sheets[rabSheetName]) {
      const sheet = wb.Sheets[rabSheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      if (rows && rows.length > 1) {
        const divisionsMap: Map<string, RabDivision> = new Map();
        let currentDivKode = 'I';
        let currentDivUraian = 'DIVISI UMUM';

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const col0 = row[0] !== undefined ? String(row[0]).trim() : '';
          const col1 = row[1] !== undefined ? String(row[1]).trim() : '';
          const col2 = row[2] !== undefined ? parseFloat(row[2]) || 0 : 0;
          const col3 = row[3] !== undefined ? String(row[3]).trim() : 'm²';
          const col4 = row[4] !== undefined ? parseFloat(row[4]) || 0 : 0;
          const col5 = row[5] !== undefined ? String(row[5]).toUpperCase().trim() : 'BAHAN';

          if (!col0 && !col1) continue;

          // Check if this row is a Division Header (e.g. col0 is Roman/Div code and col2/col4 are empty)
          const isDivisionHeader = col0 && col1 && (!col2 || col2 === 0) && (!col4 || col4 === 0);

          if (isDivisionHeader) {
            currentDivKode = col0.toUpperCase();
            currentDivUraian = col1.toUpperCase();

            if (!divisionsMap.has(currentDivKode)) {
              divisionsMap.set(currentDivKode, {
                id: `div-imp-${Date.now()}-${currentDivKode}`,
                kode: currentDivKode,
                uraian: currentDivUraian,
                subTotal: 0,
                bobotPersen: 0,
                items: [],
              });
            }
          } else {
            // It's a sub-item row
            const targetDivKode = col0 ? col0.toUpperCase() : currentDivKode;
            const itemUraian = col1 || col0;

            if (!itemUraian) continue;

            if (!divisionsMap.has(targetDivKode)) {
              divisionsMap.set(targetDivKode, {
                id: `div-imp-${Date.now()}-${targetDivKode}`,
                kode: targetDivKode,
                uraian: col0 ? `PEKERJAAN DIVISI ${targetDivKode}` : currentDivUraian,
                subTotal: 0,
                bobotPersen: 0,
                items: [],
              });
            }

            const targetDiv = divisionsMap.get(targetDivKode)!;
            const volume = Math.max(0, col2);
            const hargaSatuan = Math.max(0, col4);
            const jumlah = Math.round(volume * hargaSatuan * 100) / 100;

            let katBiaya: 'BAHAN' | 'UPAH' | 'ALAT' | 'SMKK' | 'LAINNYA' = 'BAHAN';
            if (col5.includes('UPAH') || col5.includes('GAJI')) katBiaya = 'UPAH';
            else if (col5.includes('ALAT') || col5.includes('SEWA')) katBiaya = 'ALAT';
            else if (col5.includes('SMKK') || col5.includes('K3') || col5.includes('PERSIAPAN')) katBiaya = 'SMKK';
            else if (col5.includes('LAIN')) katBiaya = 'LAINNYA';

            const newItem: RabSubItem = {
              id: `item-imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              uraian: itemUraian,
              volume,
              satuan: col3 || 'm²',
              hargaSatuan,
              jumlah,
              kategoriBiaya: katBiaya,
            };

            targetDiv.items.push(newItem);
            targetDiv.subTotal += jumlah;
            rabItemsCount++;
          }
        }

        const parsedDivisions = Array.from(divisionsMap.values());
        divisionsCount = parsedDivisions.length;

        // Calculate total RAB and weights
        const totalRab = parsedDivisions.reduce((s, d) => s + d.subTotal, 0);
        const rebalancedDivisions = parsedDivisions.map((d) => ({
          ...d,
          bobotPersen: totalRab > 0 ? parseFloat(((d.subTotal / totalRab) * 100).toFixed(2)) : 0,
        }));

        updatedData.divisions = rebalancedDivisions;
        updatedData.totalNilaiRab = totalRab;
      }
    }

    // 3. Check Sheet AHSP Analisa Harga Satuan
    const ahspSheetName = wb.SheetNames.find(
      (s) => s.toLowerCase().includes('ahsp') || s.toLowerCase().includes('analisa')
    );

    if (ahspSheetName && wb.Sheets[ahspSheetName]) {
      const sheet = wb.Sheets[ahspSheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      if (rows && rows.length > 1) {
        const ahspMap: Map<string, AhspItem> = new Map();

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const kodeAhsp = row[0] ? String(row[0]).trim() : '';
          const namaAhsp = row[1] ? String(row[1]).trim() : '';
          const satuanAhsp = row[2] ? String(row[2]).trim() : 'm²';
          const katKomponen = row[3] ? String(row[3]).toUpperCase().trim() : 'BAHAN';
          const uraianKomp = row[4] ? String(row[4]).trim() : '';
          const koef = row[5] !== undefined ? parseFloat(row[5]) || 0 : 0;
          const satKomp = row[6] ? String(row[6]).trim() : 'OH';
          const hargaKomp = row[7] !== undefined ? parseFloat(row[7]) || 0 : 0;

          if (!kodeAhsp && !namaAhsp) continue;

          const ahspKey = kodeAhsp || namaAhsp;
          if (!ahspMap.has(ahspKey)) {
            ahspMap.set(ahspKey, {
              id: `ahsp-imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              kodePekerjaan: kodeAhsp || 'AHSP-IMP',
              namaPekerjaan: namaAhsp || 'Pekerjaan Analisa',
              satuan: satuanAhsp,
              totalHargaSatuan: 0,
              komponen: [],
            });
          }

          const ahspObj = ahspMap.get(ahspKey)!;

          if (uraianKomp) {
            let kKat: 'BAHAN' | 'UPAH' | 'ALAT' = 'BAHAN';
            if (katKomponen.includes('UPAH') || katKomponen.includes('PEKERJA')) kKat = 'UPAH';
            else if (katKomponen.includes('ALAT')) kKat = 'ALAT';

            const totalKompHarga = Math.round(koef * hargaKomp * 100) / 100;

            const komponenObj: AhspKomponen = {
              id: `komp-imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              kategori: kKat,
              uraian: uraianKomp,
              koefisien: koef,
              satuan: satKomp,
              hargaSatuan: hargaKomp,
              totalHarga: totalKompHarga,
            };

            ahspObj.komponen.push(komponenObj);
            ahspObj.totalHargaSatuan += totalKompHarga;
          }
        }

        const parsedAhspList = Array.from(ahspMap.values());
        ahspCount = parsedAhspList.length;
        updatedData.ahspList = parsedAhspList;
      }
    }

    return {
      success: true,
      data: updatedData,
      message: 'File Excel berhasil diproses.',
      summary: {
        divisionsCount,
        rabItemsCount,
        ahspCount,
      },
    };
  } catch (err: any) {
    console.error('Error reading Excel file:', err);
    return {
      success: false,
      message: `Gagal membaca file Excel: ${err?.message || 'Format tidak valid'}`,
    };
  }
}
