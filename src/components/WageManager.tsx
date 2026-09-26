import React, { useState, useMemo } from 'react';
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
  Edit2,
  Search,
  HardHat,
  UserCheck,
  Building2,
  SlidersHorizontal,
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
  const [activeTab, setActiveTab] = useState<'absensi' | 'master'>('absensi');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingWorker, setIsAddingWorker] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerItem | null>(null);

  // Form states for adding worker
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

  // Edit form state
  const [editRoleOption, setEditRoleOption] = useState<'KT' | 'T' | 'P' | 'CUSTOM'>('P');
  const [editCustomRoleName, setEditCustomRoleName] = useState('');

  const activeReport =
    wageReports.find((r) => r.mingguKe === selectedWeekNum) || wageReports[0];

  // Filtered workers list for Master table
  const filteredWorkers = useMemo(() => {
    if (!searchQuery.trim()) return workers;
    const q = searchQuery.toLowerCase();
    return workers.filter(
      (w) =>
        w.nama.toLowerCase().includes(q) ||
        (w.peranLabel || w.peran).toLowerCase().includes(q) ||
        w.domisili.toLowerCase().includes(q)
    );
  }, [workers, searchQuery]);

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
    if (!newWorker.nama?.trim()) return;

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

  const handleStartEditWorker = (worker: WorkerItem) => {
    setEditingWorker(worker);
    if (worker.peran === 'KT' || worker.peran === 'T' || worker.peran === 'P') {
      setEditRoleOption(worker.peran);
      setEditCustomRoleName('');
    } else {
      setEditRoleOption('CUSTOM');
      setEditCustomRoleName(worker.peranLabel || worker.peran);
    }
  };

  const handleSaveEditWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker || !editingWorker.nama.trim()) return;

    let roleCode = editRoleOption;
    let roleLabel = 'Pekerja';

    if (editRoleOption === 'KT') {
      roleLabel = 'Kepala Tukang';
    } else if (editRoleOption === 'T') {
      roleLabel = 'Tukang';
    } else if (editRoleOption === 'P') {
      roleLabel = 'Pekerja';
    } else {
      roleCode = (editCustomRoleName.trim().toUpperCase() || 'CUSTOM') as any;
      roleLabel = editCustomRoleName.trim() || 'Tenaga Ahli/Khusus';
    }

    const updatedWorker: WorkerItem = {
      ...editingWorker,
      nama: editingWorker.nama.trim(),
      peran: roleCode,
      peranLabel: roleLabel,
      upahHarian: Number(editingWorker.upahHarian) || 120000,
    };

    // 1. Update master workers
    const updatedWorkersList = workers.map((w) => (w.id === updatedWorker.id ? updatedWorker : w));
    onUpdateWorkers(updatedWorkersList);

    // 2. Synchronize across all weekly wage reports
    const updatedReports = wageReports.map((rep) => {
      const updatedAttendance = rep.attendance.map((att) => {
        if (att.workerId === updatedWorker.id) {
          const hok = att.hok || att.days.reduce((a, b) => a + b, 0);
          return {
            ...att,
            nama: updatedWorker.nama,
            jenisKelamin: updatedWorker.jenisKelamin,
            domisili: updatedWorker.domisili,
            peran: updatedWorker.peran,
            peranLabel: updatedWorker.peranLabel,
            upahHarian: updatedWorker.upahHarian,
            totalUpah: hok * updatedWorker.upahHarian,
          };
        }
        return att;
      });

      return {
        ...rep,
        attendance: updatedAttendance,
        totalUpah: updatedAttendance.reduce((sum, a) => sum + a.totalUpah, 0),
      };
    });

    onUpdateWageReports(updatedReports);
    setEditingWorker(null);
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
            Pengelolaan data master tukang & pekerja, absensi harian 7 hari kerja, serta rekapitulasi upah terintegrasi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingWorker(true)}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Tambah Pekerja</span>
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

      {/* Main Section Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('absensi')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'absensi'
                ? 'border-purple-600 text-purple-900 bg-purple-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Daftar Upah & Absensi Mingguan</span>
          </button>

          <button
            onClick={() => setActiveTab('master')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'master'
                ? 'border-purple-600 text-purple-900 bg-purple-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <HardHat className="w-4 h-4 text-amber-600" />
            <span>Master Data Tenaga Kerja ({workers.length} Orang)</span>
          </button>
        </div>

        <div className="hidden sm:block text-xs font-semibold text-slate-500 font-mono">
          Total Alokasi Upah: <span className="text-purple-900 font-bold">{formatRupiah(totalAllWages)}</span>
        </div>
      </div>

      {/* Add Worker Form Modal/Inline */}
      {isAddingWorker && (
        <form onSubmit={handleAddWorker} className="bg-purple-50 p-5 rounded-xl border border-purple-200 shadow-xs space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-purple-200 pb-2">
            <h3 className="text-xs font-bold text-purple-900 uppercase flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-purple-700" />
              <span>Input Data Pekerja / Tukang Baru</span>
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
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                placeholder="Nama pekerja / tukang"
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
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="KT">Kepala Tukang (KT) - Standar Rp 200.000</option>
                <option value="T">Tukang (T) - Standar Rp 150.000</option>
                <option value="P">Pekerja (P) - Standar Rp 120.000</option>
                <option value="CUSTOM">+ Jenis / Spesialisasi Lain (Kustom)</option>
              </select>
            </div>

            {roleOption === 'CUSTOM' && (
              <div>
                <label className="block text-[11px] font-semibold text-purple-800 mb-1">
                  Nama Kategori / Spesialisasi *
                </label>
                <input
                  type="text"
                  required
                  value={customRoleName}
                  onChange={(e) => setCustomRoleName(e.target.value)}
                  placeholder="Misal: Tukang Las / Mandor / Supir"
                  className="w-full px-2.5 py-1.5 text-xs border border-purple-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
              <select
                value={newWorker.jenisKelamin}
                onChange={(e) => setNewWorker({ ...newWorker, jenisKelamin: e.target.value as any })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="L">Laki-Laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tempat Tinggal</label>
              <select
                value={newWorker.domisili}
                onChange={(e) => setNewWorker({ ...newWorker, domisili: e.target.value as any })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="Dalam Desa">Dalam Desa</option>
                <option value="Luar Desa">Luar Desa</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Upah Harian (Rp)</label>
              <input
                type="number"
                value={newWorker.upahHarian}
                onChange={(e) => setNewWorker({ ...newWorker, upahHarian: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-200">
            <button
              type="button"
              onClick={() => setIsAddingWorker(false)}
              className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-300 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1.5 px-4 rounded-lg text-xs cursor-pointer shadow-xs"
            >
              Simpan Pekerja
            </button>
          </div>
        </form>
      )}

      {/* Edit Worker Modal */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditWorker}
            className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div className="bg-purple-900 text-white p-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-purple-300" />
                <span>Edit Data Pekerja: {editingWorker.nama}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingWorker(null)}
                className="text-purple-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Lengkap Pekerja *</label>
                <input
                  type="text"
                  required
                  value={editingWorker.nama}
                  onChange={(e) => setEditingWorker({ ...editingWorker, nama: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Jenis Pekerja / Jabatan</label>
                  <select
                    value={editRoleOption}
                    onChange={(e: any) => {
                      const val = e.target.value as 'KT' | 'T' | 'P' | 'CUSTOM';
                      setEditRoleOption(val);
                      let upah = editingWorker.upahHarian;
                      if (val === 'KT') upah = 200000;
                      else if (val === 'T') upah = 150000;
                      else if (val === 'P') upah = 120000;
                      setEditingWorker((prev) => (prev ? { ...prev, upahHarian: upah } : null));
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="KT">Kepala Tukang (KT) - Rp 200.000</option>
                    <option value="T">Tukang (T) - Rp 150.000</option>
                    <option value="P">Pekerja (P) - Rp 120.000</option>
                    <option value="CUSTOM">Kustom / Spesialisasi Lain</option>
                  </select>
                </div>

                {editRoleOption === 'CUSTOM' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-800 mb-1">Nama Kategori *</label>
                    <input
                      type="text"
                      required
                      value={editCustomRoleName}
                      onChange={(e) => setEditCustomRoleName(e.target.value)}
                      placeholder="Misal: Mandor / Tukang Las"
                      className="w-full px-3 py-2 text-xs border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-medium"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={editingWorker.jenisKelamin}
                    onChange={(e) => setEditingWorker({ ...editingWorker, jenisKelamin: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="L">Laki-Laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Domisili</label>
                  <select
                    value={editingWorker.domisili}
                    onChange={(e) => setEditingWorker({ ...editingWorker, domisili: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Dalam Desa">Dalam Desa</option>
                    <option value="Luar Desa">Luar Desa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Upah Harian (Rp)</label>
                  <input
                    type="number"
                    value={editingWorker.upahHarian}
                    onChange={(e) => setEditingWorker({ ...editingWorker, upahHarian: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingWorker(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs shadow-xs"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 1: ABSENSI & UPAH MINGGUAN */}
      {activeTab === 'absensi' && (
        <div className="space-y-6">
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
                      <th colSpan={7} className="py-1.5 px-2 border-b border-slate-700">Hari Kerja (Klik angka untuk ubah)</th>
                      <th rowSpan={2} className="py-2.5 px-3 text-right">Jumlah HOK</th>
                      <th rowSpan={2} className="py-2.5 px-3 text-right">Harga Upah (Rp)</th>
                      <th rowSpan={2} className="py-2.5 px-4 text-right bg-purple-900/50">Total Upah (Rp)</th>
                      <th rowSpan={2} className="py-2.5 px-3 text-center">Tanda Tangan</th>
                      <th rowSpan={2} className="py-2.5 px-2 text-center w-20">Aksi</th>
                    </tr>
                    <tr className="bg-slate-700 text-slate-200 text-[10px] border-b border-slate-600">
                      {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day, dIdx) => (
                        <th key={dIdx} className="py-1 px-2 w-8 text-center">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeReport.attendance.map((att, idx) => {
                      const workerObj = workers.find((w) => w.id === att.workerId) || {
                        id: att.workerId,
                        nama: att.nama,
                        jenisKelamin: att.jenisKelamin,
                        domisili: att.domisili,
                        peran: att.peran,
                        peranLabel: att.peranLabel,
                        upahHarian: att.upahHarian,
                      };

                      return (
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
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditWorker(workerObj)}
                                title={`Edit ${att.nama}`}
                                className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWorker(att.workerId, att.nama)}
                                title={`Hapus ${att.nama}`}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
      )}

      {/* TAB 2: MASTER DATA TENAGA KERJA */}
      {activeTab === 'master' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <HardHat className="w-4 h-4 text-amber-600" />
                Daftar Master Tenaga Kerja Terdaftar ({workers.length} Orang)
              </h3>
              <p className="text-xs text-slate-500">
                Data pekerja di bawah ini terhubung langsung dengan absensi mingguan, perhitungan HOK, dan kwitansi upah.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, jabatan, domisili..."
                  className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 w-60"
                />
              </div>

              <button
                onClick={() => setIsAddingWorker(true)}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Pekerja</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">No</th>
                  <th className="py-3 px-4">Nama Lengkap Pekerja</th>
                  <th className="py-3 px-3 text-center">Jabatan / Kategori</th>
                  <th className="py-3 px-3 text-center">L/P</th>
                  <th className="py-3 px-3 text-center">Domisili</th>
                  <th className="py-3 px-4 text-right">Tarif Upah Harian (Rp)</th>
                  <th className="py-3 px-3 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkers.map((w, idx) => (
                  <tr key={w.id} className="hover:bg-purple-50/30 transition">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      <div>{w.nama}</div>
                      {w.peranLabel && w.peranLabel !== w.peran && (
                        <div className="text-[10px] text-purple-700 font-normal">{w.peranLabel}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                        w.peran === 'KT' ? 'bg-rose-100 text-rose-800' :
                        w.peran === 'T' ? 'bg-amber-100 text-amber-800' :
                        w.peran === 'P' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {w.peranLabel || w.peran} ({w.peran})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 font-medium">{w.jenisKelamin}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600">{w.domisili}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-purple-900">
                      {formatRupiah(w.upahHarian)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEditWorker(w)}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWorker(w.id, w.nama)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                          title="Hapus Pekerja"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
