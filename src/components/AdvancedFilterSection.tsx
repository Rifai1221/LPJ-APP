import React, { useState } from 'react';
import {
  Filter,
  SlidersHorizontal,
  X,
  Calendar,
  DollarSign,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { formatRupiah } from '../utils/formatters';

export interface FilterState {
  selectedMonth: string;
  searchQuery: string;
  filterType: 'ALL' | 'INCOME' | 'EXPENSE';
  startDate: string;
  endDate: string;
  minAmount: number | '';
}

export const initialFilterState: FilterState = {
  selectedMonth: 'ALL',
  searchQuery: '',
  filterType: 'ALL',
  startDate: '',
  endDate: '',
  minAmount: '',
};

interface AdvancedFilterSectionProps {
  months: string[];
  filterState: FilterState;
  onChangeFilterState: (updated: Partial<FilterState>) => void;
  onResetAll: () => void;
  searchPlaceholder?: string;
  themeColor?: 'blue' | 'emerald' | 'indigo' | 'amber';
}

export const AdvancedFilterSection: React.FC<AdvancedFilterSectionProps> = ({
  months,
  filterState,
  onChangeFilterState,
  onResetAll,
  searchPlaceholder = 'Cari transaksi / no bukti...',
  themeColor = 'blue',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Check if any filter beyond default is active
  const hasActiveFilters =
    filterState.selectedMonth !== 'ALL' ||
    filterState.searchQuery.trim() !== '' ||
    filterState.filterType !== 'ALL' ||
    filterState.startDate !== '' ||
    filterState.endDate !== '' ||
    filterState.minAmount !== '';

  const activeCount = [
    filterState.selectedMonth !== 'ALL',
    filterState.searchQuery.trim() !== '',
    filterState.filterType !== 'ALL',
    filterState.startDate !== '' || filterState.endDate !== '',
    filterState.minAmount !== '',
  ].filter(Boolean).length;

  const colorClasses = {
    blue: {
      bgActive: 'bg-blue-600 text-white',
      borderActive: 'border-blue-500',
      textAccent: 'text-blue-600',
      bgLight: 'bg-blue-50 text-blue-700 border-blue-200',
      ring: 'focus:ring-blue-500',
    },
    emerald: {
      bgActive: 'bg-emerald-600 text-white',
      borderActive: 'border-emerald-500',
      textAccent: 'text-emerald-600',
      bgLight: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      ring: 'focus:ring-emerald-500',
    },
    indigo: {
      bgActive: 'bg-indigo-600 text-white',
      borderActive: 'border-indigo-500',
      textAccent: 'text-indigo-600',
      bgLight: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      ring: 'focus:ring-indigo-500',
    },
    amber: {
      bgActive: 'bg-amber-600 text-white',
      borderActive: 'border-amber-500',
      textAccent: 'text-amber-600',
      bgLight: 'bg-amber-50 text-amber-700 border-amber-200',
      ring: 'focus:ring-amber-500',
    },
  }[themeColor];

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
      {/* Top Bar: Month Tabs, Add Filter Button & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => onChangeFilterState({ selectedMonth: m })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                filterState.selectedMonth === m
                  ? `${colorClasses.bgActive} shadow-xs font-semibold`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m === 'ALL' ? 'Semua Bulan (Keseluruhan)' : m}
            </button>
          ))}

          {/* "+ Tambah Filter" Toggle Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border shadow-xs ${
              isOpen || activeCount > 0
                ? `${colorClasses.bgLight} font-semibold`
                : 'bg-slate-800 text-white hover:bg-slate-900 border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>+ Tambah Filter</span>
            {activeCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-extrabold">
                {activeCount}
              </span>
            )}
            {isOpen ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
          </button>

          {/* Reset All Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={onResetAll}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer shadow-xs ml-1"
              title="Hapus / Reset Seluruh Filter"
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
            placeholder={searchPlaceholder}
            value={filterState.searchQuery}
            onChange={(e) => onChangeFilterState({ searchQuery: e.target.value })}
            className={`w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 ${colorClasses.ring}`}
          />
        </div>
      </div>

      {/* Expandable Advanced Filter Panel */}
      {isOpen && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Filter className={`w-4 h-4 ${colorClasses.textAccent}`} />
              Panel Filter Kustom Terintegrasi
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* 1. Tipe Transaksi */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Jenis Transaksi</label>
              <div className="flex rounded-lg overflow-hidden border border-slate-200 bg-white p-0.5">
                {[
                  { id: 'ALL', label: 'Semua' },
                  { id: 'INCOME', label: 'Penerimaan (+)' },
                  { id: 'EXPENSE', label: 'Pengeluaran (-)' },
                ].map((typeItem) => (
                  <button
                    key={typeItem.id}
                    onClick={() => onChangeFilterState({ filterType: typeItem.id as any })}
                    className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-md transition cursor-pointer ${
                      filterState.filterType === typeItem.id
                        ? `${colorClasses.bgActive} shadow-xs`
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {typeItem.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Rentang Tanggal Manual */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Rentang Tanggal Manual
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="date"
                    value={filterState.startDate}
                    onChange={(e) => onChangeFilterState({ startDate: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Tanggal Mulai</span>
                </div>
                <div>
                  <input
                    type="date"
                    value={filterState.endDate}
                    onChange={(e) => onChangeFilterState({ endDate: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Tanggal Selesai</span>
                </div>
              </div>
            </div>

            {/* 3. Minimal Nominal Transaksi */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                Minimal Nominal Transaksi (Rp)
              </label>
              <div className="space-y-1.5">
                <input
                  type="number"
                  placeholder="Contoh: 2000000"
                  value={filterState.minAmount}
                  onChange={(e) =>
                    onChangeFilterState({ minAmount: e.target.value ? Number(e.target.value) : '' })
                  }
                  className="w-full px-3 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeFilterState({ minAmount: 2000000 })}
                    className="px-2 py-0.5 text-[10px] bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-600 font-semibold cursor-pointer"
                  >
                    ≥ Rp 2 Jt (Pajak PPN)
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeFilterState({ minAmount: 10000000 })}
                    className="px-2 py-0.5 text-[10px] bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-600 font-semibold cursor-pointer"
                  >
                    ≥ Rp 10 Jt (Termin)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-[11px]">
          <span className="text-slate-400 font-medium mr-1">Filter Aktif:</span>

          {filterState.selectedMonth !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              Bulan: {filterState.selectedMonth}
              <button
                onClick={() => onChangeFilterState({ selectedMonth: 'ALL' })}
                className="hover:text-blue-900 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filterState.filterType !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
              Tipe: {filterState.filterType === 'INCOME' ? 'Penerimaan' : 'Pengeluaran'}
              <button
                onClick={() => onChangeFilterState({ filterType: 'ALL' })}
                className="hover:text-indigo-900 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {(filterState.startDate || filterState.endDate) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
              Tanggal: {filterState.startDate || 'Awal'} s.d. {filterState.endDate || 'Akhir'}
              <button
                onClick={() => onChangeFilterState({ startDate: '', endDate: '' })}
                className="hover:text-emerald-900 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filterState.minAmount !== '' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200">
              Minimal: {formatRupiah(Number(filterState.minAmount))}
              <button
                onClick={() => onChangeFilterState({ minAmount: '' })}
                className="hover:text-amber-900 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filterState.searchQuery.trim() !== '' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-200">
              Kata Kunci: "{filterState.searchQuery}"
              <button
                onClick={() => onChangeFilterState({ searchQuery: '' })}
                className="hover:text-purple-900 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
