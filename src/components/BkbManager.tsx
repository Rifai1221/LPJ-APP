import React, { useState } from 'react';
import {
  CreditCard,
  Printer,
  Calendar,
  Search,
  Plus,
} from 'lucide-react';
import { BkbTransaction, SchoolMasterData } from '../types';
import { formatRupiah } from '../utils/formatters';
import { getAvailableMonthsForSchool } from '../utils/monthHelper';

interface BkbManagerProps {
  bkbList: BkbTransaction[];
  school: SchoolMasterData;
  onOpenPrintModal: (period?: string) => void;
  onAddBkbRecord?: (record: BkbTransaction) => void;
}

export const BkbManager: React.FC<BkbManagerProps> = ({
  bkbList,
  school,
  onOpenPrintModal,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const months = getAvailableMonthsForSchool(school, [bkbList]);

  // Calculate running bank balance
  let currentSaldo = 0;
  const computedList = bkbList.map((tx) => {
    currentSaldo = currentSaldo + tx.penerimaan - tx.pengeluaran;
    return {
      ...tx,
      saldo: currentSaldo,
    };
  });

  const filtered = computedList.filter((tx) => {
    const matchPeriod = selectedPeriod === 'ALL' || tx.bulan === selectedPeriod;
    const matchSearch =
      tx.uraian.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.noBukti.toLowerCase().includes(searchQuery.toLowerCase());
    return matchPeriod && matchSearch;
  });

  const totalPenerimaan = filtered.reduce((s, t) => s + t.penerimaan, 0);
  const totalPengeluaran = filtered.reduce((s, t) => s + t.pengeluaran, 0);
  const finalSaldo = filtered[filtered.length - 1]?.saldo || 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            Buku Bank (BKB) Rekening Sekolah
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Rekening: <strong className="text-slate-800">{school.namaBank} - {school.nomorRekening}</strong> a.n. {school.namaRekening}
          </p>
        </div>

        <button
          onClick={() => onOpenPrintModal(selectedPeriod === 'ALL' ? undefined : selectedPeriod)}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Printer className="w-4 h-4 text-emerald-400" />
          <span>Cetak Buku Bank</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {months.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedPeriod === p
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p === 'ALL' ? 'Semua Periode' : p}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari transaksi bank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Debit / Penerimaan Bank</span>
          <p className="text-lg font-bold text-blue-700 mt-1">{formatRupiah(totalPenerimaan)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Kredit / Penarikan Bank</span>
          <p className="text-lg font-bold text-rose-700 mt-1">{formatRupiah(totalPengeluaran)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sisa Saldo Rekening</span>
          <p className="text-lg font-bold text-emerald-700 mt-1">{formatRupiah(finalSaldo)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-3 w-10 text-center">No</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-4">Uraian Transaksi Bank</th>
                <th className="py-2.5 px-3 text-center">No. Bukti</th>
                <th className="py-2.5 px-4 text-right text-blue-900 bg-blue-50/50">Debit / Penerimaan (Rp)</th>
                <th className="py-2.5 px-4 text-right text-rose-900 bg-rose-50/50">Kredit / Penarikan (Rp)</th>
                <th className="py-2.5 px-4 text-right font-bold">Saldo Bank (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((tx, idx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                  <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap font-mono">{tx.tanggal}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{tx.uraian}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600 bg-slate-50 rounded">
                    {tx.noBukti || '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-blue-700 bg-blue-50/30">
                    {tx.penerimaan > 0 ? formatRupiah(tx.penerimaan, false) : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-rose-700 bg-rose-50/30">
                    {tx.pengeluaran > 0 ? formatRupiah(tx.pengeluaran, false) : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                    {formatRupiah(tx.saldo || 0, false)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                <td colSpan={4} className="py-3 px-4 text-right uppercase text-xs">Jumlah Total:</td>
                <td className="py-3 px-4 text-right font-mono text-blue-900 bg-blue-100/50">
                  {formatRupiah(totalPenerimaan, false)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-rose-900 bg-rose-100/50">
                  {formatRupiah(totalPengeluaran, false)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-900">
                  {formatRupiah(finalSaldo, false)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
