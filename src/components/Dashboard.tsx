import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Wallet,
  Receipt,
  Users,
  FileCheck2,
  Printer,
  ChevronRight,
  Sparkles,
  Building,
  CheckCircle2,
  Clock,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import {
  SchoolMasterData,
  RpdItem,
  KwitansiDocument,
  WeeklyWageReport,
  ProjectProgressWeek,
  TaxRecord,
} from '../types';
import { formatRupiah, formatNumber } from '../utils/formatters';

interface DashboardProps {
  school: SchoolMasterData;
  rpdItems: RpdItem[];
  kwitansiList: KwitansiDocument[];
  wageReports: WeeklyWageReport[];
  progressWeeks: ProjectProgressWeek[];
  taxRecords: TaxRecord[];
  onNavigateTab: (tab: string) => void;
  onOpenPrintModal: (docType: string) => void;
  onOpenQuickReceipt: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  school,
  rpdItems,
  kwitansiList,
  wageReports,
  progressWeeks,
  taxRecords,
  onNavigateTab,
  onOpenPrintModal,
  onOpenQuickReceipt,
}) => {
  // Calculations
  const totalAnggaran = school.totalAnggaran || 767972563;
  const totalRealisasi = kwitansiList.reduce((acc, curr) => acc + curr.nominal, 0);
  const sisaAnggaran = totalAnggaran - totalRealisasi;
  const persentaseKeuangan = Math.min(100, (totalRealisasi / totalAnggaran) * 100);

  const latestWeek = progressWeeks[progressWeeks.length - 1] || {
    bobotRealisasi: 100,
    bobotRencana: 100,
  };
  const currentFisik = latestWeek.bobotRealisasi;

  const totalPajakPPN = taxRecords.reduce((sum, t) => sum + t.ppn11, 0);
  const totalPajakPPh22 = taxRecords.reduce((sum, t) => sum + t.pph22, 0);
  const totalPajakPPh23 = taxRecords.reduce((sum, t) => sum + t.pph23, 0);
  const totalSemuaPajak = totalPajakPPN + totalPajakPPh22 + totalPajakPPh23;

  const totalUpahTerbayar = wageReports.reduce((sum, w) => sum + w.totalUpah, 0);
  const totalKwitansiMaterial = kwitansiList.filter((k) => k.tipe === 'MATERIAL').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-blue-700/40">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold border border-blue-400/30">
              <Building className="w-3.5 h-3.5" />
              Sistem LPJ Revitalisasi Terintegrasi
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {school.namaSekolah}
            </h2>
            <p className="text-sm text-slate-300">
              {school.pekerjaan} • {school.kabKota}, {school.provinsi}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <span>NPSN: <strong className="text-white">{school.npsn}</strong></span>
              <span>•</span>
              <span>Periode: <strong className="text-white">{school.periodePenggunaan}</strong></span>
              <span>•</span>
              <span>Bendahara: <strong className="text-white">{school.namaBendahara}</strong></span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onNavigateTab('realdata')}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Data Real Sekolah (RAB & AHSP)</span>
            </button>
            <button
              onClick={onOpenQuickReceipt}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>+ Buat Kwitansi Cepat</span>
            </button>
            <button
              onClick={() => onOpenPrintModal('ALL')}
              className="bg-slate-800/90 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-700 shadow transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Cetak Bundle LPJ</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pagu */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pagu Bantuan</span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">{formatRupiah(totalAnggaran)}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>T1 (70%): {formatRupiah(school.termin1Nilai)}</span>
            <span>T2 (30%): {formatRupiah(school.termin2Nilai)}</span>
          </div>
        </div>

        {/* Realisasi Keuangan */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Realisasi Kas</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-emerald-700">{formatRupiah(totalRealisasi)}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${persentaseKeuangan}%` }}
              />
            </div>
            <span className="text-xs font-bold text-emerald-700">{formatNumber(persentaseKeuangan, 1)}%</span>
          </div>
        </div>

        {/* Progress Fisik */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Progres Fisik</span>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-indigo-700">{formatNumber(currentFisik, 1)}%</p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Rencana: {formatNumber(latestWeek.bobotRencana, 1)}%</span>
            <span className="text-emerald-600 font-semibold">Deviasi: +{formatNumber(latestWeek.deviasi, 1)}%</span>
          </div>
        </div>

        {/* Pajak Dipungut */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Setor Pajak</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-xl font-bold text-amber-700">{formatRupiah(totalSemuaPajak)}</p>
          <div className="mt-2 text-xs text-slate-500 truncate">
            PPN: {formatRupiah(totalPajakPPN, false)} | PPh: {formatRupiah(totalPajakPPh22 + totalPajakPPh23, false)}
          </div>
        </div>
      </div>

      {/* Progress & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real-time Progress Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Status Progres Mingguan & Realisasi Bahan/Upah</h3>
              <p className="text-xs text-slate-500">Kwitansi material harian dan upah tergenerasi otomatis sesuai bobot</p>
            </div>
            <button
              onClick={() => onNavigateTab('progress')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              Kelola Bobot <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {progressWeeks.slice(0, 6).map((week) => (
              <div key={week.mingguKe} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Minggu {week.mingguKe}</span>
                    <span className="text-slate-500">{week.periode}</span>
                  </div>
                  <span className="text-slate-900 font-bold">Bobot: {week.bobotRealisasi}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                  <div
                    className="bg-blue-600 h-full rounded-full"
                    style={{ width: `${week.bobotRealisasi}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600">{week.keterangan}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Quick Modules & Print Shortcuts */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Modul Dokumen LPJ Resmi
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => onOpenPrintModal('COVER')}
                className="w-full text-left p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-200 flex items-center justify-between transition group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-md">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Dokumen Cover LPJ</p>
                    <p className="text-[11px] text-slate-500">Logo Tut Wuri Handayani & Kop Resmi</p>
                  </div>
                </div>
                <Printer className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>

              <button
                onClick={() => onOpenPrintModal('RPD')}
                className="w-full text-left p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-200 flex items-center justify-between transition group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-md">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Rencana Penggunaan Dana (RPD)</p>
                    <p className="text-[11px] text-slate-500">Alokasi Termin 70% & 30%</p>
                  </div>
                </div>
                <Printer className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>

              <button
                onClick={() => onOpenPrintModal('BKU')}
                className="w-full text-left p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-200 flex items-center justify-between transition group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-md">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Buku Kas Umum (BKU)</p>
                    <p className="text-[11px] text-slate-500">Bulanan & Penutupan Kas</p>
                  </div>
                </div>
                <Printer className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>

              <button
                onClick={() => onOpenPrintModal('PAJAK')}
                className="w-full text-left p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-200 flex items-center justify-between transition group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-md">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Rekapitulasi Pajak</p>
                    <p className="text-[11px] text-slate-500">PPN 11%, PPh 22, PPh 23</p>
                  </div>
                </div>
                <Printer className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>

              <button
                onClick={() => onOpenPrintModal('UPAH')}
                className="w-full text-left p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-200 flex items-center justify-between transition group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-md">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Daftar Upah Kerja Harian</p>
                    <p className="text-[11px] text-slate-500">14 Minggu Absensi & HOK</p>
                  </div>
                </div>
                <Printer className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-900">
            <p className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600" /> Terintegrasi Otomatis
            </p>
            <p className="mt-1 text-[11px] text-blue-700 leading-relaxed">
              Setiap perubahan RPD atau bobot mingguan langsung menyinkronkan BKU, BKT, BKB, Kwitansi, SPB, Bon Toko, dan Pajak.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
