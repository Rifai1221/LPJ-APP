import React, { useState } from 'react';
import { X, Plus, Trash2, Receipt, Sparkles, Store } from 'lucide-react';
import { KwitansiDocument, TokoItem, StoreVendor } from '../types';
import { formatRupiah } from '../utils/formatters';

interface QuickReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (kwitansi: KwitansiDocument) => void;
  availableStores?: StoreVendor[];
}

export const QuickReceiptModal: React.FC<QuickReceiptModalProps> = ({
  isOpen,
  onClose,
  onSave,
  availableStores = [],
}) => {
  const [tipe, setTipe] = useState<'MATERIAL' | 'UPAH' | 'KONSULTAN' | 'PERABOT' | 'OPERASIONAL'>('MATERIAL');
  const [noBukti, setNoBukti] = useState(`KW/${Math.floor(Math.random() * 900 + 100)}/2025`);
  const [noSpb, setNoSpb] = useState(`SPB/${Math.floor(Math.random() * 900 + 100)}/2025`);
  const [tanggal, setTanggal] = useState('25/11/2025');
  const [tanggalFormatted, setTanggalFormatted] = useState('25 November 2025');
  const [bulan, setBulan] = useState('November 2025');
  const [namaToko, setNamaToko] = useState(availableStores[0]?.namaToko || 'TOKO USAHA MAJU');
  const [penerimaNama, setPenerimaNama] = useState(availableStores[0]?.pemilikNama || 'H. Sulaiman');
  const [penerimaPekerjaan, setPenerimaPekerjaan] = useState(availableStores[0]?.pekerjaan || 'Pemilik Toko');
  const [penerimaAlamat, setPenerimaAlamat] = useState(availableStores[0]?.alamat || 'Lhokseumawe');
  const [uraian, setUraian] = useState(
    'Pembayaran Lunas Biaya Pembelian Material Bangunan, Untuk Pekerjaan Revitalisasi Sekolah, Tahun 2025, Daftar Terlampir.'
  );

  const [items, setItems] = useState<TokoItem[]>([
    { namaBarang: 'Semen PC (40 kg)', volume: 50, satuan: 'Zak', hargaSatuan: 72000, jumlah: 3600000 },
  ]);

  const [isPpn, setIsPpn] = useState(false);
  const [isPph22, setIsPph22] = useState(false);
  const [isPph23, setIsPph23] = useState(false);

  if (!isOpen) return null;

  const handleSelectPredefinedStore = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const storeId = e.target.value;
    if (!storeId) return;
    const found = availableStores.find((s) => s.id === storeId || s.namaToko === storeId);
    if (found) {
      setNamaToko(found.namaToko);
      setPenerimaNama(found.pemilikNama);
      setPenerimaPekerjaan(found.pekerjaan || 'Pemilik Toko');
      setPenerimaAlamat(found.alamat);
      if (found.kategori === 'PERABOT') setTipe('PERABOT');
      else if (found.kategori === 'KONSULTAN') setTipe('KONSULTAN');
      else if (found.kategori === 'OPERASIONAL') setTipe('OPERASIONAL');
      else setTipe('MATERIAL');
    }
  };

  const totalNominal = items.reduce((sum, it) => sum + it.jumlah, 0);

  const handleItemChange = (index: number, field: keyof TokoItem, val: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: val };
    if (field === 'volume' || field === 'hargaSatuan') {
      const v = field === 'volume' ? parseFloat(val) || 0 : item.volume;
      const h = field === 'hargaSatuan' ? parseFloat(val) || 0 : item.hargaSatuan;
      item.jumlah = Math.round(v * h);
    }
    updated[index] = item;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([...items, { namaBarang: '', volume: 1, satuan: 'unit', hargaSatuan: 0, jumlah: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let ppnAmount = 0;
    let pph22Amount = 0;
    let pph23Amount = 0;

    if (isPpn) {
      ppnAmount = Math.round((totalNominal / 1.11) * 0.11 * 100) / 100;
    }
    if (isPph22) {
      pph22Amount = Math.round((totalNominal / 1.11) * 0.015 * 100) / 100;
    }
    if (isPph23) {
      pph23Amount = Math.round(totalNominal * 0.04 * 100) / 100;
    }

    const doc: KwitansiDocument = {
      id: `kw-custom-${Date.now()}`,
      noBukti,
      noSpb,
      tipe,
      tanggal,
      tanggalFormatted,
      bulan,
      uraian,
      penerimaNama,
      penerimaPekerjaan,
      penerimaAlamat,
      namaToko,
      items,
      nominal: totalNominal,
      isPpn,
      isPph22,
      isPph23,
      ppnAmount,
      pph22Amount,
      pph23Amount,
      kategoriBiayaPajak: tipe === 'PERABOT' ? 'Perabot' : tipe === 'KONSULTAN' || tipe === 'OPERASIONAL' ? 'Perencanaan_Pengelolaan' : 'Konstruksi',
    };

    onSave(doc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Buat Kwitansi & Bon Pembelian Instan</h3>
              <p className="text-[11px] text-slate-500">Otomatis membuat kwitansi, faktur toko, SPB dan posting ke BKU</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tipe Transaksi</label>
              <select
                value={tipe}
                onChange={(e) => setTipe(e.target.value as any)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              >
                <option value="MATERIAL">Bahan Bangunan</option>
                <option value="UPAH">Upah Tukang</option>
                <option value="KONSULTAN">Jasa Konsultan</option>
                <option value="PERABOT">Perabot</option>
                <option value="OPERASIONAL">Operasional/K3</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nomor Kwitansi</label>
              <input
                type="text"
                value={noBukti}
                onChange={(e) => setNoBukti(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tanggal (DD/MM/YYYY)</label>
              <input
                type="text"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bulan Buku</label>
              <select
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              >
                <option value="Oktober 2025">Oktober 2025</option>
                <option value="November 2025">November 2025</option>
                <option value="Desember 2025">Desember 2025</option>
                <option value="Januari 2026">Januari 2026</option>
              </select>
            </div>
          </div>

          {availableStores && availableStores.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-700 shrink-0" />
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-emerald-900 uppercase">
                  Pilih Cepat dari Rekanan Terdaftar:
                </label>
                <select
                  onChange={handleSelectPredefinedStore}
                  className="w-full text-xs font-semibold text-slate-800 bg-white border border-emerald-300 rounded px-2 py-1 mt-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Pilih Toko Rekanan (Otomatis Isi Pemilik & Alamat) --</option>
                  {availableStores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.namaToko} - {s.pemilikNama} ({s.kategori})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Toko / Rekanan *</label>
              <input
                type="text"
                value={namaToko}
                onChange={(e) => setNamaToko(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold uppercase"
                placeholder="Contoh: TOKO USAHA FAMILY"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Penerima / Pemilik *</label>
              <input
                type="text"
                value={penerimaNama}
                onChange={(e) => setPenerimaNama(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                placeholder="Contoh: H. Sulaiman"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Uraian Keperluan Pembayaran</label>
            <textarea
              rows={2}
              value={uraian}
              onChange={(e) => setUraian(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              required
            />
          </div>

          {/* Item List */}
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Daftar Barang / Jasa pada Faktur & Kwitansi:</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Baris
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <div className="col-span-5">
                    <input
                      type="text"
                      placeholder="Nama Barang / Uraian"
                      value={item.namaBarang}
                      onChange={(e) => handleItemChange(idx, 'namaBarang', e.target.value)}
                      className="w-full p-1.5 text-xs bg-white border border-slate-200 rounded"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Vol"
                      value={item.volume}
                      onChange={(e) => handleItemChange(idx, 'volume', e.target.value)}
                      className="w-full p-1.5 text-xs bg-white border border-slate-200 rounded text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Satuan"
                      value={item.satuan}
                      onChange={(e) => handleItemChange(idx, 'satuan', e.target.value)}
                      className="w-full p-1.5 text-xs bg-white border border-slate-200 rounded text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Harga"
                      value={item.hargaSatuan}
                      onChange={(e) => handleItemChange(idx, 'hargaSatuan', e.target.value)}
                      className="w-full p-1.5 text-xs bg-white border border-slate-200 rounded text-right font-mono"
                    />
                  </div>
                  <div className="col-span-1 text-center">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end p-2 text-xs font-bold text-slate-900">
              <span>Total Kwitansi: {formatRupiah(totalNominal)}</span>
            </div>
          </div>

          {/* Tax Options */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-700">Perlakuan Pajak:</span>
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPpn}
                  onChange={(e) => setIsPpn(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>PPN 11%</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPph22}
                  onChange={(e) => setIsPph22(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>PPh Ps 22 (1.5%)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPph23}
                  onChange={(e) => setIsPph23(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>PPh 23 (Konsultan / Jasa)</span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-md cursor-pointer"
            >
              Simpan Kwitansi & Posting ke BKU
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
