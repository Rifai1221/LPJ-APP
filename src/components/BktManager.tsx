import React, { useState, useMemo } from 'react';
import { Wallet, Printer, Calendar, Search, X, Plus, Edit3, Trash2, AlertCircle } from 'lucide-react';
import { BktTransaction, BkuTransaction, SchoolMasterData, ProjectProgressWeek } from '../types';
import { formatRupiah } from '../utils/formatters';
import { getAvailableMonthsForSchool, resolveWeekDates } from '../utils/monthHelper';

interface BktManagerProps {
  bktList: BktTransaction[];
  school: SchoolMasterData;
  progressWeeks?: ProjectProgressWeek[];
  onOpenPrintModal: (month?: string) => void;
  onAddTransaction?: (tx: Omit<BkuTransaction, 'id'>) => void;
  onUpdateTransaction?: (tx: BkuTransaction) => void;
  onDeleteTransaction?: (tx: BkuTransaction) => void;
}

export const BktManager: React.FC<BktManagerProps> = ({
  bktList,
  school,
  progressWeeks,
  onOpenPrintModal,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states for manual input & editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<BktTransaction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Determine starting date strictly from Laporan Mingguan & Bobot
  const schoolYear = school?.tahunAnggaran?.trim() || '2026';
  const minStartDateInfo = useMemo(() => {
    if (progressWeeks && progressWeeks.length > 0) {
      const w1 = progressWeeks.find((w) => w.mingguKe === 1) || progressWeeks[0];
      return resolveWeekDates(w1, schoolYear);
    }
    return {
      startDate: `${schoolYear}-07-01`,
      startDateFormatted: `01 Juli ${schoolYear}`,
      startDateSlash: `01/07/${schoolYear}`,
    };
  }, [progressWeeks, schoolYear]);

  // Form states
  const [formData, setFormData] = useState({
    tanggal: minStartDateInfo.startDate,
    jenis: 'PENGELUARAN' as 'PENERIMAAN' | 'PENGELUARAN',
    uraian: '',
    noBukti: '',
    nominal: 0,
    kategoriBiaya: 'Konstruksi',
  });

  const months = getAvailableMonthsForSchool(school, [bktList]);
  const activeSelectedMonth = (selectedMonth === 'ALL' || months.includes(selectedMonth)) ? selectedMonth : 'ALL';

  const filteredBkt = bktList.filter((tx) => {
    const matchMonth = activeSelectedMonth === 'ALL' || tx.bulan === activeSelectedMonth;
    const matchQuery =
      tx.uraian.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.noBukti.toLowerCase().includes(searchQuery.toLowerCase());
    return matchMonth && matchQuery;
  });

  const totalDebet = filteredBkt.reduce((sum, tx) => sum + tx.pemasukan, 0);
  const totalKredit = filteredBkt.reduce((sum, tx) => sum + tx.pengeluaran, 0);
  const lastItem = filteredBkt[filteredBkt.length - 1];
  const saldoAkhir = lastItem ? lastItem.saldo || 0 : 0;

  // Handlers
  const handleOpenAdd = () => {
    setEditingTx(null);
    setFormError(null);
    setFormData({
      tanggal: minStartDateInfo.startDate,
      jenis: 'PENGELUARAN',
      uraian: '',
      noBukti: `BKT-${String(bktList.length + 1).padStart(2, '0')}/${schoolYear}`,
      nominal: 0,
      kategoriBiaya: 'Konstruksi',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tx: BktTransaction) => {
    setEditingTx(tx);
    setFormError(null);

    let dateInput = minStartDateInfo.startDate;
    if (tx.tanggalObj && tx.tanggalObj.includes('-')) {
      dateInput = tx.tanggalObj;
    } else if (tx.tanggal.includes('/')) {
      const [d, m, y] = tx.tanggal.split('/');
      dateInput = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    setFormData({
      tanggal: dateInput,
      jenis: tx.pemasukan > 0 ? 'PENERIMAAN' : 'PENGELUARAN',
      uraian: tx.uraian,
      noBukti: tx.noBukti === '-' ? '' : tx.noBukti,
      nominal: tx.pemasukan > 0 ? tx.pemasukan : tx.pengeluaran,
      kategoriBiaya: 'Konstruksi',
    });
    setIsModalOpen(true);
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.uraian.trim()) {
      setFormError('Uraian transaksi tidak boleh kosong.');
      return;
    }

    if (!formData.nominal || formData.nominal <= 0) {
      setFormError('Nominal transaksi harus lebih dari Rp 0.');
      return;
    }

    // Tanggal mulai pencatatan jangan kurang dari tanggal yang di-input dari Laporan Mingguan & Bobot
    if (formData.tanggal < minStartDateInfo.startDate) {
      setFormError(
        `Tanggal transaksi kas (${formData.tanggal}) tidak boleh kurang dari tanggal mulai Laporan Mingguan & Bobot (${minStartDateInfo.startDateFormatted}).`
      );
      return;
    }

    const [y, m, d] = formData.tanggal.split('-');
    const indMonths = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const bulanStr = `${indMonths[parseInt(m, 10) - 1]} ${y}`;
    const displayTanggal = `${d}/${m}/${y}`;

    if (editingTx) {
      if (onUpdateTransaction) {
        // Find underlying BKU ID (bkt- id format is `bkt-${bkuId}`)
        const underlyingBkuId = editingTx.id.startsWith('bkt-') ? editingTx.id.replace('bkt-', '') : editingTx.id;
        onUpdateTransaction({
          id: underlyingBkuId,
          tanggal: displayTanggal,
          tanggalObj: formData.tanggal,
          bulan: bulanStr,
          jenis: formData.jenis,
          uraian: formData.uraian.trim(),
          noBukti: formData.noBukti.trim() || '-',
          penerimaan: formData.jenis === 'PENERIMAAN' ? formData.nominal : 0,
          pengeluaran: formData.jenis === 'PENGELUARAN' ? formData.nominal : 0,
          kategoriBiaya: formData.kategoriBiaya,
        });
      }
    } else {
      if (onAddTransaction) {
        onAddTransaction({
          tanggal: displayTanggal,
          tanggalObj: formData.tanggal,
          bulan: bulanStr,
          jenis: formData.jenis,
          uraian: formData.uraian.trim(),
          noBukti: formData.noBukti.trim() || '-',
          penerimaan: formData.jenis === 'PENERIMAAN' ? formData.nominal : 0,
          pengeluaran: formData.jenis === 'PENGELUARAN' ? formData.nominal : 0,
          kategoriBiaya: formData.kategoriBiaya,
        });
      }
    }

    setIsModalOpen(false);
  };

  const handleDelete = (tx: BktTransaction) => {
    const nominalStr = formatRupiah(tx.pemasukan > 0 ? tx.pemasukan : tx.pengeluaran);
    if (
      confirm(
        `Apakah Anda yakin ingin MENGHAPUS transaksi ini dari Buku Kas Tunai & BKU?\n\nTanggal: ${tx.tanggal}\nUraian: "${tx.uraian}"\nNominal: ${nominalStr}`
      )
    ) {
      if (onDeleteTransaction) {
        const underlyingBkuId = tx.id.startsWith('bkt-') ? tx.id.replace('bkt-', '') : tx.id;
        onDeleteTransaction({
          id: underlyingBkuId,
          tanggal: tx.tanggal,
          tanggalObj: tx.tanggalObj,
          bulan: tx.bulan,
          jenis: tx.pemasukan > 0 ? 'PENERIMAAN' : 'PENGELUARAN',
          uraian: tx.uraian,
          noBukti: tx.noBukti,
          penerimaan: tx.pemasukan,
          pengeluaran: tx.pengeluaran,
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            Buku Pembantu Kas Tunai (BKT)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Mencatat transaksi fisik kas tunai operasional harian sekolah setelah penarikan dari bank.
          </p>
        </div>

        <button
          onClick={() => onOpenPrintModal(selectedMonth === 'ALL' ? undefined : selectedMonth)}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Printer className="w-4 h-4 text-emerald-400" />
          <span>Cetak BKT {selectedMonth !== 'ALL' ? selectedMonth : 'Lengkap'}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari transaksi kas tunai..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        {searchQuery !== '' && (
          <button
            onClick={() => setSearchQuery('')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer shadow-xs"
            title="Bersihkan Pencarian"
          >
            <X className="w-3.5 h-3.5 text-rose-600" />
            <span>Bersihkan</span>
          </button>
        )}
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Debet / Pemasukan Tunai</span>
          <p className="text-lg font-bold text-blue-700 mt-1">{formatRupiah(totalDebet)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Kredit / Pengeluaran Tunai</span>
          <p className="text-lg font-bold text-rose-700 mt-1">{formatRupiah(totalKredit)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Saldo Kas Tunai</span>
          <p className="text-lg font-bold text-emerald-700 mt-1">{formatRupiah(saldoAkhir)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider">
              BUKU PEMBANTU KAS TUNAI (BKT) {selectedMonth !== 'ALL' && `- ${selectedMonth.toUpperCase()}`}
            </h3>
            <p className="text-[11px] text-slate-400">{school.namaSekolah} • {school.pekerjaan}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Input Transaksi Kas Tunai</span>
            </button>
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
                <th className="py-2.5 px-4 text-right text-blue-900 bg-blue-50/50">Debet / Pemasukan (Rp)</th>
                <th className="py-2.5 px-4 text-right text-rose-900 bg-rose-50/50">Kredit / Pengeluaran (Rp)</th>
                <th className="py-2.5 px-4 text-right font-bold">Saldo (Rp)</th>
                <th className="py-2.5 px-3 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBkt.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Tidak ada transaksi Kas Tunai pada filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredBkt.map((tx, idx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap font-mono">{tx.tanggal}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{tx.uraian}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600 bg-slate-50 rounded">
                      {tx.noBukti || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-blue-700 bg-blue-50/30">
                      {tx.pemasukan > 0 ? formatRupiah(tx.pemasukan, false) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-rose-700 bg-rose-50/30">
                      {tx.pengeluaran > 0 ? formatRupiah(tx.pengeluaran, false) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(tx.saldo || 0, false)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tx)}
                          className="p-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-900 border border-amber-200 transition cursor-pointer"
                          title="Edit Transaksi Kas Tunai"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(tx)}
                          className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 border border-rose-200 transition cursor-pointer"
                          title="Hapus Transaksi Kas Tunai"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                <td colSpan={4} className="py-3 px-4 text-right uppercase text-xs">Jumlah Total:</td>
                <td className="py-3 px-4 text-right font-mono text-blue-900 bg-blue-100/50">
                  {formatRupiah(totalDebet, false)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-rose-900 bg-rose-100/50">
                  {formatRupiah(totalKredit, false)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-900">
                  {formatRupiah(saldoAkhir, false)}
                </td>
                <td className="py-3 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal for Input Manual & Edit Transaksi Kas Tunai */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <span>{editingTx ? 'Edit Transaksi Kas Tunai' : 'Input Transaksi Kas Tunai Manual'}</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Buku Pembantu Kas Tunai (BKT) • {school.namaSekolah}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Tanggal Constraint Info Banner */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Aturan Tanggal Sesuai Juknis DAK:</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Tanggal mulai pencatatan tidak boleh kurang dari tanggal awal Laporan Mingguan & Bobot (minimal: <strong>{minStartDateInfo.startDateFormatted}</strong>).
                </p>
              </div>

              {/* Jenis Transaksi Kas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Jenis Transaksi Kas:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, jenis: 'PENERIMAAN' })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      formData.jenis === 'PENERIMAAN'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Debet (Penerimaan Tunai)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, jenis: 'PENGELUARAN' })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      formData.jenis === 'PENGELUARAN'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>Kredit (Pengeluaran Tunai)</span>
                  </button>
                </div>
              </div>

              {/* Tanggal & No Bukti */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Transaksi <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="date"
                    min={minStartDateInfo.startDate}
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor Bukti:
                  </label>
                  <input
                    type="text"
                    placeholder="misal: 01/1MD/2026 atau BKT-01"
                    value={formData.noBukti}
                    onChange={(e) => setFormData({ ...formData, noBukti: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Uraian Transaksi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Uraian Transaksi <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  rows={2}
                  placeholder="misal: Pembayaran Upah Pekerja & Tukang, Pembelian Pasir & Semen"
                  value={formData.uraian}
                  onChange={(e) => setFormData({ ...formData, uraian: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              {/* Nominal Transaksi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nominal Transaksi (Rp) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={formData.nominal || ''}
                  onChange={(e) => setFormData({ ...formData, nominal: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                  required
                />
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  Terbilang format rupiah: <strong className="text-emerald-700">{formatRupiah(formData.nominal)}</strong>
                </p>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer"
                >
                  {editingTx ? 'Simpan Perubahan' : 'Simpan Transaksi Kas Tunai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

