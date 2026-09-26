import React, { useState, useRef } from 'react';
import {
  Save,
  Building,
  UserCheck,
  CreditCard,
  Calendar,
  Sparkles,
  MapPin,
  CheckCircle,
  FileText,
  Printer,
  Award,
  ShieldCheck,
  Compass,
  ClipboardCheck,
  HardHat,
  Users,
  Eye,
  Layers,
  UserPlus,
  Shield,
  Landmark,
  BookOpen,
  Trash2,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  HelpCircle,
  Sliders,
  X,
} from 'lucide-react';
import { SchoolMasterData } from '../types';
import { formatRupiah } from '../utils/formatters';
import { P2spOrgChart, P2spSkDocument } from './P2spBaganAndSk';
import { SkTimTeknisDocument } from './SkTimTeknisDocument';
import { compressImageFile, TUT_WURI_HANDAYANI_LOGO } from '../utils/imageHelper';

interface MasterDataFormProps {
  school: SchoolMasterData;
  onSave: (updated: SchoolMasterData) => void;
  onOpenPrintModal?: (doc: 'BAGAN_STRUKTUR' | 'SK_P2SP' | string) => void;
  onDeleteSchool?: () => void;
}

export const MasterDataForm: React.FC<MasterDataFormProps> = ({ school, onSave, onOpenPrintModal, onDeleteSchool }) => {
  const [formData, setFormData] = useState<SchoolMasterData>({ ...school });
  const [isSaved, setIsSaved] = useState(false);
  const [p2spActiveView, setP2spActiveView] = useState<'form' | 'bagan' | 'sk' | 'sk_tim_teknis'>('form');

  // Logo Kop Surat Management State
  const [activeLogoTab, setActiveLogoTab] = useState<'LEFT' | 'RIGHT'>('LEFT');
  const [showKopPreview, setShowKopPreview] = useState(true);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const currentActiveLogoUrl = activeLogoTab === 'LEFT' ? formData.logoLeftUrl : formData.logoRightUrl;

  const handleLogoUpload = async (file: File) => {
    try {
      const compressed = await compressImageFile(file, 500, 500, 0.85);
      if (activeLogoTab === 'LEFT') {
        handleChange('logoLeftUrl', compressed);
      } else {
        handleChange('logoRightUrl', compressed);
      }
    } catch (err) {
      console.error('Error compressing logo:', err);
    }
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
  };

  const handleSetTutWuriLogo = () => {
    if (activeLogoTab === 'LEFT') {
      handleChange('logoLeftUrl', TUT_WURI_HANDAYANI_LOGO);
    } else {
      handleChange('logoRightUrl', TUT_WURI_HANDAYANI_LOGO);
    }
  };

  const handleRemoveLogo = () => {
    if (activeLogoTab === 'LEFT') {
      handleChange('logoLeftUrl', '');
    } else {
      handleChange('logoRightUrl', '');
    }
  };

  const handleChange = (field: keyof SchoolMasterData, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'namaKepalaPelaksana') {
        updated.namaPelaksana = value;
      } else if (field === 'namaPelaksana') {
        updated.namaKepalaPelaksana = value;
      }
      if (field === 'totalAnggaran') {
        const num = Number(value) || 0;
        updated.termin1Nilai = Math.round(num * 0.7);
        updated.termin2Nilai = Math.round(num * 0.3);
      }
      return updated;
    });
    setIsSaved(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Data Master Sekolah & Pelaksana Kegiatan
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Data ini akan mengisi seluruh Kop Dokumen, Cover LPJ, BKU, BKT, BKB, Kwitansi, SPB, dan Lembar Pengesahan secara otomatis.
          </p>
        </div>
        <button
          type="submit"
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-md transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSaved ? 'Tersimpan!' : 'Simpan Perubahan'}</span>
        </button>
      </div>

      {isSaved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Data Master Sekolah berhasil diperbarui dan disinkronkan ke seluruh dokumen LPJ!
        </div>
      )}

      {/* LOGO KOP SURAT & IDENTITAS VISUAL */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                LOGO KOP SURAT & IDENTITAS VISUAL
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Unggah logo dinas/sekolah yang akan tercetak otomatis pada Kop Surat SPJ, BKU, Kwitansi, dan Opname.
              </p>
            </div>
          </div>

          {/* Top Right Toggle Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveLogoTab('LEFT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeLogoTab === 'LEFT' ? 'bg-white text-slate-900 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Logo Utama (Kiri)
            </button>
            <button
              type="button"
              onClick={() => setActiveLogoTab('RIGHT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeLogoTab === 'RIGHT' ? 'bg-white text-slate-900 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Logo Kanan (Opsional)
            </button>
          </div>
        </div>

        {/* Main Upload Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Dotted Dropzone Box */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleLogoDrop}
            onClick={() => logoFileInputRef.current?.click()}
            className="lg:col-span-8 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-slate-50/50 hover:bg-emerald-50/20 p-6 flex flex-col items-center justify-center text-center transition cursor-pointer group min-h-[160px] relative"
          >
            <input
              ref={logoFileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp, image/svg+xml"
              onChange={handleLogoFileSelect}
              className="hidden"
            />

            {currentActiveLogoUrl ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={currentActiveLogoUrl}
                  alt="Logo Kop"
                  style={{ maxHeight: '80px' }}
                  className="w-auto object-contain drop-shadow-xs"
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-3 py-0.5 rounded-full">
                    ✓ Logo {activeLogoTab === 'LEFT' ? 'Utama (Kiri)' : 'Kanan'} Aktif
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveLogo();
                    }}
                    className="text-[11px] text-red-600 hover:underline font-bold cursor-pointer"
                  >
                    Hapus Logo
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full mb-2 group-hover:scale-110 transition">
                  <Upload className="w-6 h-6" />
                </div>
                <strong className="text-xs text-slate-800 font-bold block">
                  Klik untuk pilih logo atau seret gambar ke sini
                </strong>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  PNG, JPG, WEBP, atau SVG (Direkomendasikan transparan, rasio 1:1)
                </span>
              </>
            )}
          </div>

          {/* Right Action Panel */}
          <div className="lg:col-span-4 flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => logoFileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                <span>↑ Pilih File Logo...</span>
              </button>

              <button
                type="button"
                onClick={handleSetTutWuriLogo}
                className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>✨ Pakai Logo Tut Wuri</span>
              </button>
            </div>

            {/* Info Callout Box */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Petunjuk Kop Dinas:</span>
              </div>
              <p className="leading-snug">
                {activeLogoTab === 'LEFT'
                  ? 'Sisi kiri umumnya memuat Logo Pemda Kabupaten/Kota atau Lambang Resmi Sekolah.'
                  : 'Sisi kanan umumnya memuat Logo Tut Wuri Handayani atau Lambang Khusus.'}
              </p>
            </div>
          </div>
        </div>

        {/* Height Control Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>Tinggi Tampilan Logo di Kop Surat:</span>
          </div>

          <div className="flex items-center gap-2">
            {[
              { label: 'Kecil (52px)', val: 52 },
              { label: 'Standar (65px)', val: 65 },
              { label: 'Besar (78px)', val: 78 },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => handleChange('logoHeightPx', opt.val)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  (formData.logoHeightPx || 65) === opt.val
                    ? 'bg-emerald-800 text-white shadow-xs font-extrabold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Kop Surat Preview */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 tracking-wider uppercase">
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>PRATINJAU HASIL KOP SURAT DINAS</span>
            </div>

            <button
              type="button"
              onClick={() => setShowKopPreview((prev) => !prev)}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              {showKopPreview ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>

          {showKopPreview && (
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs text-center space-y-2 relative">
                <div className="flex items-center justify-between gap-4">
                  {/* Left Logo */}
                  <div className="w-20 flex justify-center items-center shrink-0">
                    {formData.logoLeftUrl ? (
                      <img
                        src={formData.logoLeftUrl}
                        alt="Logo Kiri"
                        style={{ height: `${formData.logoHeightPx || 65}px` }}
                        className="w-auto object-contain"
                      />
                    ) : (
                      <div
                        style={{ height: `${formData.logoHeightPx || 65}px` }}
                        className="w-16 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 bg-slate-50"
                      >
                        Logo Kiri
                      </div>
                    )}
                  </div>

                  {/* Center Text Header */}
                  <div className="flex-1 space-y-0.5 font-sans">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                      {formData.headerPemerintahText || `PEMERINTAH ${formData.kabKota?.toUpperCase() || 'KABUPATEN / KOTA'}`}
                    </h4>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                      {formData.dinasPendidikan || 'DINAS PENDIDIKAN'}
                    </h4>
                    <h2 className="font-black text-sm uppercase tracking-wide text-slate-900 py-0.5">
                      {formData.namaSekolah || 'SD NEGERI SATUAN PENDIDIKAN'}
                    </h2>
                    <p className="text-[10px] text-slate-600">
                      - • NPSN: {formData.npsn || '-'} • Alamat: {formData.alamat || '-'}, {formData.kabKota || '-'} • -
                    </p>
                  </div>

                  {/* Right Logo */}
                  <div className="w-20 flex justify-center items-center shrink-0">
                    {formData.logoRightUrl ? (
                      <img
                        src={formData.logoRightUrl}
                        alt="Logo Kanan"
                        style={{ height: `${formData.logoHeightPx || 65}px` }}
                        className="w-auto object-contain"
                      />
                    ) : (
                      <div
                        style={{ height: `${formData.logoHeightPx || 65}px` }}
                        className="w-16 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400 bg-slate-50"
                      >
                        Logo Kanan
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-b-2 border-slate-900 mt-4 mb-2" />

                <p className="text-[11px] text-slate-400 italic">
                  (Pratinjau ini merefleksikan posisi Logo, nama instansi, dan alamat pada dokumen cetak kedinasan)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identitas Satuan Pendidikan */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            <Building className="w-4 h-4 text-blue-600" />
            Identitas Sekolah & Lokasi
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Satuan Pendidikan / Sekolah</label>
              <input
                type="text"
                value={formData.namaSekolah}
                onChange={(e) => handleChange('namaSekolah', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NPSN</label>
                <input
                  type="text"
                  value={formData.npsn}
                  onChange={(e) => handleChange('npsn', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Anggaran</label>
                <input
                  type="text"
                  value={formData.tahunAnggaran}
                  onChange={(e) => handleChange('tahunAnggaran', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
              <input
                type="text"
                value={formData.alamat}
                onChange={(e) => handleChange('alamat', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kabupaten / Kota</label>
                <input
                  type="text"
                  value={formData.kabKota}
                  onChange={(e) => handleChange('kabKota', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Provinsi</label>
                <input
                  type="text"
                  value={formData.provinsi}
                  onChange={(e) => handleChange('provinsi', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dinas Pendidikan Pembina</label>
              <input
                type="text"
                value={formData.dinasPendidikan}
                onChange={(e) => handleChange('dinasPendidikan', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Informasi Bantuan & Periode */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            Program, Pekerjaan & Nilai Bantuan
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Program</label>
              <input
                type="text"
                value={formData.program}
                onChange={(e) => handleChange('program', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pekerjaan</label>
              <input
                type="text"
                value={formData.pekerjaan}
                onChange={(e) => handleChange('pekerjaan', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Periode Waktu Penggunaan Dana</label>
              <input
                type="text"
                value={formData.periodePenggunaan}
                onChange={(e) => handleChange('periodePenggunaan', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total Pagu Bantuan Dana (Rp)</label>
              <input
                type="number"
                value={formData.totalAnggaran}
                onChange={(e) => handleChange('totalAnggaran', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs font-bold text-slate-900 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Terbilang: {formatRupiah(formData.totalAnggaran)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="text-[11px] text-slate-500">Termin I (70%)</span>
                <p className="text-xs font-bold text-slate-800">{formatRupiah(formData.termin1Nilai)}</p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Termin II (30%)</span>
                <p className="text-xs font-bold text-slate-800">{formatRupiah(formData.termin2Nilai)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tim Penandatangan & P2SP (Menu Isian, Bagan Struktur, dan Naskah SK) */}
        <div className="col-span-1 md:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-5">
          {/* Header & View Mode Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pejabat Penandatangan, Panitia P2SP & Struktur SK
                  </h3>
                  <p className="text-xs text-slate-500">
                    Menu isian tim pelaksana, diagram alir bagan struktur organisasi resmi, dan naskah Surat Keputusan (SK).
                  </p>
                </div>
              </div>
            </div>

            {/* Segmented Control Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setP2spActiveView('form')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  p2spActiveView === 'form'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Menu Isian Tim & SK</span>
              </button>

              <button
                type="button"
                onClick={() => setP2spActiveView('bagan')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  p2spActiveView === 'bagan'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bagan Struktur Organisasi</span>
              </button>

              <button
                type="button"
                onClick={() => setP2spActiveView('sk')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  p2spActiveView === 'sk'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Naskah Dokumen SK P2SP</span>
              </button>

              <button
                type="button"
                onClick={() => setP2spActiveView('sk_tim_teknis')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  p2spActiveView === 'sk_tim_teknis'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                <span>Naskah SK Tim Teknis</span>
              </button>
            </div>
          </div>

          {/* VIEW 1: MENU ISIAN FORM */}
          {p2spActiveView === 'form' && (
            <div className="space-y-6 animate-fade-in">
              {/* Group 1: Data Legalitas SK P2SP */}
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  <Award className="w-4 h-4 text-indigo-600" />
                  1. Data Surat Keputusan (SK) Pembentukan Tim P2SP
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor Surat Keputusan (SK P2SP)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 421.2/028/SK-P2SP/2025"
                      value={formData.nomorSkP2SP || ''}
                      onChange={(e) => handleChange('nomorSkP2SP', e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono font-medium border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Penetapan SK P2SP
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 15 Juli 2025"
                      value={formData.tanggalSkP2SP || ''}
                      onChange={(e) => handleChange('tanggalSkP2SP', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tentang / Judul Penetapan SK
                    </label>
                    <input
                      type="text"
                      placeholder="Pembentukan Panitia P2SP Pelaksana DAK Fisik..."
                      value={formData.tentangSkP2SP || ''}
                      onChange={(e) => handleChange('tentangSkP2SP', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white truncate"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Data Legalitas SK Tim Teknis (Perencana & Pengawas) */}
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  <Award className="w-4 h-4 text-emerald-600" />
                  2. Data Surat Keputusan (SK) Tim Teknis (Perencana & Pengawas)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor SK Tim Teknis
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 421.2/029/SK-TIM-TEKNIS/2026"
                      value={formData.nomorSkTimTeknis || ''}
                      onChange={(e) => handleChange('nomorSkTimTeknis', e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono font-medium border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Penetapan SK Tim Teknis
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 16 Juli 2025"
                      value={formData.tanggalSkTimTeknis || ''}
                      onChange={(e) => handleChange('tanggalSkTimTeknis', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: Pengurus Inti Panitia P2SP (Format 9 Kartu Sesuai Cuplikan Layar) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wide">
                    <Users className="w-4 h-4 text-indigo-600" />
                    3. Pengurus Inti Panitia P2SP
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                    9 Struktur Personalia & Pelaksana Kegiatan
                  </span>
                </div>

                {/* 3x3 Card Grid matching the uploaded image */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* KARTU 1: PENANGGUNG JAWAB */}
                  <div className="bg-white rounded-xl border-2 border-blue-400 p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                            <BookOpen className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">Penanggung Jawab</h4>
                            <p className="text-[11px] text-slate-500 leading-tight">Kepala Satuan Pendidikan / Komite</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-blue-600 text-white font-bold text-[10px] rounded tracking-wider uppercase whitespace-nowrap shadow-2xs">
                          1. PENANGGUNG JAWAB
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                          <input
                            type="text"
                            value={formData.namaKepalaSekolah}
                            onChange={(e) => handleChange('namaKepalaSekolah', e.target.value)}
                            placeholder="Dra. Hj. Endang Rahayu, M.Pd."
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIK</label>
                          <input
                            type="text"
                            value={formData.nipKepalaSekolah}
                            onChange={(e) => handleChange('nipKepalaSekolah', e.target.value)}
                            placeholder="19740512 199803 2 004"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan Pokok</label>
                          <input
                            type="text"
                            value={formData.jabatanKepalaSekolah || 'Kepala Sekolah'}
                            onChange={(e) => handleChange('jabatanKepalaSekolah', e.target.value)}
                            placeholder="Kepala Sekolah"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">No. HP / WhatsApp</label>
                          <input
                            type="text"
                            value={formData.hpKepalaSekolah || ''}
                            onChange={(e) => handleChange('hpKepalaSekolah', e.target.value)}
                            placeholder="0812-8877-6651"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KARTU 2: KETUA TIM P2SP */}
                  <div className="bg-white rounded-xl border-2 border-emerald-400 p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                            <UserPlus className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">Ketua Tim P2SP</h4>
                            <p className="text-[11px] text-slate-500 leading-tight">Ketua Pelaksana Pembangunan</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-700 text-white font-bold text-[10px] rounded tracking-wider uppercase whitespace-nowrap shadow-2xs">
                          2. KETUA P2SP
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                          <input
                            type="text"
                            value={formData.namaKetuaP2SP}
                            onChange={(e) => handleChange('namaKetuaP2SP', e.target.value)}
                            placeholder="H. Rahmat Hidayat, S.T."
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIK</label>
                          <input
                            type="text"
                            value={formData.nipKetuaP2SP || ''}
                            onChange={(e) => handleChange('nipKetuaP2SP', e.target.value)}
                            placeholder="3201081504780003"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan Pokok</label>
                          <input
                            type="text"
                            value={formData.jabatanKetuaP2SP || ''}
                            onChange={(e) => handleChange('jabatanKetuaP2SP', e.target.value)}
                            placeholder="Ketua Komite Sekolah"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">No. HP / WhatsApp</label>
                          <input
                            type="text"
                            value={formData.hpKetuaP2SP || ''}
                            onChange={(e) => handleChange('hpKetuaP2SP', e.target.value)}
                            placeholder="0813-1122-3344"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KARTU 3: SEKRETARIS / LOGISTIK */}
                  <div className="bg-white rounded-xl border-2 border-indigo-400 p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                            <FileText className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">Sekretaris / Logistik</h4>
                            <p className="text-[11px] text-slate-500 leading-tight">Administrasi & Pengadaan Material</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-[10px] rounded tracking-wider uppercase whitespace-nowrap shadow-2xs">
                          3. SEKRETARIS / LOGISTIK
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                          <input
                            type="text"
                            value={formData.namaSekretaris || ''}
                            onChange={(e) => handleChange('namaSekretaris', e.target.value)}
                            placeholder="Muhammad Rizki Fauzi, S.Pd."
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIK</label>
                          <input
                            type="text"
                            value={formData.nipSekretaris || ''}
                            onChange={(e) => handleChange('nipSekretaris', e.target.value)}
                            placeholder="19890214 201903 1 008"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan Pokok</label>
                          <input
                            type="text"
                            value={formData.jabatanSekretaris || ''}
                            onChange={(e) => handleChange('jabatanSekretaris', e.target.value)}
                            placeholder="Guru & Pengelola Sarpras"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">No. HP / WhatsApp</label>
                          <input
                            type="text"
                            value={formData.hpSekretaris || ''}
                            onChange={(e) => handleChange('hpSekretaris', e.target.value)}
                            placeholder="0857-1234-5678"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KARTU 4: BENDAHARA P2SP */}
                  <div className="bg-white rounded-xl border-2 border-amber-400 p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                            <CreditCard className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">Bendahara P2SP</h4>
                            <p className="text-[11px] text-slate-500 leading-tight">Pengelola Kas & Pembukuan SPJ</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-amber-600 text-white font-bold text-[10px] rounded tracking-wider uppercase whitespace-nowrap shadow-2xs">
                          4. BENDAHARA
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                          <input
                            type="text"
                            value={formData.namaBendahara}
                            onChange={(e) => handleChange('namaBendahara', e.target.value)}
                            placeholder="Siti Nurhalizah, S.E."
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIK</label>
                          <input
                            type="text"
                            value={formData.nipBendahara}
                            onChange={(e) => handleChange('nipBendahara', e.target.value)}
                            placeholder="3201085208850002"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan Pokok</label>
                          <input
                            type="text"
                            value={formData.jabatanBendahara || ''}
                            onChange={(e) => handleChange('jabatanBendahara', e.target.value)}
                            placeholder="Bendahara Sekolah / BOS"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">No. HP / WhatsApp</label>
                          <input
                            type="text"
                            value={formData.hpBendahara || ''}
                            onChange={(e) => handleChange('hpBendahara', e.target.value)}
                            placeholder="0821-9988-7766"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KARTU 5: KEPALA PELAKSANA */}
                  <div className="bg-white rounded-xl border-2 border-orange-400 p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-orange-50 text-orange-600 border border-orange-200">
                            <HardHat className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">Kepala Pelaksana</h4>
                            <p className="text-[11px] text-slate-500 leading-tight">Pelaksana Lapangan / Mandor Utama</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-orange-600 text-white font-bold text-[10px] rounded tracking-wider uppercase whitespace-nowrap shadow-2xs">
                          5. KEPALA PELAKSANA
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                          <input
                            type="text"
                            value={formData.namaKepalaPelaksana || formData.namaPelaksana || ''}
                            onChange={(e) => handleChange('namaKepalaPelaksana', e.target.value)}
                            placeholder="Drs. Agus Sulaeman"
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500 bg-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIK</label>
                          <input
                            type="text"
                            value={formData.nipPelaksana || ''}
                            onChange={(e) => handleChange('nipPelaksana', e.target.value)}
                            placeholder="3201082207780001"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan Pokok</label>
                          <input
                            type="text"
                            value={formData.jabatanPelaksana || ''}
                            onChange={(e) => handleChange('jabatanPelaksana', e.target.value)}
                            placeholder="Kepala Pelaksana / Mandor Konstruksi"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">No. HP / WhatsApp</label>
                          <input
                            type="text"
                            value={formData.hpPelaksana || ''}
                            onChange={(e) => handleChange('hpPelaksana', e.target.value)}
                            placeholder="0815-7788-9900"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KARTU 6: PETUGAS KEAMANAN */}
                  <div className="bg-white rounded-xl border-2 border-slate-300 p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                            <Shield className="w-4 h-4 text-slate-700" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">Petugas Keamanan</h4>
                            <p className="text-[11px] text-slate-500 leading-tight">Kamtib & Pengamanan Aset / Material</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-slate-900 text-white font-bold text-[10px] rounded tracking-wider uppercase whitespace-nowrap shadow-2xs">
                          6. KEAMANAN
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                          <input
                            type="text"
                            value={formData.namaKeamanan || ''}
                            onChange={(e) => handleChange('namaKeamanan', e.target.value)}
                            placeholder="Suparman Wijaya"
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIK</label>
                          <input
                            type="text"
                            value={formData.nipKeamanan || ''}
                            onChange={(e) => handleChange('nipKeamanan', e.target.value)}
                            placeholder="3201080905750004"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan Pokok</label>
                          <input
                            type="text"
                            value={formData.jabatanKeamanan || ''}
                            onChange={(e) => handleChange('jabatanKeamanan', e.target.value)}
                            placeholder="Petugas Keamanan & Kamtib Lingkungan"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">No. HP / WhatsApp</label>
                          <input
                            type="text"
                            value={formData.hpKeamanan || ''}
                            onChange={(e) => handleChange('hpKeamanan', e.target.value)}
                            placeholder="0858-6677-8899"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KARTU 7: TIM TEKNIS PERENCANA */}
                  <div className="bg-white rounded-xl border-2 border-teal-400 p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-teal-50 text-teal-600 border border-teal-200">
                            <Compass className="w-4 h-4 text-teal-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">Tim Teknis Perencana</h4>
                            <p className="text-[11px] text-slate-500 leading-tight">Penyusun Gambar Kerja, RAB & AHSP</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-teal-600 text-white font-bold text-[10px] rounded tracking-wider uppercase whitespace-nowrap shadow-2xs">
                          7. PERENCANA
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                          <input
                            type="text"
                            value={formData.namaPerencana}
                            onChange={(e) => handleChange('namaPerencana', e.target.value)}
                            placeholder="Ir. Hendra Gunawan, M.T."
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIK</label>
                          <input
                            type="text"
                            value={formData.nipPerencana || ''}
                            onChange={(e) => handleChange('nipPerencana', e.target.value)}
                            placeholder="3271031406800007"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Keahlian / Jabatan</label>
                          <input
                            type="text"
                            value={formData.jabatanPerencana || ''}
                            onChange={(e) => handleChange('jabatanPerencana', e.target.value)}
                            placeholder="Perencana Teknis (Gambar & RAB)"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">No. HP / WhatsApp</label>
                          <input
                            type="text"
                            value={formData.hpPerencana || ''}
                            onChange={(e) => handleChange('hpPerencana', e.target.value)}
                            placeholder="0811-2233-4455"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KARTU 8: TIM TEKNIS PENGAWAS */}
                  <div className="bg-white rounded-xl border-2 border-emerald-400 p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                            <Eye className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">Tim Teknis Pengawas</h4>
                            <p className="text-[11px] text-slate-500 leading-tight">Pengawas Mutu Fisik & Progres Mingguan</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-700 text-white font-bold text-[10px] rounded tracking-wider uppercase whitespace-nowrap shadow-2xs">
                          8. PENGAWAS
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                          <input
                            type="text"
                            value={formData.namaPengawas}
                            onChange={(e) => handleChange('namaPengawas', e.target.value)}
                            placeholder="Budi Santoso, S.T."
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIK</label>
                          <input
                            type="text"
                            value={formData.nipPengawas || ''}
                            onChange={(e) => handleChange('nipPengawas', e.target.value)}
                            placeholder="3201081109830005"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Keahlian / Jabatan</label>
                          <input
                            type="text"
                            value={formData.jabatanPengawas || ''}
                            onChange={(e) => handleChange('jabatanPengawas', e.target.value)}
                            placeholder="Pengawas Teknis Lapangan"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">No. HP / WhatsApp</label>
                          <input
                            type="text"
                            value={formData.hpPengawas || ''}
                            onChange={(e) => handleChange('hpPengawas', e.target.value)}
                            placeholder="0812-3456-7890"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KARTU 9: FASILITATOR TEKNIS */}
                  <div className="bg-white rounded-xl border-2 border-purple-400 p-4 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
                            <Landmark className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">Fasilitator Teknis</h4>
                            <p className="text-[11px] text-slate-500 leading-tight">Pendamping Dinas Pendidikan / Konsultan</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-purple-600 text-white font-bold text-[10px] rounded tracking-wider uppercase whitespace-nowrap shadow-2xs">
                          9. FASILITATOR
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                          <input
                            type="text"
                            value={formData.namaFasilitator || ''}
                            onChange={(e) => handleChange('namaFasilitator', e.target.value)}
                            placeholder="Ir. Ahmad Zarkasih, M.Eng."
                            className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">NIP / NIK</label>
                          <input
                            type="text"
                            value={formData.nipFasilitator || ''}
                            onChange={(e) => handleChange('nipFasilitator', e.target.value)}
                            placeholder="19800615 200801 1 012"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Instansi / Asal Tugas</label>
                          <input
                            type="text"
                            value={formData.jabatanFasilitator || ''}
                            onChange={(e) => handleChange('jabatanFasilitator', e.target.value)}
                            placeholder="Fasilitator Teknis / Pendamping Dinas"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">No. HP / WhatsApp</label>
                          <input
                            type="text"
                            value={formData.hpFasilitator || ''}
                            onChange={(e) => handleChange('hpFasilitator', e.target.value)}
                            placeholder="0813-4567-8901"
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tombol Simpan Personil Tim P2SP (Sesuai Cuplikan Layar) */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-sm transition cursor-pointer text-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Seluruh Susunan Personil Tim P2SP</span>
                  </button>
                </div>
              </div>

              {/* Action Banner to View Bagan & SK */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
                <div className="text-xs text-indigo-900">
                  <span className="font-bold">Tips Cepat:</span> Seluruh isian di atas secara otomatis terhubung langsung ke{' '}
                  <strong>Bagan Struktur Organisasi</strong> dan <strong>Naskah Dokumen SK Resmi</strong>.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setP2spActiveView('bagan')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Lihat Bagan Struktur</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setP2spActiveView('sk')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Lihat Dokumen SK</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: BAGAN STRUKTUR ORGANISASI */}
          {p2spActiveView === 'bagan' && (
            <div className="space-y-4 animate-fade-in">
              <P2spOrgChart
                school={formData}
                onPrint={(doc) => (onOpenPrintModal ? onOpenPrintModal(doc) : window.print())}
              />
            </div>
          )}

          {/* VIEW 3: NASKAH DOKUMEN SURAT KEPUTUSAN (SK) P2SP RESMI */}
          {p2spActiveView === 'sk' && (
            <div className="space-y-4 animate-fade-in">
              <P2spSkDocument
                school={formData}
                onPrint={(doc) => (onOpenPrintModal ? onOpenPrintModal(doc) : window.print())}
              />
            </div>
          )}

          {/* VIEW 4: NASKAH DOKUMEN SURAT KEPUTUSAN (SK) TIM TEKNIS RESMI */}
          {p2spActiveView === 'sk_tim_teknis' && (
            <div className="space-y-4 animate-fade-in">
              {/* Header Action Bar */}
              <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="font-bold text-sm tracking-wide">
                    📜 NASKAH SURAT KEPUTUSAN (SK) TIM TEKNIS PELAKSANA
                  </h4>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    Format Standar Revitalisasi Satuan Pendidikan (4 Halaman Termasuk Lampiran 1, 2, & 3).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => (onOpenPrintModal ? onOpenPrintModal('SK_TIM_TEKNIS') : window.print())}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak SK Tim Teknis (PDF)</span>
                </button>
              </div>

              {/* Document Paper Preview */}
              <div className="bg-slate-200 p-4 sm:p-8 rounded-2xl overflow-x-auto flex justify-center">
                <div className="max-w-[210mm] w-full bg-white shadow-xl rounded-lg">
                  <SkTimTeknisDocument school={formData} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rekening Bank & Bintek */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            <CreditCard className="w-4 h-4 text-purple-600" />
            Rekening Bank & Bimbingan Teknis (Bintek)
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Bank Operasional</label>
              <input
                type="text"
                value={formData.namaBank}
                onChange={(e) => handleChange('namaBank', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Rekening Bank</label>
              <input
                type="text"
                value={formData.nomorRekening}
                onChange={(e) => handleChange('nomorRekening', e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-800 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pemilik Rekening</label>
              <input
                type="text"
                value={formData.namaRekening}
                onChange={(e) => handleChange('namaRekening', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kota Tempat Bintek</label>
                <input
                  type="text"
                  value={formData.kotaTempatBintek}
                  onChange={(e) => handleChange('kotaTempatBintek', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Bintek</label>
                <input
                  type="text"
                  value={formData.tanggalBintek}
                  onChange={(e) => handleChange('tanggalBintek', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone: Delete School Data */}
      {onDeleteSchool && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 rounded-lg text-rose-600 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-rose-900">Hapus Data Sekolah Ini</h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Menghapus seluruh database sekolah "{school.namaSekolah}" (NPSN: {school.npsn}) beserta seluruh catatan RPD, Kwitansi, BKU, BKT, dan BKB. Data yang sudah dihapus tidak dapat dikembalikan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDeleteSchool}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition shadow-sm shrink-0 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Database Sekolah Ini</span>
          </button>
        </div>
      )}
    </form>
  );
};
