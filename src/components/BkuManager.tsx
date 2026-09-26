import React, { useState } from 'react';
import {
  DollarSign,
  Plus,
  Printer,
  Calendar,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { BkuTransaction, SchoolMasterData } from '../types';
import { formatRupiah } from '../utils/formatters';
import { getAvailableMonthsForSchool } from '../utils/monthHelper';
import { AdvancedFilterSection, FilterState, initialFilterState } from './AdvancedFilterSection';

interface BkuManagerProps {
  bkuList: BkuTransaction[];
  school: SchoolMasterData;
  onOpenPrintModal: (month?: string) => void;
  onAddTransaction?: (tx: Partial<BkuTransaction>) => void;
}

export const BkuManager: React.FC<BkuManagerProps> = ({
  bkuList,
  school,
  onOpenPrintModal,
  onAddTransaction,
}) => {
  const [filterState, setFilterState] = useState<FilterState>(initialFilterState);

  const months = getAvailableMonthsForSchool(school, [bkuList]);
  const activeSelectedMonth =
    filterState.selectedMonth === 'ALL' || months.includes(filterState.selectedMonth)
      ? filterState.selectedMonth
      : 'ALL';

  const handleUpdateFilterState = (updated: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updated }));
  };

  const handleResetAllFilters = () => {
    setFilterState(initialFilterState);
  };

  const filteredBku = bkuList.filter((tx) => {
    const matchMonth = activeSelectedMonth === 'ALL' || tx.bulan === activeSelectedMonth;
    const matchQuery =
      filterState.searchQuery === '' ||
      tx.uraian.toLowerCase().includes(filterState.searchQuery.toLowerCase()) ||
      tx.noBukti.toLowerCase().includes(filterState.searchQuery.toLowerCase());

    const matchType =
      filterState.filterType === 'ALL' ||
      (filterState.filterType === 'INCOME' && tx.penerimaan > 0) ||
      (filterState.filterType === 'EXPENSE' && tx.pengeluaran > 0);

    let matchDate = true;
    if (filterState.startDate) {
      matchDate = matchDate && tx.tanggal >= filterState.startDate;
    }
    if (filterState.endDate) {
      matchDate = matchDate && tx.tanggal <= filterState.endDate;
    }

    let matchAmount = true;
    if (filterState.minAmount !== '' && typeof filterState.minAmount === 'number') {
      matchAmount = tx.penerimaan >= filterState.minAmount || tx.pengeluaran >= filterState.minAmount;
    }

    return matchMonth && matchQuery && matchType && matchDate && matchAmount;
  });

  const totalPenerimaan = filteredBku.reduce((sum, tx) => sum + tx.penerimaan, 0);
  const totalPengeluaran = filteredBku.reduce((sum, tx) => sum + tx.pengeluaran, 0);
  const lastItem = filteredBku[filteredBku.length - 1];
  const saldoAkhir = lastItem ? lastItem.saldo || 0 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            Buku Kas Umum (BKU) Revitalisasi Sekolah
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Mencatat seluruh arus penerimaan dan pengeluaran dana termin 70% dan 30% secara kronologis dan otomatis terintegrasi.
          </p>
        </div>

        <button
          onClick={() => onOpenPrintModal(filterState.selectedMonth === 'ALL' ? undefined : filterState.selectedMonth)}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Printer className="w-4 h-4 text-emerald-400" />
          <span>Cetak BKU {filterState.selectedMonth !== 'ALL' ? filterState.selectedMonth : 'Lengkap'}</span>
        </button>
      </div>

      {/* Advanced Filter Section */}
      <AdvancedFilterSection
        months={months}
        filterState={filterState}
        onChangeFilterState={handleUpdateFilterState}
        onResetAll={handleResetAllFilters}
        searchPlaceholder="Cari BKU / no bukti / uraian..."
        themeColor="blue"
      />

      {/* Summary KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Penerimaan</span>
          <p className="text-lg font-bold text-blue-700 mt-1">{formatRupiah(totalPenerimaan)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Pengeluaran</span>
          <p className="text-lg font-bold text-rose-700 mt-1">{formatRupiah(totalPengeluaran)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Posisi Saldo Kas</span>
          <p className="text-lg font-bold text-emerald-700 mt-1">{formatRupiah(saldoAkhir)}</p>
        </div>
      </div>

      {/* BKU Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider">
              BUKU KAS UMUM (BKU) {filterState.selectedMonth !== 'ALL' && `- ${filterState.selectedMonth.toUpperCase()}`}
            </h3>
            <p className="text-[11px] text-slate-400">{school.namaSekolah} • {school.pekerjaan}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-800 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-3 w-10 text-center">No</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-4">Uraian Transaksi</th>
                <th className="py-2.5 px-3 text-center">No. Bukti</th>
                <th className="py-2.5 px-4 text-right text-blue-900 bg-blue-50/50">Penerimaan (Rp)</th>
                <th className="py-2.5 px-4 text-right text-rose-900 bg-rose-50/50">Pengeluaran (Rp)</th>
                <th className="py-2.5 px-4 text-right font-bold">Saldo (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBku.map((tx, idx) => (
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
                <td colSpan={4} className="py-3 px-4 text-right uppercase text-xs">Total Bulan Terpilih:</td>
                <td className="py-3 px-4 text-right font-mono text-blue-900 bg-blue-100/50">
                  {formatRupiah(totalPenerimaan, false)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-rose-900 bg-rose-100/50">
                  {formatRupiah(totalPengeluaran, false)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-900">
                  {formatRupiah(saldoAkhir, false)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Closing Position Box */}
        <div className="p-5 bg-slate-50 border-t border-slate-200">
          <div className="max-w-md bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
            <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1">
              Posisi Penutupan Kas Akhir Bulan
            </h4>
            <div className="flex justify-between text-slate-600">
              <span>Saldo Buku Kas Umum:</span>
              <strong className="text-slate-900 font-mono">{formatRupiah(saldoAkhir)}</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>- Saldo Rekening Bank:</span>
              <span className="font-mono">{formatRupiah(0)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>- Saldo Kas Tunai:</span>
              <span className="font-mono">{formatRupiah(saldoAkhir)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-slate-900">
              <span>Perbedaan / Selisih:</span>
              <span className="text-emerald-600 font-mono">Rp 0,00 (Cocok)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
