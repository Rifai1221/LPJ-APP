import React, { useState } from 'react';
import {
  FileCheck2,
  Printer,
  Calendar,
  Search,
  CheckCircle,
  X,
} from 'lucide-react';
import { TaxRecord, SchoolMasterData } from '../types';
import { formatRupiah } from '../utils/formatters';
import { getAvailableMonthsForSchool } from '../utils/monthHelper';

interface TaxManagerProps {
  taxRecords: TaxRecord[];
  school: SchoolMasterData;
  onOpenPrintModal: (month?: string) => void;
}

export const TaxManager: React.FC<TaxManagerProps> = ({
  taxRecords,
  school,
  onOpenPrintModal,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const months = getAvailableMonthsForSchool(school, [taxRecords]);
  const activeSelectedMonth = (selectedMonth === 'ALL' || months.includes(selectedMonth)) ? selectedMonth : 'ALL';

  const filtered = taxRecords.filter((t) => {
    const matchMonth = activeSelectedMonth === 'ALL' || t.bulan === activeSelectedMonth;
    const matchSearch =
      t.keperluan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.noBukti.toLowerCase().includes(searchQuery.toLowerCase());
    return matchMonth && matchSearch;
  });

  const totalKonstruksi = filtered.reduce((s, t) => s + t.nominalKonstruksi, 0);
  const totalPerabot = filtered.reduce((s, t) => s + t.nominalPerabot, 0);
  const totalPeralatan = filtered.reduce((s, t) => s + t.nominalPeralatan, 0);
  const totalKonsultan = filtered.reduce((s, t) => s + t.nominalKonsultanAdm, 0);
  const totalPPN = filtered.reduce((s, t) => s + t.ppn11, 0);
  const totalPPh22 = filtered.reduce((s, t) => s + t.pph22, 0);
  const totalPPh23 = filtered.reduce((s, t) => s + t.pph23, 0);
  const totalPajakKeseluruhan = totalPPN + totalPPh22 + totalPPh23;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-amber-600" />
            Rekapitulasi Penerimaan & Penyetoran Pajak (PPN, PPh 22, PPh 23)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Laporan pemotongan dan penyetoran pajak pertanggungjawaban kegiatan revitalisasi sesuai regulasi perpajakan yang berlaku.
          </p>
        </div>

        <button
          onClick={() => onOpenPrintModal(selectedMonth === 'ALL' ? undefined : selectedMonth)}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Printer className="w-4 h-4 text-emerald-400" />
          <span>Cetak Rekap Pajak {selectedMonth !== 'ALL' ? selectedMonth : 'Total'}</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedMonth === m
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m === 'ALL' ? 'Semua Bulan (Rekap Akumulatif)' : m}
            </button>
          ))}

          {(selectedMonth !== 'ALL' || searchQuery !== '') && (
            <button
              onClick={() => {
                setSelectedMonth('ALL');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer shadow-xs ml-1"
              title="Hapus Filter Bulan & Pencarian"
            >
              <X className="w-3.5 h-3.5 text-rose-600" />
              <span>Hapus Filter</span>
            </button>
          )}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari transaksi pajak..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* KPI Tax */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">PPN 11% (Barang)</span>
          <p className="text-lg font-bold text-amber-700 mt-1">{formatRupiah(totalPPN)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">PPh Ps 22 (1.5%)</span>
          <p className="text-lg font-bold text-blue-700 mt-1">{formatRupiah(totalPPh22)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">PPh 23 (Konsultan/Adm)</span>
          <p className="text-lg font-bold text-indigo-700 mt-1">{formatRupiah(totalPPh23)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Pajak Disetor</span>
          <p className="text-lg font-bold text-emerald-700 mt-1">{formatRupiah(totalPajakKeseluruhan)}</p>
        </div>
      </div>

      {/* Tax Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white uppercase text-[10px] tracking-wider border-b border-slate-700 text-center">
                <th rowSpan={2} className="py-2.5 px-2 w-8">No</th>
                <th colSpan={2} className="py-2 px-3 border-b border-slate-700">Kwitansi</th>
                <th rowSpan={2} className="py-2.5 px-4 text-left">Keperluan Pembayaran</th>
                <th colSpan={4} className="py-2 px-3 border-b border-slate-700 bg-slate-850">Nilai Nominal (Rp)</th>
                <th colSpan={3} className="py-2 px-3 border-b border-slate-700 bg-amber-950/60">Pajak Dipungut & Disetor (Rp)</th>
              </tr>
              <tr className="bg-slate-750 text-slate-200 text-[10px] uppercase tracking-wider border-b border-slate-700">
                <th className="py-2 px-2">No</th>
                <th className="py-2 px-2">Tanggal</th>
                <th className="py-2 px-3 text-right">Konstruksi</th>
                <th className="py-2 px-3 text-right">Perabot</th>
                <th className="py-2 px-3 text-right">Peralatan</th>
                <th className="py-2 px-3 text-right">Perencanaan/ADM</th>
                <th className="py-2 px-3 text-right text-amber-300">PPN 11%</th>
                <th className="py-2 px-3 text-right text-blue-300">PPh 22</th>
                <th className="py-2 px-3 text-right text-indigo-300">PPh 23</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t, idx) => (
                <tr key={t.id} className="hover:bg-slate-50 transition text-slate-800">
                  <td className="py-2.5 px-2 text-center text-slate-500 font-mono">{idx + 1}</td>
                  <td className="py-2.5 px-2 font-mono text-[11px] text-slate-700">{t.noBukti}</td>
                  <td className="py-2.5 px-2 font-mono text-slate-600 whitespace-nowrap">{t.tanggal}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{t.keperluan}</td>
                  
                  {/* Nominal breakdown */}
                  <td className="py-2.5 px-3 text-right font-mono">
                    {t.nominalKonstruksi > 0 ? formatRupiah(t.nominalKonstruksi, false) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {t.nominalPerabot > 0 ? formatRupiah(t.nominalPerabot, false) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {t.nominalPeralatan > 0 ? formatRupiah(t.nominalPeralatan, false) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {t.nominalKonsultanAdm > 0 ? formatRupiah(t.nominalKonsultanAdm, false) : '-'}
                  </td>

                  {/* Taxes */}
                  <td className="py-2.5 px-3 text-right font-mono text-amber-700 bg-amber-50/30">
                    {t.ppn11 > 0 ? formatRupiah(t.ppn11, false) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-blue-700 bg-blue-50/30">
                    {t.pph22 > 0 ? formatRupiah(t.pph22, false) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-indigo-700 bg-indigo-50/30">
                    {t.pph23 > 0 ? formatRupiah(t.pph23, false) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                <td colSpan={4} className="py-3 px-4 text-right uppercase text-xs">Jumlah Yang Disetor:</td>
                <td className="py-3 px-3 text-right font-mono">{formatRupiah(totalKonstruksi, false)}</td>
                <td className="py-3 px-3 text-right font-mono">{formatRupiah(totalPerabot, false)}</td>
                <td className="py-3 px-3 text-right font-mono">{formatRupiah(totalPeralatan, false)}</td>
                <td className="py-3 px-3 text-right font-mono">{formatRupiah(totalKonsultan, false)}</td>
                <td className="py-3 px-3 text-right font-mono text-amber-900 bg-amber-100/60">{formatRupiah(totalPPN, false)}</td>
                <td className="py-3 px-3 text-right font-mono text-blue-900 bg-blue-100/60">{formatRupiah(totalPPh22, false)}</td>
                <td className="py-3 px-3 text-right font-mono text-indigo-900 bg-indigo-100/60">{formatRupiah(totalPPh23, false)}</td>
              </tr>
              <tr className="bg-slate-800 text-white font-extrabold text-xs">
                <td colSpan={8} className="py-2.5 px-4 text-right uppercase">TOTAL SEMUA PAJAK (PPN + PPh 22 + PPh 23):</td>
                <td colSpan={3} className="py-2.5 px-4 text-right font-mono text-amber-300">
                  {formatRupiah(totalPajakKeseluruhan)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
