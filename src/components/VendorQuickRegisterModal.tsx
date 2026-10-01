import React, { useState } from 'react';
import { Store, Check, X, Sparkles, Building2 } from 'lucide-react';
import { StoreVendor } from '../types';

interface VendorQuickRegisterModalProps {
  isOpen: boolean;
  unregisteredName: string;
  categoryHint?: 'MATERIAL' | 'PERABOT' | 'KONSULTAN' | 'OPERASIONAL' | 'SIPLAH' | 'UMUM';
  onClose: () => void;
  onSaveStore: (newStore: StoreVendor) => void;
}

export const VendorQuickRegisterModal: React.FC<VendorQuickRegisterModalProps> = ({
  isOpen,
  unregisteredName,
  categoryHint = 'MATERIAL',
  onClose,
  onSaveStore,
}) => {
  const [namaToko, setNamaToko] = useState(unregisteredName || '');
  const [pemilikNama, setPemilikNama] = useState('');
  const [pekerjaan, setPekerjaan] = useState('Pemilik Toko');
  const [alamat, setAlamat] = useState('Lokasi Sekolah / Sekitar');
  const [telepon, setTelepon] = useState('');
  const [npwp, setNpwp] = useState('');
  const [kategori, setKategori] = useState<'MATERIAL' | 'PERABOT' | 'KONSULTAN' | 'OPERASIONAL' | 'SIPLAH' | 'UMUM'>(categoryHint);
  const [mitraSiplah, setMitraSiplah] = useState('SipLah Blibli');

  React.useEffect(() => {
    setNamaToko(unregisteredName);
    setKategori(categoryHint);
  }, [unregisteredName, categoryHint]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaToko.trim()) return;

    const isSiplah = kategori === 'SIPLAH';

    const newStore: StoreVendor = {
      id: `store-quick-${Date.now()}`,
      namaToko: namaToko.trim().toUpperCase(),
      pemilikNama: pemilikNama.trim() || 'Pemilik Toko',
      pekerjaan: pekerjaan.trim() || 'Pemilik Toko',
      alamat: alamat.trim() || '-',
      telepon: telepon.trim() || undefined,
      npwp: npwp.trim() || undefined,
      kategori,
      isSiplah,
      mitraSiplah: isSiplah ? mitraSiplah : undefined,
    };

    onSaveStore(newStore);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="bg-emerald-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Daftarkan Toko / Penyedia ke Master Data</h3>
              <p className="text-xs text-emerald-100">
                Penyedia ini belum terdaftar. Daftarkan agar valid di BKU, Kwitansi & SPB.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200 hover:text-white p-1.5 rounded-lg hover:bg-emerald-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-sans">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Nama Toko / Perusahaan / Penyedia *
            </label>
            <input
              type="text"
              required
              value={namaToko}
              onChange={(e) => setNamaToko(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Kategori Master *</label>
              <select
                value={kategori}
                onChange={(e: any) => setKategori(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="MATERIAL">Bahan Bangunan & Material</option>
                <option value="PERABOT">Mebeler & Perabot</option>
                <option value="KONSULTAN">Konsultan / Perencana</option>
                <option value="OPERASIONAL">Operasional, K3 & Percetakan</option>
                <option value="SIPLAH">🛒 Penyedia SipLah Resmi</option>
                <option value="UMUM">Penyedia Umum</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Pemilik / Penanggung Jawab</label>
              <input
                type="text"
                value={pemilikNama}
                onChange={(e) => setPemilikNama(e.target.value)}
                placeholder="Contoh: H. Ahmad"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {kategori === 'SIPLAH' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <span className="font-bold text-amber-900 flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Pengaturan Mitra SipLah</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-amber-900 text-[10px] mb-0.5">Mitra SipLah</label>
                  <input
                    type="text"
                    value={mitraSiplah}
                    onChange={(e) => setMitraSiplah(e.target.value)}
                    placeholder="SipLah Blibli / Telkom"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-amber-900 text-[10px] mb-0.5">Jabatan Pemilik</label>
                  <input
                    type="text"
                    value={pekerjaan}
                    onChange={(e) => setPekerjaan(e.target.value)}
                    placeholder="Penyedia SipLah"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Alamat Toko</label>
              <input
                type="text"
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">NPWP Toko (Opsional)</label>
              <input
                type="text"
                value={npwp}
                onChange={(e) => setNpwp(e.target.value)}
                placeholder="01.234.567.8-123.000"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-medium bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Simpan ke Master Toko</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
