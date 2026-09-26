import React, { useState } from 'react';
import {
  Users,
  Printer,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  UserPlus,
  DollarSign,
  X,
  Sparkles,
} from 'lucide-react';
import { WeeklyWageReport, WorkerItem, SchoolMasterData } from '../types';
import { formatRupiah, formatNumber } from '../utils/formatters';

interface WageManagerProps {
  wageReports: WeeklyWageReport[];
  workers: WorkerItem[];
  school: SchoolMasterData;
  onUpdateWageReports: (reports: WeeklyWageReport[]) => void;
  onUpdateWorkers: (workers: WorkerItem[]) => void;
  onOpenPrintModal: (weekNum?: number) => void;
}

export const WageManager: React.FC<WageManagerProps> = ({
  wageReports,
  workers,
  school,
  onUpdateWageReports,
  onUpdateWorkers,
  onOpenPrintModal,
}) => {
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);
  const [isAddingWorker, setIsAddingWorker] = useState(false);
  const [roleOption, setRoleOption] = useState<'KT' | 'T' | 'P' | 'CUSTOM'>('P');
  const [customRoleName, setCustomRoleName] = useState('');
  const [newWorker, setNewWorker] = useState<Partial<WorkerItem>>({
    nama: '',
    jenisKelamin: 'L',
    domisili: 'Dalam Desa',
    peran: 'P',
    peranLabel: 'Pekerja',
    upahHarian: 120000,
  });

  const activeReport =
    wageReports.find((r) => r.mingguKe === selectedWeekNum) || wageReports[0];

  const handleToggleDay = (workerId: string, dayIndex: number) => {
    const updatedReports = wageReports.map((rep) => {
      if (rep.mingguKe === selectedWeekNum) {
        const updatedAttendance = rep.attendance.map((att) => {
          if (att.workerId === workerId) {
            const newDays = [...att.days] as [number, number, number, number, number, number, number];
            newDays[dayIndex] = newDays[dayIndex] === 1 ? 0 : 1;
            const newHok = newDays.reduce((a, b) => a + b, 0);
            return {
              ...att,
              days: newDays,
              hok: newHok,
              totalUpah: newHok * att.upahHarian,
            };
          }
          return att;
        });

        const total = updatedAttendance.reduce((sum, a) => sum + a.totalUpah, 0);
        return {
          ...rep,
          attendance: updatedAttendance,
          totalUpah: total,
        };
      }
      return rep;
    });

    onUpdateWageReports(updatedReports);
  };

  const handleDeleteWorker = (workerId: string, workerName: string) => {
    if (confirm(`Hapus pekerja "${workerName}" dari daftar master dan seluruh laporan absensi mingguan?`)) {
      onUpdateWorkers(workers.filter((w) => w.id !== workerId));
      const updatedReports = wageReports.map((rep) => {
        const filteredAtt = rep.attendance.filter((a) => a.workerId !== workerId);
        return {
          ...rep,
          attendance: filteredAtt,
          totalUpah: filteredAtt.reduce((sum, a) => sum + a.totalUpah, 0),
        };
      });
      onUpdateWageReports(updatedReports);
    }
  };

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorker.nama) return;

    let roleCode = roleOption;
    let roleLabel = 'Pekerja';

    if (roleOption === 'KT') {
      roleLabel = 'Kepala Tukang';
    } else if (roleOption === 'T') {
      roleLabel = 'Tukang';
    } else if (roleOption === 'P') {
      roleLabel = 'Pekerja';
    } else {
      roleCode = (customRoleName.trim().toUpperCase() || 'CUSTOM') as any;
      roleLabel = customRoleName.trim() || 'Tenaga Ahli/Khusus';
    }

    const createdWorker: WorkerItem = {
      id: `w-${Date.now()}`,
      nama: newWorker.nama.trim(),
      jenisKelamin: newWorker.jenisKelamin || 'L',
      domisili: newWorker.domisili || 'Dalam Desa',
      peran: roleCode,
      peranLabel: roleLabel,
      upahHarian: Number(newWorker.upahHarian) || 120000,
    };

    const newWorkerList = [...workers, createdWorker];
    onUpdateWorkers(newWorkerList);

    // Add to all wage reports
    const updatedReports = wageReports.map((rep) => ({
      ...rep,
      attendance: [
        ...rep.attendance,
        {
          workerId: createdWorker.id,
          nama: createdWorker.nama,
          jenisKelamin: createdWorker.jenisKelamin,
          domisili: createdWorker.domisili,
          peran: createdWorker.peran,
          peranLabel: createdWorker.peranLabel,
          days: [1, 1, 1, 1, 0, 1, 1] as [number, number, number, number, number, number, number],
          hok: 6,
          upahHarian: createdWorker.upahHarian,
          totalUpah: 6 * createdWorker.upahHarian,
        },
      ],
    }));

    onUpdateWageReports(updatedReports);
    setIsAddingWorker(false);
    setRoleOption('P');
    setCustomRoleName('');
    setNewWorker({
      nama: '',
      jenisKelamin: 'L',
      domisili: 'Dalam Desa',
      peran: 'P',
      peranLabel: 'Pekerja',
      upahHarian: 120000,
    });
  };

  const totalAllWages = wageReports.reduce((s, r) => s + r.totalUpah, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Daftar Pembayaran Upah Harian Tenaga Kerja (HOK)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Format absensi harian 7 hari kerja, perhitungan HOK Kepala Tukang (Rp 200rb), Tukang (Rp 150rb), dan Pekerja (Rp 120rb).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingWorker(true)}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pekerja</span>
          </button>
          <button
            onClick={() => onOpenPrintModal(selectedWeekNum)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Cetak Upah Minggu {selectedWeekNum}</span>
          </button>
        </div>
      </div>

      {/* Week Selector Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pilih Minggu Kerja:</span>
        <div className="flex flex-wrap gap-1.5">
          {wageReports.map((w) => (
            <button
              key={w.mingguKe}
              onClick={() => setSelectedWeekNum(w.mingguKe)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedWeekNum === w.mingguKe
                  ? 'bg-purple-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Minggu {w.mingguKe}
            </button>
          ))}
        </div>
      </div>

      {/* Week Summary Banner */}
      {activeReport && (
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-5 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-purple-200">
              <Calendar className="w-4 h-4" />
              <span>Periode: {activeReport.periodeStart} s/d {activeReport.periodeEnd}</span>
              <span>•</span>
              <span className="font-mono bg-purple-800/80 px-2 py-0.5 rounded">No. Kwitansi: {activeReport.noBuktiKwitansi}</span>
            </div>
            <h3 className="text-xl font-bold mt-1">Daftar Upah Kerja Minggu Ke-{activeReport.mingguKe}</h3>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-purple-200 uppercase font-semibold">Total Upah Terbayar Minggu Ini</span>
            <p className="text-2xl font-black text-amber-300 font-mono">{formatRupiah(activeReport.totalUpah)}</p>
          </div>
        </div>
      )}

      {/* Add Worker Form */}
      {isAddingWorker && (
        <form onSubmit={handleAddWorker} className="bg-purple-50 p-4 rounded-xl border border-purple-200 shadow-xs space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-purple-200 pb-2">
            <h3 className="text-xs font-bold text-purple-900 uppercase flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-purple-700" />
              <span>Tambah Data Pekerja Baru</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingWorker(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
              <input
                type="text"
                value={newWorker.nama}
                onChange={(e) => setNewWorker({ ...newWorker, nama: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
                placeholder="Nama pekerja"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Jenis / Kategori Pekerja</label>
              <select
                value={roleOption}
                onChange={(e: any) => {
                  const val = e.target.value as 'KT' | 'T' | 'P' | 'CUSTOM';
                  setRoleOption(val);
                  let upah = 120000;
                  if (val === 'KT') upah = 200000;
                  else if (val === 'T') upah = 150000;
                  else if (val === 'P') upah = 120000;
                  else upah = 135000;
                  setNewWorker((prev) => ({ ...prev, upahHarian: upah }));
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="KT">Kepala Tukang (KT) - Standar Rp 200.000</option>
                <option value="T">Tukang (T) - Standar Rp 150.000</option>
                <option value="P">Pekerja (P) - Standar Rp 120.000</option>
                <option value="CUSTOM">+ Jenis / Spesialisasi Lain (Kustom)</option>
              </select>
            </div>

            {roleOption === 'CUSTOM' ? (
              <div>
                <label className="block text-[11px] font-semibold text-purple-800 mb-1">
                  Nama Jenis Pekerja Kustom *
                </label>
                <input
                  type="text"
                  required
                  value={customRoleName}
                  onChange={(e) => setCustomRoleName(e.target.value)}
                  placeholder="Misal: Tukang Las / Mandor / Supir"
                  className="w-full px-2.5 py-1.5 text-xs border border-purple-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tempat Tinggal</label>
                <select
                  value={newWorker.domisili}
                  onChange={(e) => setNewWorker({ ...newWorker, domisili: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="Dalam Desa">Dalam Desa</option>
                  <option value="Luar Desa">Luar Desa</option>
                </select>
              </div>
            )}

            {roleOption === 'CUSTOM' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tempat Tinggal</label>
                <select
                  value={newWorker.domisili}
                  onChange={(e) => setNewWorker({ ...newWorker, domisili: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="Dalam Desa">Dalam Desa</option>
                  <option value="Luar Desa">Luar Desa</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Upah Harian (Rp)</label>
              <input
                type="number"
                value={newWorker.upahHarian}
                onChange={(e) => setNewWorker({ ...newWorker, upahHarian: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs cursor-pointer shadow-xs"
              >
                Simpan Pekerja
              </button>
              <button
                type="button"
                onClick={() => setIsAddingWorker(false)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-300 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Attendance & Wage Table */}
      {activeReport && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white uppercase text-[10px] tracking-wider border-b border-slate-700 text-center">
                  <th rowSpan={2} className="py-2.5 px-2 w-8">No</th>
                  <th rowSpan={2} className="py-2.5 px-3 text-left">Nama Tenaga Kerja</th>
                  <th rowSpan={2} className="py-2.5 px-2 w-8">L/P</th>
                  <th rowSpan={2} className="py-2.5 px-2">Domisili</th>
                  <th rowSpan={2} className="py-2.5 px-2">Jabatan</th>
                  <th colSpan={7} className="py-1.5 px-2 border-b border-slate-700">Hari Kerja (Klik untuk ubah)</th>
                  <th rowSpan={2} className="py-2.5 px-3 text-right">Jumlah HOK</th>
                  <th rowSpan={2} className="py-2.5 px-3 text-right">Harga Upah (Rp)</th>
                  <th rowSpan={2} className="py-2.5 px-4 text-right bg-purple-900/50">Total Upah (Rp)</th>
                  <th rowSpan={2} className="py-2.5 px-3 text-center">Tanda Tangan</th>
                  <th rowSpan={2} className="py-2.5 px-2 text-center w-10">Aksi</th>
                </tr>
                <tr className="bg-slate-700 text-slate-200 text-[10px] border-b border-slate-600">
                  {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day, dIdx) => (
                    <th key={dIdx} className="py-1 px-2 w-8 text-center">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeReport.attendance.map((att, idx) => (
                  <tr key={att.workerId} className="hover:bg-purple-50/40 transition">
                    <td className="py-2 px-2 text-center text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      <div>{att.nama}</div>
                      {att.peranLabel && att.peranLabel !== att.peran && (
                        <div className="text-[10px] text-purple-700 font-normal">{att.peranLabel}</div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-500">{att.jenisKelamin}</td>
                    <td className="py-2 px-2 text-center text-slate-600 text-[10px]">{att.domisili}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        att.peran === 'KT' ? 'bg-rose-100 text-rose-800' :
                        att.peran === 'T' ? 'bg-amber-100 text-amber-800' :
                        att.peran === 'P' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {att.peran}
                      </span>
                    </td>

                    {/* 7 Days Attendance Checkboxes */}
                    {att.days.map((isPresent, dIdx) => (
                      <td key={dIdx} className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleDay(att.workerId, dIdx)}
                          className={`w-6 h-6 rounded text-xs font-bold transition flex items-center justify-center mx-auto cursor-pointer ${
                            isPresent === 1
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {isPresent === 1 ? '1' : '0'}
                        </button>
                      </td>
                    ))}

                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                      {formatNumber(att.hok)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      {formatRupiah(att.upahHarian, false)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-purple-900 bg-purple-50/40">
                      {formatRupiah(att.totalUpah, false)}
                    </td>
                    <td className="py-2 px-3 text-center text-[10px] text-slate-400 italic">
                      [ {att.nama} ]
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteWorker(att.workerId, att.nama)}
                        title={`Hapus ${att.nama}`}
                        className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={5} className="py-3 px-4 text-right uppercase text-xs">Total Upah Minggu {activeReport.mingguKe}:</td>
                  <td colSpan={7} className="py-3 px-2 text-center text-slate-500 text-xs">
                    {activeReport.attendance.reduce((s, a) => s + a.hok, 0)} Total HOK
                  </td>
                  <td colSpan={2}></td>
                  <td className="py-3 px-4 text-right font-mono text-purple-950 font-extrabold text-sm bg-purple-100/60">
                    {formatRupiah(activeReport.totalUpah)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
