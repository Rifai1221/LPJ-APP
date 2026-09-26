import {
  SchoolMasterData,
  RpdItem,
  WorkerItem,
  WeeklyWageReport,
  KwitansiDocument,
  BkuTransaction,
  BktTransaction,
  BkbTransaction,
  TaxRecord,
  ProjectProgressWeek,
} from '../types';
import { initialSchoolData, initialWorkers, initialRpdItems, initialProgressWeeks, initialKwitansiList } from './initialData';
import { initialKwitansiListPart2, initialBkbRecords } from './initialData2';

export function getCompleteInitialKwitansiList(): KwitansiDocument[] {
  return [...initialKwitansiList, ...initialKwitansiListPart2];
}

export function generateSampleWeeklyWageReports(workers: WorkerItem[]): WeeklyWageReport[] {
  const weeksMeta = [
    { ke: 1, bulan: 'Oktober 2025', start: '20 Oktober 2025', end: '26 Oktober 2025', kw: 'UK/03/2025', total: 13740000 },
    { ke: 2, bulan: 'November 2025', start: '27 Oktober 2025', end: '02 November 2025', kw: 'UK/04/2025', total: 12260000 },
    { ke: 3, bulan: 'November 2025', start: '03 November 2025', end: '09 November 2025', kw: 'UK/05/2025', total: 18710000 },
    { ke: 4, bulan: 'November 2025', start: '10 November 2025', end: '16 November 2025', kw: 'UK/06/2025', total: 17670000 },
    { ke: 5, bulan: 'November 2025', start: '17 November 2025', end: '23 November 2025', kw: 'UK/07/2025', total: 17870000 },
    { ke: 6, bulan: 'November 2025', start: '24 November 2025', end: '30 November 2025', kw: 'UK/09/2025', total: 18790000 },
    { ke: 7, bulan: 'Desember 2025', start: '01 Desember 2025', end: '07 Desember 2025', kw: 'UK/10/2025', total: 18590000 },
    { ke: 8, bulan: 'Desember 2025', start: '08 Desember 2025', end: '14 Desember 2025', kw: 'UK/11/2025', total: 19310000 },
    { ke: 9, bulan: 'Desember 2025', start: '15 Desember 2025', end: '21 Desember 2025', kw: 'UK/12/2025', total: 20310000 },
    { ke: 10, bulan: 'Desember 2025', start: '22 Desember 2025', end: '28 Desember 2025', kw: 'UK/13/2025', total: 19270000 },
    { ke: 11, bulan: 'Januari 2026', start: '29 Desember 2025', end: '04 Januari 2026', kw: 'UK/14/2025', total: 8740000 },
    { ke: 12, bulan: 'Januari 2026', start: '05 Januari 2026', end: '11 Januari 2026', kw: 'UK/15/2025', total: 22370000 },
    { ke: 13, bulan: 'Januari 2026', start: '12 Januari 2026', end: '18 Januari 2026', kw: 'UK/16/2025', total: 21770000 },
    { ke: 14, bulan: 'Januari 2026', start: '19 Januari 2026', end: '25 Januari 2026', kw: 'UK/20/2025', total: 21250000 },
  ];

  return weeksMeta.map((m) => {
    // Generate realistic attendance rows for workers based on week
    const attendance = workers.map((w, idx) => {
      let days: [number, number, number, number, number, number, number] = [1, 1, 1, 1, 0, 1, 1];
      if (m.ke === 11) {
        // short week
        days = [1, 1, 0, 0, 0, 0, 0];
      } else if (idx % 3 === 0) {
        days = [1, 1, 0, 1, 0, 1, 1];
      } else if (idx % 5 === 0) {
        days = [0, 1, 1, 1, 0, 0, 1];
      }
      const hok = days.reduce((a, b) => a + b, 0);
      const totalUpah = hok * w.upahHarian;
      return {
        workerId: w.id,
        nama: w.nama,
        jenisKelamin: w.jenisKelamin,
        domisili: w.domisili,
        peran: w.peran,
        days,
        hok,
        upahHarian: w.upahHarian,
        totalUpah,
      };
    });

    const calculatedTotal = attendance.reduce((sum, item) => sum + item.totalUpah, 0);

    return {
      id: `wage-m${m.ke}`,
      mingguKe: m.ke,
      bulan: m.bulan,
      periodeStart: m.start,
      periodeEnd: m.end,
      tanggalKwitansi: m.end,
      noBuktiKwitansi: m.kw,
      penerimaNama: 'Budiman',
      penerimaJabatan: 'Kepala Tukang',
      attendance,
      totalUpah: m.total || calculatedTotal,
      bobotMingguIni: 7.14,
      bobotKumulatif: Math.min(100, Math.round(m.ke * 7.14 * 10) / 10),
    };
  });
}
