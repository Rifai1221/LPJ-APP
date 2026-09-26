import React, { useRef } from 'react';
import { Printer, Download, X, Layers, FileText, CheckCircle2 } from 'lucide-react';
import {
  SchoolMasterData,
  RpdItem,
  KwitansiDocument,
  WeeklyWageReport,
  BkuTransaction,
  BktTransaction,
  BkbTransaction,
  TaxRecord,
  ProjectProgressWeek,
} from '../types';
import { formatRupiah, formatNumber } from '../utils/formatters';
import { terbilangRupiah } from '../utils/terbilang';
import { toRoman } from '../utils/divisionHelper';
import { getAvailableMonthsForSchool } from '../utils/monthHelper';

import { SkTimTeknisDocument } from './SkTimTeknisDocument';

interface PrintDocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: string; // 'ALL' | 'COVER' | 'RPD' | 'BKU' | 'BKT' | 'BKB' | 'PAJAK' | 'KWITANSI' | 'UPAH' | 'SPB' | 'FAKTUR'
  selectedMonth?: string;
  selectedWeekNum?: number;
  selectedKwitansiId?: string;
  school: SchoolMasterData;
  rpdItems: RpdItem[];
  kwitansiList: KwitansiDocument[];
  wageReports: WeeklyWageReport[];
  bkuList: BkuTransaction[];
  bktList: BktTransaction[];
  bkbList: BkbTransaction[];
  taxRecords: TaxRecord[];
  progressWeeks: ProjectProgressWeek[];
}

const StandardKopSurat: React.FC<{ school: SchoolMasterData }> = ({ school }) => {
  const logoH = `${school.logoHeightPx || 65}px`;
  return (
    <div className="border-b-2 border-slate-900 pb-2 mb-4 font-sans">
      <div className="flex items-center justify-between gap-4">
        {/* Left Logo */}
        <div className="w-20 flex justify-center items-center shrink-0">
          {school.logoLeftUrl && (
            <img
              src={school.logoLeftUrl}
              alt="Logo Kiri"
              style={{ height: logoH }}
              className="w-auto object-contain"
            />
          )}
        </div>

        {/* Center Kop Text */}
        <div className="flex-1 text-center space-y-0.5">
          <p className="font-bold text-[11px] uppercase tracking-wider text-slate-900">
            {school.headerPemerintahText || `PEMERINTAH ${school.kabKota?.toUpperCase() || 'KABUPATEN / KOTA'}`}
          </p>
          <p className="font-bold text-[11px] uppercase tracking-wider text-slate-900">
            {school.dinasPendidikan || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'}
          </p>
          <h2 className="text-base font-black uppercase tracking-wide my-0.5 text-black">
            {school.namaSekolah}
          </h2>
          <p className="text-[9.5px] text-slate-700">
            Alamat: {school.alamat}, {school.kabKota} • NPSN: {school.npsn}
          </p>
        </div>

        {/* Right Logo */}
        <div className="w-20 flex justify-center items-center shrink-0">
          {school.logoRightUrl && (
            <img
              src={school.logoRightUrl}
              alt="Logo Kanan"
              style={{ height: logoH }}
              className="w-auto object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const PrintDocumentViewer: React.FC<PrintDocumentViewerProps> = ({
  isOpen,
  onClose,
  documentType,
  selectedMonth,
  selectedWeekNum,
  selectedKwitansiId,
  school,
  rpdItems,
  kwitansiList,
  wageReports,
  bkuList,
  bktList,
  bkbList,
  taxRecords,
  progressWeeks,
}) => {
  const [selectedDoc, setSelectedDoc] = React.useState<string>(documentType);

  React.useEffect(() => {
    setSelectedDoc(documentType);
  }, [documentType]);

  const docType = selectedDoc;

  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // Filter Kwitansi for single view if selected
  const activeKwitansi = selectedKwitansiId
    ? kwitansiList.find((k) => k.id === selectedKwitansiId) || kwitansiList[0]
    : kwitansiList[0];

  const months = getAvailableMonthsForSchool(school, [bkuList, bktList, bkbList, kwitansiList, taxRecords]).filter((m) => m !== 'ALL');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col overflow-hidden">
      {/* Top Modal Controls */}
      <div className="bg-slate-900 text-white p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-lg">
            <Printer className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Pratinjau Dokumen LPJ Standar Dinas Pendidikan</h3>
            <p className="text-xs text-slate-400">
              Dokumen siap cetak (Format A4 / Folio F4). Gunakan pemilih dokumen di sebelah kanan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={docType}
            onChange={(e) => setSelectedDoc(e.target.value)}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs border border-slate-700 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">📁 Seluruh Dokumen LPJ Lengkap</option>
            <option value="SK_P2SP">📜 SK Pembentukan Panitia P2SP</option>
            <option value="SK_TIM_TEKNIS">📜 SK Tim Teknis Pelaksana</option>
            <option value="BAGAN_STRUKTUR">📊 Bagan Struktur Organisasi P2SP</option>
            <option value="COVER">📕 Cover LPJ</option>
            <option value="RPD">📑 Rencana Penggunaan Dana (RPD)</option>
            <option value="BKU">📒 Buku Kas Umum (BKU)</option>
            <option value="BKT">📙 Buku Kas Tunai (BKT)</option>
            <option value="BKB">📗 Buku Kas Bank (BKB)</option>
            <option value="KWITANSI">🧾 Kwitansi Bukti Pembayaran</option>
            <option value="SPB">📋 Surat Permintaan Bayar (SPB)</option>
            <option value="UPAH">👥 Laporan Upah Kerja Mingguan</option>
            <option value="PROGRESS">📈 Laporan Kemajuan Fisik & Bobot</option>
            <option value="FOTO_PROGRESS">📷 Dokumentasi Foto Fisik Mingguan</option>
            <option value="PAJAK">🏛️ Rekapitulasi Pajak</option>
          </select>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Dokumen</span>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Area Scroll Wrapper */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-300 print:p-0 print:bg-white print:overflow-visible flex justify-center">
        <div
          ref={printAreaRef}
          className="print-container bg-white text-slate-900 w-full max-w-[210mm] shadow-2xl print:shadow-none print:max-w-none print:w-full space-y-8 print:space-y-0"
        >
          {/* ========================================================
              1. COVER DOKUMEN LPJ
             ======================================================== */}
          {(docType === 'ALL' || docType === 'COVER') && (
            <div className="page-break bg-white p-12 min-h-[297mm] flex flex-col justify-between border border-slate-300 print:border-none">
              {/* Header Cover */}
              <div className="text-center space-y-4 pt-4">
                {/* Logo Tut Wuri Handayani */}
                <div className="w-28 h-28 mx-auto flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-blue-800">
                    <circle cx="50" cy="50" r="46" fill="#0052cc" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="50" cy="50" r="43" fill="#ffffff" />
                    <circle cx="50" cy="50" r="39" fill="#0052cc" />
                    <path
                      d="M50 16 L57 32 L74 34 L62 46 L65 63 L50 54 L35 63 L38 46 L26 34 L43 32 Z"
                      fill="#ffd700"
                    />
                    <path
                      d="M50 35 L40 55 L60 55 Z"
                      fill="#ffffff"
                    />
                    <circle cx="50" cy="42" r="5" fill="#ffd700" />
                    <text x="50" y="82" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#ffffff" letterSpacing="1">
                      TUT WURI HANDAYANI
                    </text>
                  </svg>
                </div>

                <div className="space-y-1 text-slate-900 font-bold uppercase tracking-wider text-xs sm:text-sm font-sans">
                  <p>KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH</p>
                  <p>DIREKTORAT JENDERAL PENDIDIKAN ANAK USIA DINI,</p>
                  <p>PENDIDIKAN DASAR, DAN PENDIDIKAN MENENGAH</p>
                  <p className="text-[11px] font-normal normal-case text-slate-700">
                    Jalan Jenderal Sudirman, Senayan, Jakarta 10270
                  </p>
                </div>
              </div>

              {/* Title Dokumen */}
              <div className="text-center my-12 space-y-3 font-sans">
                <h3 className="text-base font-extrabold tracking-widest uppercase text-slate-900">
                  DOKUMEN
                </h3>
                <h1 className="text-xl sm:text-2xl font-black uppercase text-slate-900 tracking-tight leading-snug">
                  LAPORAN PERTANGGUNGJAWABAN DANA<br />
                  PROGRAM REVITALISASI SEKOLAH<br />
                  TAHUN {school.tahunAnggaran}
                </h1>
              </div>

              {/* School Info Box */}
              <div className="max-w-md mx-auto w-full my-6 text-xs sm:text-sm font-sans space-y-2 border-t border-b border-slate-400 py-4">
                <div className="grid grid-cols-12 gap-2">
                  <span className="col-span-4 font-bold text-slate-800">NAMA SEKOLAH</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-7 font-bold text-slate-900">{school.namaSekolah}</span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <span className="col-span-4 font-bold text-slate-800">NPSN</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-7 font-mono font-bold text-slate-900">{school.npsn}</span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <span className="col-span-4 font-bold text-slate-800">PEKERJAAN</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-7 font-semibold text-slate-900">{school.pekerjaan}</span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <span className="col-span-4 font-bold text-slate-800">LOKASI</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-7 font-semibold text-slate-900">{school.kabKota}</span>
                </div>
              </div>

              {/* Footer Cover */}
              <div className="text-center space-y-1 font-sans font-bold uppercase pb-4">
                <p className="text-xs sm:text-sm">{school.dinasPendidikan}</p>
                <p className="text-xs sm:text-sm">{school.kabKota}</p>
                <p className="text-xs sm:text-sm">TAHUN {school.tahunAnggaran}</p>
              </div>
            </div>
          )}

          {/* ========================================================
              2. FORM PENGISIAN MASTER DATA
             ======================================================== */}
          {(docType === 'ALL' || docType === 'COVER') && (
            <div className="page-break bg-white p-12 min-h-[297mm] font-sans text-xs space-y-6 border border-slate-300 print:border-none">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 text-center border-b border-slate-400 pb-2">
                FORM PENGISIAN DATA MASTER KEGIATAN
              </h3>

              <div className="space-y-2.5 max-w-lg mx-auto bg-amber-50/40 p-6 rounded border border-amber-200">
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">Program</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 font-bold text-slate-900">{school.program}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">Pekerjaan</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 font-bold text-slate-900">{school.pekerjaan}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">NPSN</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 font-mono font-bold text-slate-900">{school.npsn}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">Nama Sekolah</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 font-bold text-slate-900">{school.namaSekolah}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">Kab / Kota</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 text-slate-900">{school.kabKota}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">Provinsi</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 text-slate-900">{school.provinsi}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">Nama Kepala Sekolah</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 font-bold text-slate-900">{school.namaKepalaSekolah}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">NIP Kepala Sekolah</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 font-mono text-slate-900">{school.nipKepalaSekolah}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">Perencana Teknis</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 text-slate-900">{school.namaPerencana}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">Pengawas Teknis</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 text-slate-900">{school.namaPengawas}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">Ketua P2SP</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 font-bold text-slate-900">{school.namaKetuaP2SP}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">Bendahara</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 font-bold text-slate-900">{school.namaBendahara}</span>
                </div>
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                  <span className="col-span-5 font-semibold text-slate-700">Kepala Pelaksana</span>
                  <span className="col-span-1">:</span>
                  <span className="col-span-6 font-bold text-slate-900">{school.namaKepalaPelaksana || school.namaPelaksana}</span>
                </div>
                {school.namaKeamanan && (
                  <div className="grid grid-cols-12 gap-1 py-1 border-b border-amber-100">
                    <span className="col-span-5 font-semibold text-slate-700">Petugas Keamanan</span>
                    <span className="col-span-1">:</span>
                    <span className="col-span-6 font-bold text-slate-900">{school.namaKeamanan}</span>
                  </div>
                )}
                {school.namaFasilitator && (
                  <div className="grid grid-cols-12 gap-1 py-1">
                    <span className="col-span-5 font-semibold text-slate-700">Fasilitator Teknis</span>
                    <span className="col-span-1">:</span>
                    <span className="col-span-6 font-bold text-slate-900">{school.namaFasilitator}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              2B. SURAT KEPUTUSAN (SK) PEMBENTUKAN PANITIA P2SP
             ======================================================== */}
          {(docType === 'ALL' || docType === 'SK_P2SP') && (
            <div className="page-break bg-white p-10 min-h-[297mm] font-serif text-[11px] leading-relaxed space-y-4 border border-slate-300 print:border-none">
              {/* Kop Surat */}
              <StandardKopSurat school={school} />

              {/* Judul & Nomor SK */}
              <div className="text-center space-y-1 pt-1">
                <h3 className="font-bold uppercase tracking-wider text-xs underline font-sans">
                  SURAT KEPUTUSAN KEPALA {school.namaSekolah}
                </h3>
                <p className="font-sans text-[10px] font-semibold">
                  NOMOR : {school.nomorSkP2SP || '421.2/028/SK-P2SP/2025'}
                </p>
                <p className="font-bold uppercase text-[10px] pt-0.5">
                  TENTANG
                </p>
                <p className="font-bold uppercase text-[10px] max-w-lg mx-auto font-sans leading-tight">
                  {school.tentangSkP2SP || 'PEMBENTUKAN PANITIA PEMBANGUNAN SATUAN PENDIDIKAN (P2SP) PELAKSANA BANTUAN OPERASIONAL DAK FISIK TAHUN ANGGARAN ' + school.tahunAnggaran}
                </p>
              </div>

              {/* Konsiderans */}
              <div className="space-y-2 text-[10px] leading-normal pt-1">
                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-2 font-bold font-sans">Menimbang</span>
                  <span className="col-span-1 text-center font-sans">:</span>
                  <div className="col-span-9 space-y-1">
                    <p>a. bahwa dalam rangka peningkatan mutu sarana dan prasarana pendidikan melalui program {school.program} pekerjaan {school.pekerjaan};</p>
                    <p>b. bahwa agar pelaksanaan swakelola pembangunan berjalan tertib, tepat waktu, transparan, akuntabel, dan sesuai Petunjuk Teknis, perlu dibentuk Panitia Pembangunan Satuan Pendidikan (P2SP);</p>
                    <p>c. bahwa nama-nama yang tercantum dalam Lampiran Keputusan ini dipandang cakap dan memenuhi syarat untuk ditetapkan sebagai Panitia P2SP.</p>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-2 font-bold font-sans">Mengingat</span>
                  <span className="col-span-1 text-center font-sans">:</span>
                  <div className="col-span-9 space-y-0.5 text-[9.5px]">
                    <p>1. Undang-Undang Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional;</p>
                    <p>2. Peraturan Presiden Nomor 16 Tahun 2018 jo. Perpres No. 12 Tahun 2021 tentang Pengadaan Barang/Jasa Pemerintah;</p>
                    <p>3. Permendikbudristek tentang Petunjuk Operasional Pengelolaan DAK Fisik Bidang Pendidikan Tahun {school.tahunAnggaran};</p>
                    <p>4. Dokumen Pelaksanaan Anggaran (DPA) Satuan Pendidikan Tahun Anggaran {school.tahunAnggaran}.</p>
                  </div>
                </div>

                <div className="text-center font-bold uppercase font-sans text-[10px] pt-1 tracking-wider">
                  MEMUTUSKAN :
                </div>

                <div className="grid grid-cols-12 gap-1">
                  <span className="col-span-2 font-bold font-sans">Menetapkan</span>
                  <span className="col-span-1 text-center font-sans">:</span>
                  <div className="col-span-9 space-y-1.5">
                    <p><strong>KESATU : </strong>Membentuk Panitia Pembangunan Satuan Pendidikan (P2SP) pada {school.namaSekolah} Tahun Anggaran {school.tahunAnggaran} dengan susunan personalia sebagaimana tercantum dalam Lampiran Keputusan ini.</p>
                    <p><strong>KEDUA : </strong>Panitia sebagaimana dimaksud Diktum KESATU bertugas merencanakan, melaksanakan, mengawasi, serta mempertanggungjawabkan pelaksanaan fisik dan administrasi keuangan secara swakelola.</p>
                    <p><strong>KETIGA : </strong>Segala biaya yang timbul dibebankan pada Anggaran Bantuan Pemerintah DAK Fisik Tahun Anggaran {school.tahunAnggaran}.</p>
                    <p><strong>KEEMPAT : </strong>Keputusan ini mulai berlaku sejak tanggal ditetapkan.</p>
                  </div>
                </div>
              </div>

              {/* Tanda Tangan */}
              <div className="pt-4 flex justify-end font-sans text-[10px]">
                <div className="text-center w-64 space-y-0.5">
                  <p>Ditetapkan di : {school.kabKota}</p>
                  <p>Pada tanggal : {school.tanggalSkP2SP || '15 Juli 2025'}</p>
                  <p className="font-bold uppercase pt-1">Kepala {school.namaSekolah}</p>
                  <div className="h-14" />
                  <p className="font-bold uppercase underline">{school.namaKepalaSekolah}</p>
                  <p className="font-mono text-[9px]">NIP. {school.nipKepalaSekolah}</p>
                </div>
              </div>

              {/* Lampiran Susunan Personalia */}
              <div className="pt-4 border-t border-black font-sans space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[9px]">LAMPIRAN : KEPUTUSAN KEPALA {school.namaSekolah}</span>
                  <span className="text-[9px] font-mono">NOMOR : {school.nomorSkP2SP || '421.2/028/SK-P2SP/2025'}</span>
                </div>
                <h4 className="text-center font-bold uppercase text-[10px]">
                  SUSUNAN PERSONALIA PANITIA PEMBANGUNAN SATUAN PENDIDIKAN (P2SP)
                </h4>

                <table className="w-full border-collapse border border-black text-[9px]">
                  <thead>
                    <tr className="bg-slate-100 text-center font-bold">
                      <th className="border border-black p-1 w-6">NO</th>
                      <th className="border border-black p-1 text-left">JABATAN DALAM PANITIA</th>
                      <th className="border border-black p-1 text-left">NAMA LENGKAP</th>
                      <th className="border border-black p-1 text-left">UNSUR / KETERANGAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black p-1 text-center font-mono">1</td>
                      <td className="border border-black p-1 font-bold">Penanggung Jawab</td>
                      <td className="border border-black p-1 font-bold uppercase">{school.namaKepalaSekolah}</td>
                      <td className="border border-black p-1">Kepala Sekolah (NIP. {school.nipKepalaSekolah})</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1 text-center font-mono">2</td>
                      <td className="border border-black p-1 font-bold">Ketua Panitia (P2SP)</td>
                      <td className="border border-black p-1 font-bold uppercase">{school.namaKetuaP2SP}</td>
                      <td className="border border-black p-1">{school.unsurKetuaP2SP || 'Komite Sekolah / Tokoh Masyarakat'}</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1 text-center font-mono">3</td>
                      <td className="border border-black p-1 font-bold">Sekretaris</td>
                      <td className="border border-black p-1 uppercase">{school.namaSekretaris || 'NURUL AINI, S.Pd'}</td>
                      <td className="border border-black p-1">{school.jabatanSekretaris || 'Guru / Tenaga Administrasi'}</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1 text-center font-mono">4</td>
                      <td className="border border-black p-1 font-bold">Bendahara</td>
                      <td className="border border-black p-1 uppercase">{school.namaBendahara}</td>
                      <td className="border border-black p-1">Bendahara P2SP (NIP. {school.nipBendahara})</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1 text-center font-mono">5</td>
                      <td className="border border-black p-1 font-bold">Tim Teknis Perencana</td>
                      <td className="border border-black p-1 uppercase">{school.namaPerencana} ({school.anggotaPerencana || 'Rahmat Hidayat, A.Md'})</td>
                      <td className="border border-black p-1">{school.jabatanPerencana || 'Arsitek / Tenaga Ahli Teknis'}</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1 text-center font-mono">6</td>
                      <td className="border border-black p-1 font-bold">Tim Teknis Pengawas</td>
                      <td className="border border-black p-1 uppercase">{school.namaPengawas} ({school.anggotaPengawas || 'H. Mansyur'})</td>
                      <td className="border border-black p-1">{school.jabatanPengawas || 'Tenaga Ahli Pengawas Lapangan'}</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1 text-center font-mono">7</td>
                      <td className="border border-black p-1 font-bold">Tim Pelaksana Lapangan</td>
                      <td className="border border-black p-1 uppercase">
                        {school.namaKepalaPelaksana || school.namaPelaksana} (Logistik: {school.namaLogistik || 'Kamaruddin'} • Mandor: {school.namaMandor || 'Budiman'} • Keamanan: {school.namaKeamanan || 'Syamsuddin'})
                      </td>
                      <td className="border border-black p-1">{school.jabatanPelaksana || 'Ketua / Kepala Pelaksana Lapangan'}</td>
                    </tr>
                    {school.namaKeamanan && (
                      <tr>
                        <td className="border border-black p-1 text-center font-mono">8</td>
                        <td className="border border-black p-1 font-bold">Petugas Keamanan</td>
                        <td className="border border-black p-1 uppercase font-semibold">{school.namaKeamanan}</td>
                        <td className="border border-black p-1">{school.jabatanKeamanan || 'Petugas Keamanan & Ketertiban Lapangan'}</td>
                      </tr>
                    )}
                    {school.namaFasilitator && (
                      <tr>
                        <td className="border border-black p-1 text-center font-mono">{school.namaKeamanan ? '9' : '8'}</td>
                        <td className="border border-black p-1 font-bold">Fasilitator Teknis</td>
                        <td className="border border-black p-1 uppercase font-semibold">{school.namaFasilitator}</td>
                        <td className="border border-black p-1">
                          {school.jabatanFasilitator || 'Fasilitator Teknis / Pendamping Dinas'}
                          {school.nipFasilitator ? ` (NIP. ${school.nipFasilitator})` : ''}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================
              2B2. SURAT KEPUTUSAN (SK) TIM TEKNIS PELAKSANA
             ======================================================== */}
          {(docType === 'ALL' || docType === 'SK_TIM_TEKNIS') && (
            <SkTimTeknisDocument school={school} />
          )}

          {/* ========================================================
              2C. BAGAN STRUKTUR ORGANISASI PANITIA P2SP
             ======================================================== */}
          {(docType === 'ALL' || docType === 'BAGAN_STRUKTUR') && (
            <div className="page-break bg-white p-8 min-h-[297mm] font-sans text-slate-900 space-y-5 border border-slate-300 print:border-none">
              {/* Header Bagan */}
              <div className="text-center border-b-2 border-black pb-2 space-y-0.5">
                <p className="font-bold text-[10px] uppercase">{school.dinasPendidikan || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'}</p>
                <h3 className="text-sm font-black uppercase tracking-wider text-black">
                  BAGAN STRUKTUR ORGANISASI PANITIA PEMBANGUNAN SATUAN PENDIDIKAN (P2SP)
                </h3>
                <p className="text-[10px] font-bold text-slate-800">
                  {school.namaSekolah} • TAHUN ANGGARAN {school.tahunAnggaran}
                </p>
                <p className="text-[9px] text-slate-600">
                  Pekerjaan: {school.pekerjaan} • SK No: {school.nomorSkP2SP || '421.2/028/SK-P2SP/2025'}
                </p>
              </div>

              {/* Organizational Tree Chart for Print */}
              <div className="flex flex-col items-center pt-2 space-y-1">

                {/* Level 1: PENANGGUNG JAWAB */}
                <div className="w-72 border-2 border-black p-2 text-center rounded bg-slate-50">
                  <span className="font-bold uppercase text-[9px] tracking-wider block bg-black text-white py-0.5 mb-1">
                    PENANGGUNG JAWAB
                  </span>
                  <p className="font-black text-[11px] uppercase">{school.namaKepalaSekolah}</p>
                  <p className="text-[9px] font-mono">NIP. {school.nipKepalaSekolah}</p>
                  <p className="text-[8.5px] italic text-slate-600">Kepala {school.namaSekolah}</p>
                </div>

                {/* Vertical Line */}
                <div className="w-0.5 h-6 bg-black" />

                {/* Level 2: KETUA & STAFF WINGS */}
                <div className="w-full flex items-center justify-center">
                  {/* Wing Kiri: SEKRETARIS */}
                  <div className="w-48 border border-black p-1.5 text-center rounded bg-slate-50">
                    <span className="font-bold uppercase text-[8.5px] block border-b border-black pb-0.5 mb-1">
                      SEKRETARIS
                    </span>
                    <p className="font-bold text-[10px] uppercase">{school.namaSekretaris || 'NURUL AINI, S.Pd'}</p>
                    <p className="text-[8px]">{school.jabatanSekretaris || 'Guru / Tenaga Administrasi'}</p>
                  </div>

                  {/* Horizontal dash arm */}
                  <div className="w-8 h-0.5 bg-black border-t border-dashed border-black" />

                  {/* Node Tengah: KETUA P2SP */}
                  <div className="w-56 border-2 border-black p-2 text-center rounded bg-slate-100">
                    <span className="font-bold uppercase text-[9px] tracking-wider block bg-black text-white py-0.5 mb-1">
                      KETUA PANITIA (P2SP)
                    </span>
                    <p className="font-black text-[11px] uppercase">{school.namaKetuaP2SP}</p>
                    <p className="text-[8.5px] font-semibold">{school.jabatanKetuaP2SP || 'Ketua Komite Sekolah'}</p>
                    <p className="text-[8px] text-slate-600">Unsur: {school.unsurKetuaP2SP || 'Komite / Tokoh Masyarakat'}</p>
                  </div>

                  {/* Horizontal dash arm */}
                  <div className="w-8 h-0.5 bg-black border-t border-dashed border-black" />

                  {/* Wing Kanan: BENDAHARA */}
                  <div className="w-48 border border-black p-1.5 text-center rounded bg-slate-50">
                    <span className="font-bold uppercase text-[8.5px] block border-b border-black pb-0.5 mb-1">
                      BENDAHARA
                    </span>
                    <p className="font-bold text-[10px] uppercase">{school.namaBendahara}</p>
                    <p className="text-[8px] font-mono">{school.nipBendahara ? 'NIP. ' + school.nipBendahara : 'Bendahara Bantuan'}</p>
                  </div>
                </div>

                {/* Vertical Central Line down to 3 teams */}
                <div className="w-0.5 h-6 bg-black" />

                {/* Horizontal Bar for 3 teams */}
                <div className="w-[85%] h-0.5 bg-black relative">
                  <div className="absolute left-0 top-0 w-0.5 h-4 bg-black" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-0.5 h-4 bg-black" />
                  <div className="absolute right-0 top-0 w-0.5 h-4 bg-black" />
                </div>

                {/* Level 3: Tiga Tim Kerja */}
                <div className="w-full grid grid-cols-3 gap-3 pt-4 text-left">
                  {/* Tim Perencana */}
                  <div className="border border-black p-2 rounded bg-slate-50 flex flex-col justify-between">
                    <div>
                      <span className="font-bold uppercase text-[8.5px] block bg-slate-200 text-black px-1 py-0.5 text-center border-b border-black mb-1">
                        TIM TEKNIS PERENCANA
                      </span>
                      <p className="font-bold text-[10px] uppercase">{school.namaPerencana}</p>
                      <p className="text-[8px] text-slate-600">{school.jabatanPerencana || 'Tenaga Ahli Perencana'}</p>
                      <p className="text-[8px] font-medium pt-1">Anggota: {school.anggotaPerencana || 'Rahmat Hidayat, A.Md'}</p>
                    </div>
                    <div className="mt-2 pt-1 border-t border-slate-300 text-[7.5px] text-slate-600">
                      Tugas: Rencana Gambar, RAB/RPD, Kurva S
                    </div>
                  </div>

                  {/* Tim Pengawas */}
                  <div className="border border-black p-2 rounded bg-slate-50 flex flex-col justify-between">
                    <div>
                      <span className="font-bold uppercase text-[8.5px] block bg-slate-200 text-black px-1 py-0.5 text-center border-b border-black mb-1">
                        TIM TEKNIS PENGAWAS
                      </span>
                      <p className="font-bold text-[10px] uppercase">{school.namaPengawas}</p>
                      <p className="text-[8px] text-slate-600">{school.jabatanPengawas || 'Tenaga Ahli Pengawas'}</p>
                      <p className="text-[8px] font-medium pt-1">Anggota: {school.anggotaPengawas || 'H. Mansyur'}</p>
                    </div>
                    <div className="mt-2 pt-1 border-t border-slate-300 text-[7.5px] text-slate-600">
                      Tugas: Mutu Bahan, Opname Prestasi Fisik Mingguan
                    </div>
                  </div>

                  {/* Tim Pelaksana */}
                  <div className="border border-black p-2 rounded bg-slate-50 flex flex-col justify-between">
                    <div>
                      <span className="font-bold uppercase text-[8.5px] block bg-slate-200 text-black px-1 py-0.5 text-center border-b border-black mb-1">
                        TIM PELAKSANA KEGIATAN
                      </span>
                      <p className="font-bold text-[10px] uppercase">{school.namaKepalaPelaksana || school.namaPelaksana}</p>
                      <p className="text-[8px] text-slate-600">{school.jabatanPelaksana || 'Ketua / Kepala Pelaksana'}</p>
                      <p className="text-[8px] font-medium pt-1">
                        Keamanan: {school.namaKeamanan || 'Syamsuddin'} • Logistik: {school.namaLogistik || 'Kamaruddin'} • Mandor: {school.namaMandor || 'Budiman'}
                      </p>
                    </div>
                    <div className="mt-2 pt-1 border-t border-slate-300 text-[7.5px] text-slate-600">
                      Tugas: Pelaksanaan Lapangan, Logistik, Keamanan Proyek
                    </div>
                  </div>
                </div>

              </div>

              {/* Legenda & Tanda Tangan Pengesahan Bagan */}
              <div className="pt-6 grid grid-cols-2 gap-4 text-[9px] border-t border-black">
                <div className="space-y-1">
                  <p className="font-bold">Keterangan Garis Hubungan Kerja:</p>
                  <p>─── : Garis Komando / Pengarahan</p>
                  <p>┄┄┄ : Garis Koordinasi & Konsultasi Teknis</p>
                </div>
                <div className="text-center space-y-0.5">
                  <p>Ditetapkan di: {school.kabKota}, {school.tanggalSkP2SP || '15 Juli 2025'}</p>
                  <p className="font-bold uppercase">Kepala Satuan Pendidikan</p>
                  <div className="h-12" />
                  <p className="font-bold uppercase underline">{school.namaKepalaSekolah}</p>
                  <p className="font-mono text-[8.5px]">NIP. {school.nipKepalaSekolah}</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              3. RENCANA PENGGUNAAN DANA (RPD)
             ======================================================== */}
          {(docType === 'ALL' || docType === 'RPD') && (
            <div className="page-break bg-white p-8 min-h-[297mm] font-sans text-[10px] space-y-4 border border-slate-300 print:border-none">
              <div className="text-center font-bold uppercase space-y-1">
                <h3 className="text-xs">RENCANA PENGGUNAAN DANA (RPD)</h3>
                <h4 className="text-xs">{school.pekerjaan}</h4>
              </div>

              <div className="space-y-0.5 text-[10px]">
                <p>Nama Satuan Pendidikan : <strong>{school.namaSekolah}</strong></p>
                <p>Alamat : {school.alamat}, {school.kabKota}</p>
                <p>Periode Waktu Penggunaan Dana : {school.periodePenggunaan}</p>
              </div>

              <table className="w-full border-collapse border border-black text-[9px]">
                <thead>
                  <tr className="bg-slate-100 text-center font-bold">
                    <th rowSpan={2} className="border border-black p-1 w-6">NO</th>
                    <th rowSpan={2} className="border border-black p-1 text-left">URAIAN</th>
                    <th rowSpan={2} className="border border-black p-1 w-12">VOLUME 100%</th>
                    <th colSpan={2} className="border border-black p-1">TERMIN (70%)</th>
                    <th colSpan={2} className="border border-black p-1">TERMIN (30%)</th>
                    <th rowSpan={2} className="border border-black p-1">HARGA SATUAN (Rp)</th>
                    <th colSpan={2} className="border border-black p-1">TERMIN JUMLAH</th>
                    <th rowSpan={2} className="border border-black p-1">JUMLAH ANGGARAN (Rp)</th>
                  </tr>
                  <tr className="bg-slate-100 text-center font-bold">
                    <th className="border border-black p-0.5">VOL</th>
                    <th className="border border-black p-0.5">SAT</th>
                    <th className="border border-black p-0.5">VOL</th>
                    <th className="border border-black p-0.5">SAT</th>
                    <th className="border border-black p-0.5">70%</th>
                    <th className="border border-black p-0.5">30%</th>
                  </tr>
                </thead>
                <tbody>
                  {rpdItems.map((it, idx) => (
                    <tr key={it.id}>
                      <td className="border border-black p-1 text-center font-mono">{idx + 1}</td>
                      <td className="border border-black p-1">{it.uraian}</td>
                      <td className="border border-black p-1 text-right">{formatNumber(it.volume100)}</td>
                      <td className="border border-black p-1 text-right">{formatNumber(it.volumeTermin1)}</td>
                      <td className="border border-black p-1 text-center">{it.satuan}</td>
                      <td className="border border-black p-1 text-right">{formatNumber(it.volumeTermin2)}</td>
                      <td className="border border-black p-1 text-center">{it.satuan}</td>
                      <td className="border border-black p-1 text-right font-mono">{formatRupiah(it.hargaSatuan, false)}</td>
                      <td className="border border-black p-1 text-right font-mono">{formatRupiah(it.jumlahTermin1, false)}</td>
                      <td className="border border-black p-1 text-right font-mono">{formatRupiah(it.jumlahTermin2, false)}</td>
                      <td className="border border-black p-1 text-right font-mono font-bold">{formatRupiah(it.jumlahAnggaran, false)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-slate-100">
                    <td colSpan={8} className="border border-black p-1 text-right uppercase">JUMLAH TOTAL:</td>
                    <td className="border border-black p-1 text-right font-mono">
                      {formatRupiah(rpdItems.reduce((s, i) => s + i.jumlahTermin1, 0), false)}
                    </td>
                    <td className="border border-black p-1 text-right font-mono">
                      {formatRupiah(rpdItems.reduce((s, i) => s + i.jumlahTermin2, 0), false)}
                    </td>
                    <td className="border border-black p-1 text-right font-mono">
                      {formatRupiah(rpdItems.reduce((s, i) => s + i.jumlahAnggaran, 0), false)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* 4 Signatures */}
              <div className="grid grid-cols-4 gap-2 pt-6 text-center text-[9px] font-sans">
                <div>
                  <p>Menyetujui,</p>
                  <p className="font-bold">Ketua P2SP</p>
                  <div className="h-12" />
                  <p className="font-bold underline uppercase">{school.namaKetuaP2SP}</p>
                </div>
                <div>
                  <p>&nbsp;</p>
                  <p className="font-bold">Tim Teknis (Perencana)</p>
                  <div className="h-12" />
                  <p className="font-bold underline">{school.namaPerencana}</p>
                </div>
                <div>
                  <p>&nbsp;</p>
                  <p className="font-bold">Tim Teknis (Pengawas)</p>
                  <div className="h-12" />
                  <p className="font-bold underline">{school.namaPengawas}</p>
                </div>
                <div>
                  <p>Mengetahui,</p>
                  <p className="font-bold">Kepala Sekolah</p>
                  <div className="h-12" />
                  <p className="font-bold underline">{school.namaKepalaSekolah}</p>
                  <p>NIP. {school.nipKepalaSekolah}</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              4. BUKU KAS UMUM (BKU) BULANAN
             ======================================================== */}
          {(docType === 'ALL' || docType === 'BKU') &&
            months.map((monthName) => {
              if (selectedMonth && selectedMonth !== 'ALL' && selectedMonth !== monthName) {
                return null;
              }
              const monthlyBku = bkuList.filter((b) => b.bulan === monthName);
              if (monthlyBku.length === 0) return null;

              const totalPenerimaan = monthlyBku.reduce((s, b) => s + b.penerimaan, 0);
              const totalPengeluaran = monthlyBku.reduce((s, b) => s + b.pengeluaran, 0);
              const lastBku = monthlyBku[monthlyBku.length - 1];
              const saldoBulan = lastBku?.saldo || 0;

              return (
                <div
                  key={`bku-${monthName}`}
                  className="page-break bg-white p-8 min-h-[297mm] font-sans text-[10px] space-y-4 border border-slate-300 print:border-none"
                >
                  <div className="text-center font-bold uppercase space-y-0.5">
                    <h3 className="text-xs">BUKU KAS UMUM</h3>
                    <h4 className="text-xs font-mono">BULAN : {monthName.toUpperCase()}</h4>
                  </div>

                  <div className="space-y-0.5 text-[9px]">
                    <p>NAMA SEKOLAH : <strong>{school.namaSekolah}</strong></p>
                    <p>PEKERJAAN : {school.pekerjaan}</p>
                    <p>LOKASI : {school.lokasi}</p>
                    <p>KOTA / PROPINSI : {school.kabKota} / {school.provinsi}</p>
                  </div>

                  <table className="w-full border-collapse border border-black text-[9px]">
                    <thead>
                      <tr className="bg-slate-100 text-center font-bold">
                        <th colSpan={3} className="border border-black p-1 bg-slate-200">PENERIMAAN</th>
                        <th colSpan={4} className="border border-black p-1 bg-slate-200">PENARIKAN / PENGELUARAN</th>
                        <th rowSpan={2} className="border border-black p-1 w-24">Saldo (Rp)</th>
                      </tr>
                      <tr className="bg-slate-100 text-center font-bold">
                        <th className="border border-black p-1 w-16">Tanggal</th>
                        <th className="border border-black p-1">Uraian</th>
                        <th className="border border-black p-1 w-20">Jumlah (Rp)</th>
                        <th className="border border-black p-1 w-16">Tanggal</th>
                        <th className="border border-black p-1">Uraian</th>
                        <th className="border border-black p-1 w-16">No. Bukti</th>
                        <th className="border border-black p-1 w-20">Jumlah (Rp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyBku.map((b) => (
                        <tr key={b.id}>
                          <td className="border border-black p-1 text-center font-mono">
                            {b.jenis === 'PENERIMAAN' ? b.tanggal : '-'}
                          </td>
                          <td className="border border-black p-1">
                            {b.jenis === 'PENERIMAAN' ? b.uraian : '-'}
                          </td>
                          <td className="border border-black p-1 text-right font-mono">
                            {b.penerimaan > 0 ? formatRupiah(b.penerimaan, false) : '-'}
                          </td>
                          <td className="border border-black p-1 text-center font-mono">
                            {b.jenis === 'PENGELUARAN' ? b.tanggal : '-'}
                          </td>
                          <td className="border border-black p-1">
                            {b.jenis === 'PENGELUARAN' ? b.uraian : '-'}
                          </td>
                          <td className="border border-black p-1 text-center font-mono text-[8px]">
                            {b.noBukti || '-'}
                          </td>
                          <td className="border border-black p-1 text-right font-mono">
                            {b.pengeluaran > 0 ? formatRupiah(b.pengeluaran, false) : '-'}
                          </td>
                          <td className="border border-black p-1 text-right font-mono font-bold">
                            {formatRupiah(b.saldo || 0, false)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold bg-slate-100">
                        <td colSpan={2} className="border border-black p-1 text-right">DIBULATKAN:</td>
                        <td className="border border-black p-1 text-right font-mono">{formatRupiah(totalPenerimaan, false)}</td>
                        <td colSpan={3} className="border border-black p-1 text-right">TOTAL PENGELUARAN:</td>
                        <td className="border border-black p-1 text-right font-mono">{formatRupiah(totalPengeluaran, false)}</td>
                        <td className="border border-black p-1 text-right font-mono font-bold">{formatRupiah(saldoBulan, false)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Closing Box & Signatures */}
                  <div className="border border-black p-3 text-[9px] space-y-1">
                    <p>Pada hari ini Buku Kas Umum ditutup dengan keadaan/posisi buku sebagai berikut :</p>
                    <div className="grid grid-cols-12 gap-1 font-semibold">
                      <span className="col-span-4">Saldo buku Kas Umum</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-7 font-mono">{formatRupiah(saldoBulan)}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1">
                      <span className="col-span-4">Terdiri dari :</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1 pl-4">
                      <span className="col-span-4">- Saldo BANK</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-7 font-mono">-</span>
                    </div>
                    <div className="grid grid-cols-12 gap-1 pl-4">
                      <span className="col-span-4">- Saldo Kas Tunai</span>
                      <span className="col-span-1">:</span>
                      <span className="col-span-7 font-mono">{formatRupiah(saldoBulan)}</span>
                    </div>
                  </div>

                  {/* 3 Signatures */}
                  <div className="grid grid-cols-3 gap-4 pt-6 text-center text-[9px] font-sans">
                    <div>
                      <p>Menyetujui:</p>
                      <p className="font-bold">Kepala Sekolah</p>
                      <div className="h-12" />
                      <p className="font-bold underline">{school.namaKepalaSekolah}</p>
                      <p>NIP. {school.nipKepalaSekolah}</p>
                    </div>
                    <div>
                      <p>&nbsp;</p>
                      <p className="font-bold">Ketua P2SP</p>
                      <div className="h-12" />
                      <p className="font-bold underline uppercase">{school.namaKetuaP2SP}</p>
                    </div>
                    <div>
                      <p>{school.kabKota}, Akhir {monthName}</p>
                      <p className="font-bold">Bendahara</p>
                      <div className="h-12" />
                      <p className="font-bold underline uppercase">{school.namaBendahara}</p>
                      <p>NIP. {school.nipBendahara}</p>
                    </div>
                  </div>
                </div>
              );
            })}

          {/* ========================================================
              5. REKAPITULASI PAJAK
             ======================================================== */}
          {(docType === 'ALL' || docType === 'PAJAK') && (
            <div className="page-break bg-white p-8 min-h-[297mm] font-sans text-[10px] space-y-4 border border-slate-300 print:border-none">
              <div className="text-center font-bold uppercase space-y-0.5">
                <h3 className="text-xs">REKAPITULASI PENERIMAAN DAN PENYETORAN PAJAK</h3>
                <h4 className="text-xs">{school.pekerjaan}</h4>
                <p className="text-[10px] font-mono">TAHUN ANGGARAN {school.tahunAnggaran}</p>
              </div>

              <table className="w-full border-collapse border border-black text-[9px]">
                <thead>
                  <tr className="bg-slate-100 text-center font-bold">
                    <th rowSpan={2} className="border border-black p-1 w-6">No</th>
                    <th colSpan={2} className="border border-black p-1">Kwitansi</th>
                    <th rowSpan={2} className="border border-black p-1 text-left">Keperluan Pembayaran</th>
                    <th colSpan={4} className="border border-black p-1">Nilai Nominal (Rp)</th>
                    <th colSpan={3} className="border border-black p-1">Pajak Yang Dipungut dan Disetor (Rp)</th>
                  </tr>
                  <tr className="bg-slate-100 text-center font-bold">
                    <th className="border border-black p-0.5 w-14">No</th>
                    <th className="border border-black p-0.5 w-14">Tanggal</th>
                    <th className="border border-black p-0.5">Konstruksi</th>
                    <th className="border border-black p-0.5">Perabot</th>
                    <th className="border border-black p-0.5">Peralatan</th>
                    <th className="border border-black p-0.5">Perencanaan / ADM</th>
                    <th className="border border-black p-0.5">PPN 11%</th>
                    <th className="border border-black p-0.5">PPh Ps 22</th>
                    <th className="border border-black p-0.5">PPh 23</th>
                  </tr>
                </thead>
                <tbody>
                  {taxRecords.map((t, idx) => (
                    <tr key={t.id}>
                      <td className="border border-black p-1 text-center font-mono">{idx + 1}</td>
                      <td className="border border-black p-1 text-center font-mono text-[8px]">{t.noBukti}</td>
                      <td className="border border-black p-1 text-center font-mono text-[8px]">{t.tanggal}</td>
                      <td className="border border-black p-1">{t.keperluan}</td>
                      <td className="border border-black p-1 text-right font-mono">
                        {t.nominalKonstruksi > 0 ? formatRupiah(t.nominalKonstruksi, false) : '-'}
                      </td>
                      <td className="border border-black p-1 text-right font-mono">
                        {t.nominalPerabot > 0 ? formatRupiah(t.nominalPerabot, false) : '-'}
                      </td>
                      <td className="border border-black p-1 text-right font-mono">
                        {t.nominalPeralatan > 0 ? formatRupiah(t.nominalPeralatan, false) : '-'}
                      </td>
                      <td className="border border-black p-1 text-right font-mono">
                        {t.nominalKonsultanAdm > 0 ? formatRupiah(t.nominalKonsultanAdm, false) : '-'}
                      </td>
                      <td className="border border-black p-1 text-right font-mono">
                        {t.ppn11 > 0 ? formatRupiah(t.ppn11, false) : '-'}
                      </td>
                      <td className="border border-black p-1 text-right font-mono">
                        {t.pph22 > 0 ? formatRupiah(t.pph22, false) : '-'}
                      </td>
                      <td className="border border-black p-1 text-right font-mono">
                        {t.pph23 > 0 ? formatRupiah(t.pph23, false) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-slate-100">
                    <td colSpan={4} className="border border-black p-1 text-right uppercase">Jumlah Yang Disetor:</td>
                    <td className="border border-black p-1 text-right font-mono">{formatRupiah(taxRecords.reduce((s, t) => s + t.nominalKonstruksi, 0), false)}</td>
                    <td className="border border-black p-1 text-right font-mono">{formatRupiah(taxRecords.reduce((s, t) => s + t.nominalPerabot, 0), false)}</td>
                    <td className="border border-black p-1 text-right font-mono">{formatRupiah(taxRecords.reduce((s, t) => s + t.nominalPeralatan, 0), false)}</td>
                    <td className="border border-black p-1 text-right font-mono">{formatRupiah(taxRecords.reduce((s, t) => s + t.nominalKonsultanAdm, 0), false)}</td>
                    <td className="border border-black p-1 text-right font-mono">{formatRupiah(taxRecords.reduce((s, t) => s + t.ppn11, 0), false)}</td>
                    <td className="border border-black p-1 text-right font-mono">{formatRupiah(taxRecords.reduce((s, t) => s + t.pph22, 0), false)}</td>
                    <td className="border border-black p-1 text-right font-mono">{formatRupiah(taxRecords.reduce((s, t) => s + t.pph23, 0), false)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="grid grid-cols-3 gap-4 pt-6 text-center text-[9px] font-sans">
                <div>
                  <p>Menyetujui:</p>
                  <p className="font-bold">Kepala Sekolah</p>
                  <div className="h-12" />
                  <p className="font-bold underline">{school.namaKepalaSekolah}</p>
                  <p>NIP. {school.nipKepalaSekolah}</p>
                </div>
                <div>
                  <p>&nbsp;</p>
                  <p className="font-bold">Ketua P2SP</p>
                  <div className="h-12" />
                  <p className="font-bold underline uppercase">{school.namaKetuaP2SP}</p>
                </div>
                <div>
                  <p>{school.kabKota}, 30 Januari 2026</p>
                  <p className="font-bold">Bendahara</p>
                  <div className="h-12" />
                  <p className="font-bold underline uppercase">{school.namaBendahara}</p>
                  <p>NIP. {school.nipBendahara}</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              6. KWITANSI, FAKTUR TOKO & SPB
             ======================================================== */}
          {(docType === 'ALL' || docType === 'KWITANSI' || docType === 'FAKTUR' || docType === 'SPB') && (
            <div className="space-y-8">
              {/* If Single Kwitansi mode, show activeKwitansi; if ALL, loop over all kwitansis */}
              {(docType === 'ALL' ? kwitansiList : [activeKwitansi]).map((kw) => (
                <div key={`kw-doc-group-${kw.id}`} className="space-y-6">
                  {/* KWITANSI RESMI */}
                  {(docType === 'ALL' || docType === 'KWITANSI') && (
                    <div className="page-break bg-white p-10 min-h-[297mm] font-serif text-xs space-y-6 border border-slate-300 print:border-none flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start border-b border-black pb-2">
                          <div className="font-mono text-xs space-y-0.5">
                            <p>No. : <strong>{kw.noBukti}</strong></p>
                            <p>Tahun : <strong>{school.tahunAnggaran}</strong></p>
                          </div>
                          <div className="text-right">
                            <h2 className="text-xl font-bold tracking-widest uppercase underline">KWITANSI</h2>
                          </div>
                        </div>

                        <div className="space-y-3 py-4 text-xs">
                          <div className="grid grid-cols-12 gap-2">
                            <span className="col-span-3">Sudah terima dari</span>
                            <span className="col-span-1">:</span>
                            <span className="col-span-8 font-semibold">Bendahara {school.namaSekolah}</span>
                          </div>
                          <div className="grid grid-cols-12 gap-2">
                            <span className="col-span-3">Uang Banyaknya</span>
                            <span className="col-span-1">:</span>
                            <span className="col-span-8 font-bold italic underline bg-slate-50 p-2 border border-slate-200">
                              {terbilangRupiah(kw.nominal)}
                            </span>
                          </div>
                          <div className="grid grid-cols-12 gap-2">
                            <span className="col-span-3">Y a i t u</span>
                            <span className="col-span-1">:</span>
                            <span className="col-span-8 leading-relaxed">{kw.uraian}</span>
                          </div>
                        </div>

                        <div className="pt-2">
                          <div className="inline-block border-2 border-black px-4 py-2 font-mono font-bold text-sm">
                            Jumlah Rp. {formatNumber(kw.nominal)}
                          </div>
                        </div>
                      </div>

                      {/* Signatures Kwitansi */}
                      <div className="grid grid-cols-2 gap-8 text-center text-xs font-sans pt-8">
                        <div>
                          <p>Setuju dibayar</p>
                          <p className="font-bold">Kepala Sekolah</p>
                          <p>{school.namaSekolah}</p>
                          <div className="h-16" />
                          <p className="font-bold underline">{school.namaKepalaSekolah}</p>
                          <p>NIP. {school.nipKepalaSekolah}</p>
                        </div>
                        <div>
                          <p>{school.kabKota}, {kw.tanggalFormatted}</p>
                          <p className="font-bold">Yang Menerima</p>
                          <div className="h-16" />
                          <p className="font-bold underline uppercase">{kw.penerimaNama}</p>
                          <p>{kw.penerimaPekerjaan}</p>
                          <p className="text-[11px] text-slate-600">{kw.penerimaAlamat}</p>
                        </div>
                      </div>

                      <div className="text-center font-sans text-xs pt-4 border-t border-slate-300">
                        <p>Lunas dibayar</p>
                        <p className="font-bold">Bendahara</p>
                        <div className="h-12" />
                        <p className="font-bold underline uppercase">{school.namaBendahara}</p>
                        <p>NIP. {school.nipBendahara}</p>
                      </div>
                    </div>
                  )}

                  {/* BON / FAKTUR TOKO */}
                  {kw.namaToko && (docType === 'ALL' || docType === 'FAKTUR') && (
                    <div className="page-break bg-white p-10 min-h-[297mm] font-sans text-xs space-y-6 border border-slate-300 print:border-none flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start border-b-2 border-black pb-2">
                          <div>
                            <h3 className="font-bold text-base uppercase tracking-wider">{kw.namaToko}</h3>
                            <p className="text-[11px] text-slate-600">Penyedia Bahan Bangunan & Perlengkapan</p>
                            <p className="text-[11px] text-slate-600">{kw.penerimaAlamat}</p>
                          </div>
                          <div className="text-right text-xs">
                            <p>{school.kabKota}, {kw.tanggalFormatted}</p>
                            <p>Kepada Yth: Ketua P2SP</p>
                            <p className="font-semibold">{school.namaSekolah}</p>
                            <p>di {school.kabKota}</p>
                          </div>
                        </div>

                        <div className="text-center">
                          <h4 className="font-bold text-sm uppercase tracking-wider underline">BON / FAKTUR</h4>
                        </div>

                        <table className="w-full border-collapse border border-black text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-center font-bold">
                              <th className="border border-black p-2 w-28">Banyaknya</th>
                              <th className="border border-black p-2 text-left">Nama Barang</th>
                              <th className="border border-black p-2 text-right w-32">Harga satuan</th>
                              <th className="border border-black p-2 text-right w-36">Jumlah</th>
                            </tr>
                          </thead>
                          <tbody>
                            {kw.items.map((it, iIdx) => (
                              <tr key={iIdx}>
                                <td className="border border-black p-2 text-center font-mono">
                                  {it.volume} {it.satuan}
                                </td>
                                <td className="border border-black p-2 font-medium">{it.namaBarang}</td>
                                <td className="border border-black p-2 text-right font-mono">
                                  {formatRupiah(it.hargaSatuan, false)}
                                </td>
                                <td className="border border-black p-2 text-right font-mono font-bold">
                                  {formatRupiah(it.jumlah, false)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="font-bold bg-slate-100">
                              <td colSpan={3} className="border border-black p-2 text-right uppercase">Jumlah Rp</td>
                              <td className="border border-black p-2 text-right font-mono font-bold">
                                {formatRupiah(kw.nominal, false)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="flex justify-end pt-8">
                        <div className="text-center w-60">
                          <p>Hormat kami,</p>
                          <div className="h-16" />
                          <p className="font-bold underline uppercase tracking-wider">{kw.namaToko}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SURAT PESANAN BARANG (SPB) */}
                  {kw.noSpb && (docType === 'ALL' || docType === 'SPB') && (
                    <div className="page-break bg-white p-10 min-h-[297mm] font-sans text-xs space-y-6 border border-slate-300 print:border-none flex flex-col justify-between">
                      <div className="space-y-4">
                        {/* Kop Pemda & Sekolah */}
                        <div className="text-center border-b-2 border-black pb-2 space-y-0.5">
                          <p className="font-bold uppercase text-xs">PEMERINTAH {school.kabKota.toUpperCase()}</p>
                          <p className="font-bold uppercase text-xs">{school.dinasPendidikan.toUpperCase()}</p>
                          <h3 className="font-extrabold uppercase text-sm">{school.namaSekolah}</h3>
                          <p className="text-[10px] text-slate-600">{school.alamat} {school.kabKota}</p>
                        </div>

                        <div className="flex justify-between items-start text-xs pt-2">
                          <div>
                            <p className="font-mono">Nomor : <strong>{kw.noSpb}</strong></p>
                          </div>
                          <div className="text-right">
                            <p>{school.kabKota}, {kw.tanggalFormatted}</p>
                            <p>Kepada Yth :</p>
                            <p className="font-semibold">Pimpinan Toko {kw.namaToko}</p>
                            <p>di - {school.kabKota}</p>
                          </div>
                        </div>

                        <div className="text-center py-2">
                          <h4 className="font-bold text-sm uppercase tracking-wider underline">PESANAN BARANG</h4>
                        </div>

                        <table className="w-full border-collapse border border-black text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-center font-bold">
                              <th className="border border-black p-2 w-10">No.</th>
                              <th className="border border-black p-2 w-28">Banyaknya</th>
                              <th className="border border-black p-2 text-left">Uraian</th>
                              <th className="border border-black p-2">Keterangan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {kw.items.map((it, iIdx) => (
                              <tr key={iIdx}>
                                <td className="border border-black p-2 text-center font-mono">{iIdx + 1}</td>
                                <td className="border border-black p-2 text-center font-mono">{it.volume} {it.satuan}</td>
                                <td className="border border-black p-2 font-medium">{it.namaBarang}</td>
                                <td className="border border-black p-2 text-center text-slate-600">
                                  {kw.keteranganSpb || `Untuk Keperluan ${school.namaSekolah}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* SPB Signatures */}
                      <div className="grid grid-cols-2 gap-8 text-center text-xs font-sans pt-8">
                        <div>
                          <p>Menyetujui,</p>
                          <p className="font-bold">Kepala Sekolah</p>
                          <p>{school.namaSekolah}</p>
                          <div className="h-16" />
                          <p className="font-bold underline">{school.namaKepalaSekolah}</p>
                          <p>NIP. {school.nipKepalaSekolah}</p>
                        </div>
                        <div>
                          <p>&nbsp;</p>
                          <p className="font-bold">Ketua P2SP</p>
                          <div className="h-16" />
                          <p className="font-bold underline uppercase">{school.namaKetuaP2SP}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ========================================================
              7. DAFTAR PEMBAYARAN UPAH HARIAN (HOK)
             ======================================================== */}
          {(docType === 'ALL' || docType === 'UPAH') && (
            <div className="space-y-8">
              {wageReports
                .filter((r) => !selectedWeekNum || r.mingguKe === selectedWeekNum)
                .map((wage) => (
                  <div
                    key={`print-wage-${wage.id}`}
                    className="page-break bg-white p-8 min-h-[297mm] font-sans text-[10px] space-y-4 border border-slate-300 print:border-none flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="text-center font-bold uppercase space-y-0.5">
                        <h3 className="text-xs">DAFTAR PEMBAYARAN UPAH HARIAN</h3>
                        <p className="text-[11px]">PEKERJAAN {school?.pekerjaan?.toUpperCase() || 'REVITALISASI SEKOLAH'}</p>
                      </div>

                      <div className="flex justify-between text-[10px]">
                        <div>
                          <p>Nama Sekolah : <strong>{school.namaSekolah}</strong></p>
                          <p>NPSN : {school.npsn}</p>
                        </div>
                        <div className="text-right">
                          <p>Bulan : {wage.bulan}</p>
                          <p>Periode : {wage.periodeStart} s/d {wage.periodeEnd}</p>
                        </div>
                      </div>

                      <table className="w-full border-collapse border border-black text-[9px]">
                        <thead>
                          <tr className="bg-slate-100 text-center font-bold">
                            <th rowSpan={2} className="border border-black p-1 w-6">NO</th>
                            <th rowSpan={2} className="border border-black p-1 text-left">Nama</th>
                            <th rowSpan={2} className="border border-black p-1 w-6">Jenis</th>
                            <th colSpan={2} className="border border-black p-0.5">Tempat Tinggal</th>
                            <th rowSpan={2} className="border border-black p-1 w-8">M/T/P</th>
                            <th colSpan={7} className="border border-black p-0.5">Hari Kerja</th>
                            <th rowSpan={2} className="border border-black p-1 w-10">Jumlah HOK</th>
                            <th rowSpan={2} className="border border-black p-1 w-16">Harga Upah</th>
                            <th rowSpan={2} className="border border-black p-1 w-20">Insentif Mingguan</th>
                            <th rowSpan={2} className="border border-black p-1 w-16">Tanda Tangan</th>
                          </tr>
                          <tr className="bg-slate-100 text-center font-bold">
                            <th className="border border-black p-0.5">Luar Desa</th>
                            <th className="border border-black p-0.5">Dalam Desa</th>
                            {['1', '2', '3', '4', '5', '6', '7'].map((d) => (
                              <th key={d} className="border border-black p-0.5 w-4">{d}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {wage.attendance.map((att, idx) => (
                            <tr key={att.workerId}>
                              <td className="border border-black p-1 text-center font-mono">{idx + 1}</td>
                              <td className="border border-black p-1 font-semibold">{att.nama}</td>
                              <td className="border border-black p-1 text-center">{att.jenisKelamin}</td>
                              <td className="border border-black p-1 text-center">{att.domisili === 'Luar Desa' ? '✓' : ''}</td>
                              <td className="border border-black p-1 text-center">{att.domisili === 'Dalam Desa' ? '✓' : ''}</td>
                              <td className="border border-black p-1 text-center font-bold">{att.peran}</td>
                              {att.days.map((d, dIdx) => (
                                <td key={dIdx} className="border border-black p-0.5 text-center font-mono">
                                  {d}
                                </td>
                              ))}
                              <td className="border border-black p-1 text-right font-mono font-bold">{formatNumber(att.hok)}</td>
                              <td className="border border-black p-1 text-right font-mono">{formatRupiah(att.upahHarian, false)}</td>
                              <td className="border border-black p-1 text-right font-mono font-bold">{formatRupiah(att.totalUpah, false)}</td>
                              <td className="border border-black p-1 text-center text-[8px] italic text-slate-500">
                                {idx + 1}. .........
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold bg-slate-100">
                            <td colSpan={13} className="border border-black p-1 text-right uppercase">Total:</td>
                            <td className="border border-black p-1 text-right font-mono font-bold">
                              {formatRupiah(wage.totalUpah, false)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-3 gap-4 pt-6 text-center text-[9px] font-sans">
                      <div>
                        <p>Mengetahui</p>
                        <p className="font-bold">Ketua P2SP</p>
                        <div className="h-12" />
                        <p className="font-bold underline uppercase">{school.namaKetuaP2SP}</p>
                      </div>
                      <div>
                        <p>&nbsp;</p>
                        <p className="font-bold">Ketua Pelaksana</p>
                        <div className="h-12" />
                        <p className="font-bold underline">{school.namaPelaksana}</p>
                      </div>
                      <div>
                        <p>{school.kabKota}, {wage.periodeEnd}</p>
                        <p className="font-bold">Bendahara</p>
                        <div className="h-12" />
                        <p className="font-bold underline uppercase">{school.namaBendahara}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ========================================================
              8. REKAPITULASI PROGRES FISIK MINGGUAN (SPREADSHEET FORMAT & FOTO)
             ======================================================== */}
          {(docType === 'ALL' || docType === 'PROGRESS' || docType === 'FOTO_PROGRESS') && (
            <div className="space-y-8">
              {progressWeeks
                .filter((w) => !selectedWeekNum || w.mingguKe === selectedWeekNum)
                .map((week) => {
                  const divisions = week.divisions || [];
                  const fisikDivs = divisions.filter((d) => d.kategori === 'FISIK');
                  const manDivs = divisions.filter((d) => d.kategori === 'MANAJEMEN');
                  const totBobot = divisions.reduce((s, d) => s + (Number(d.bobotTotal) || 0), 0);
                  const cappedTotBobot = Math.min(100, Math.round(totBobot * 100) / 100);
                  const totLalu = divisions.reduce((s, d) => s + d.prestasiMingguLalu, 0);
                  const totIni = divisions.reduce((s, d) => s + d.prestasiMingguIni, 0);
                  const totSdIni = Math.min(100, Math.round(divisions.reduce((s, d) => s + d.prestasiSdMingguIni, 0) * 100) / 100);
                  const activeRealisasi = week.bobotRealisasi !== undefined && week.bobotRealisasi !== null ? week.bobotRealisasi : totSdIni;
                  const dev = Math.round((activeRealisasi - week.bobotRencana) * 100) / 100;
                  const isFaster = dev >= 0;

                  return (
                    <div key={`week-block-${week.mingguKe}`} className="space-y-8">
                      {/* 8A. Tabel Rekapitulasi Progres Fisik (hanya jika bukan mode cetak HANYA FOTO) */}
                      {docType !== 'FOTO_PROGRESS' && (
                        <div
                          key={`print-prog-${week.mingguKe}`}
                          className="page-break bg-white p-8 min-h-[297mm] font-sans text-[10px] space-y-4 border border-slate-300 print:border-none flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="text-center font-bold uppercase space-y-0.5">
                              <h3 className="text-xs">REKAPITULASI</h3>
                              <h4 className="text-[11px]">{school?.program?.toUpperCase() || ''}</h4>
                              <h4 className="text-[11px]">{school?.pekerjaan?.toUpperCase() || ''}</h4>
                              <h4 className="text-xs font-bold">{school?.namaSekolah || ''}</h4>
                              <p className="text-[10px] font-normal">{(school?.kabKota || '').toUpperCase()} PROPINSI {(school?.provinsi || '').toUpperCase()}</p>
                              <p className="text-[9px] font-mono text-slate-600">PERIODE : {week.periode.toUpperCase()} (MINGGU KE-{week.mingguKe})</p>
                            </div>

                            <table className="w-full border-collapse border border-black text-[9px]">
                              <thead>
                                <tr className="bg-[#0070c0] text-white font-bold text-center text-[9px] border border-black">
                                  <th className="border border-black p-1 w-8">NO.</th>
                                  <th className="border border-black p-1 text-left">URAIAN PEKERJAAN</th>
                                  <th className="border border-black p-1 w-16">BOBOT %</th>
                                  <th className="border border-black p-1 w-20">PRESTASI MINGGU LALU BOBOT %</th>
                                  <th className="border border-black p-1 w-20">PRESTASI MINGGU INI BOBOT %</th>
                                  <th className="border border-black p-1 w-20">PRESTASI S.D MINGGU INI BOBOT %</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="bg-slate-100 font-bold">
                                  <td className="border border-black p-1 text-center"></td>
                                  <td colSpan={5} className="border border-black p-1">REKAPITULASI:</td>
                                </tr>
                                <tr className="bg-slate-50 font-bold">
                                  <td className="border border-black p-1 text-center"></td>
                                  <td colSpan={5} className="border border-black p-1">PEKERJAAN FISIK</td>
                                </tr>
                                {fisikDivs.map((d, idx) => (
                                  <tr key={d.id}>
                                    <td className="border border-black p-1 text-center font-bold">{d.kode || toRoman(idx + 1)}</td>
                                    <td className="border border-black p-1">{d.uraian}</td>
                                    <td className="border border-black p-1 text-right font-mono">{formatNumber(d.bobotTotal, 2, 2)}</td>
                                    <td className="border border-black p-1 text-right font-mono">{d.prestasiMingguLalu > 0 ? formatNumber(d.prestasiMingguLalu, 2, 2) : ''}</td>
                                    <td className="border border-black p-1 text-right font-mono font-bold">{d.prestasiMingguIni > 0 ? formatNumber(d.prestasiMingguIni, 2, 2) : ''}</td>
                                    <td className="border border-black p-1 text-right font-mono font-bold">{d.prestasiSdMingguIni > 0 ? formatNumber(d.prestasiSdMingguIni, 2, 2) : ''}</td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-50 font-bold">
                                  <td className="border border-black p-1 text-center"></td>
                                  <td colSpan={5} className="border border-black p-1">RINCIAN BIAYA MANAJEMEN</td>
                                </tr>
                                {manDivs.map((d, idx) => (
                                  <tr key={d.id}>
                                    <td className="border border-black p-1 text-center font-bold">{d.kode || toRoman(idx + 1)}</td>
                                    <td className="border border-black p-1">{d.uraian}</td>
                                    <td className="border border-black p-1 text-right font-mono">{formatNumber(d.bobotTotal, 2, 2)}</td>
                                    <td className="border border-black p-1 text-right font-mono">{d.prestasiMingguLalu > 0 ? formatNumber(d.prestasiMingguLalu, 2, 2) : ''}</td>
                                    <td className="border border-black p-1 text-right font-mono font-bold">{d.prestasiMingguIni > 0 ? formatNumber(d.prestasiMingguIni, 2, 2) : ''}</td>
                                    <td className="border border-black p-1 text-right font-mono font-bold">{d.prestasiSdMingguIni > 0 ? formatNumber(d.prestasiSdMingguIni, 2, 2) : ''}</td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-100 font-bold">
                                  <td className="border border-black p-1 text-center"></td>
                                  <td className="border border-black p-1 text-right uppercase">TOTAL</td>
                                  <td className="border border-black p-1 text-right font-mono font-bold">{formatNumber(cappedTotBobot, 2, 2)}%</td>
                                  <td className="border border-black p-1 text-right font-mono">{totLalu > 0 ? formatNumber(totLalu, 2) : ''}</td>
                                  <td className="border border-black p-1 text-right font-mono font-bold">{totIni > 0 ? formatNumber(totIni, 2) : ''}</td>
                                  <td className="border border-black p-1 text-right font-mono font-bold">{formatNumber(totSdIni, 2)}</td>
                                </tr>
                              </tbody>
                            </table>

                            {/* Bottom notes */}
                            <div className="border border-black p-2.5 text-[9px] space-y-1 font-sans">
                              <p className="font-bold">KETERANGAN</p>
                              <div className="grid grid-cols-12 gap-1 font-semibold">
                                <span className="col-span-5">PRESTASI PELAKSANAAN (REALISASI)</span>
                                <span className="col-span-1">:</span>
                                <span className="col-span-6 font-mono font-bold">{formatNumber(activeRealisasi, 2)} %</span>
                              </div>
                              <div className="grid grid-cols-12 gap-1">
                                <span className="col-span-5">PRESTASI YANG DIRENCANAKAN (TARGET)</span>
                                <span className="col-span-1">:</span>
                                <span className="col-span-6 font-mono font-bold">{formatNumber(week.bobotRencana, 2)} %</span>
                              </div>
                              <div className="grid grid-cols-12 gap-1">
                                <span className="col-span-5">{isFaster ? 'LEBIH CEPAT DARI RENCANA' : 'TERLAMBAT DARI RENCANA'}</span>
                                <span className="col-span-1">:</span>
                                <span className="col-span-6 font-mono font-bold">{isFaster ? `+${formatNumber(dev, 2)}` : formatNumber(dev, 2)} %</span>
                              </div>
                              <div className="grid grid-cols-12 gap-1 pt-1 border-t border-slate-300">
                                <span className="col-span-5">RENCANA WAKTU PELAKSANAAN</span>
                                <span className="col-span-1">:</span>
                                <span className="col-span-6 font-mono">112 HK</span>
                              </div>
                              <div className="grid grid-cols-12 gap-1">
                                <span className="col-span-5">WAKTU YANG SUDAH DILAKSANAKAN</span>
                                <span className="col-span-1">:</span>
                                <span className="col-span-6 font-mono">{week.mingguKe * 7} HK</span>
                              </div>
                              <div className="grid grid-cols-12 gap-1">
                                <span className="col-span-5">SISA WAKTU PELAKSANAAN</span>
                                <span className="col-span-1">:</span>
                                <span className="col-span-6 font-mono font-bold">{Math.max(0, 112 - week.mingguKe * 7)} HK</span>
                              </div>
                            </div>
                          </div>

                          {/* Signatures */}
                          <div className="grid grid-cols-3 gap-4 pt-6 text-center text-[9px] font-sans">
                            <div>
                              <p>Mengetahui,</p>
                              <p className="font-bold">Kepala Sekolah</p>
                              <div className="h-12" />
                              <p className="font-bold underline">{school.namaKepalaSekolah}</p>
                              <p>NIP. {school.nipKepalaSekolah}</p>
                            </div>
                            <div>
                              <p>&nbsp;</p>
                              <p className="font-bold">Tim Teknis (Pengawas)</p>
                              <div className="h-12" />
                              <p className="font-bold underline">{school.namaPengawas}</p>
                            </div>
                            <div>
                              <p>{school.kabKota}, {week.periode.split(' - ')[1] || 'Januari 2026'}</p>
                              <p className="font-bold">Ketua P2SP</p>
                              <div className="h-12" />
                              <p className="font-bold underline uppercase">{school.namaKetuaP2SP}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 8B. LEMBAR DOKUMENTASI FOTO FISIK MINGGUAN */}
                      {week.photos && week.photos.length > 0 ? (
                        <div
                          key={`print-prog-photo-${week.mingguKe}`}
                          className="page-break bg-white p-8 min-h-[297mm] font-sans text-[10px] space-y-4 border border-slate-300 print:border-none flex flex-col justify-between"
                        >
                          <div className="space-y-4">
                            <div className="text-center font-bold uppercase space-y-0.5 border-b-2 border-black pb-2">
                              <h3 className="text-xs tracking-wider">LEMBAR DOKUMENTASI KEMAJUAN FISIK MINGGUAN</h3>
                              <h4 className="text-[11px]">{school?.program?.toUpperCase() || 'REVITALISASI SEKOLAH'}</h4>
                              <h4 className="text-[11px]">{school?.pekerjaan?.toUpperCase() || ''}</h4>
                              <h4 className="text-xs font-bold">{school?.namaSekolah || ''}</h4>
                              <p className="text-[10px] font-normal">
                                {(school?.kabKota || '').toUpperCase()} PROPINSI {(school?.provinsi || '').toUpperCase()} - TAHUN ANGGARAN {school?.tahunAnggaran || '2025'}
                              </p>
                            </div>

                            <div className="border border-black p-2.5 text-[9px] bg-slate-50/50 space-y-1">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-slate-600">Periode Pekerjaan: </span>
                                  <strong className="font-mono font-bold">Minggu Ke-{week.mingguKe} ({week.periode})</strong>
                                </div>
                                <div className="text-right">
                                  <span className="text-slate-600">Realisasi Fisik s.d Minggu Ini: </span>
                                  <strong className="font-mono font-bold text-slate-900">{formatNumber(totSdIni, 2)}%</strong>
                                  <span className="text-slate-500 font-mono text-[8px] ml-1">
                                    (Rencana: {formatNumber(week.bobotRencana, 2)}% | {isFaster ? `+${formatNumber(dev, 2)}` : formatNumber(dev, 2)}%)
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Photo Cards Grid */}
                            <div className={`grid gap-4 pt-1 ${
                              week.photos.length === 1
                                ? 'grid-cols-1 max-w-xl mx-auto'
                                : 'grid-cols-2'
                            }`}>
                              {week.photos.map((photo, pIdx) => (
                                <div
                                  key={photo.id || pIdx}
                                  className="border border-black flex flex-col bg-white overflow-hidden shadow-2xs"
                                >
                                  <div className={`w-full overflow-hidden bg-slate-100 flex items-center justify-center ${
                                    week.photos!.length === 1 ? 'h-80' : week.photos!.length <= 2 ? 'h-64' : 'h-48'
                                  }`}>
                                    <img
                                      src={photo.url}
                                      alt={photo.caption}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="border-t border-black p-2 text-[9px] space-y-1 bg-slate-50">
                                    <div className="font-bold text-slate-900 leading-snug">
                                      Foto {pIdx + 1}: {photo.caption}
                                    </div>
                                    <div className="flex justify-between items-center text-[8px] text-slate-600 font-mono pt-1 border-t border-slate-200">
                                      <span>Tanggal: {photo.tanggal || week.periode.split(' - ')[1] || '2025'}</span>
                                      <span>Prestasi Fisik: {formatNumber(totSdIni, 2)}%</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Signatures */}
                          <div className="grid grid-cols-3 gap-4 pt-6 text-center text-[9px] font-sans border-t border-slate-300">
                            <div>
                              <p>Mengetahui,</p>
                              <p className="font-bold">Kepala Sekolah</p>
                              <div className="h-12" />
                              <p className="font-bold underline">{school.namaKepalaSekolah}</p>
                              <p>NIP. {school.nipKepalaSekolah}</p>
                            </div>
                            <div>
                              <p>&nbsp;</p>
                              <p className="font-bold">Tim Teknis (Pengawas)</p>
                              <div className="h-12" />
                              <p className="font-bold underline">{school.namaPengawas}</p>
                            </div>
                            <div>
                              <p>{school.kabKota}, {week.periode.split(' - ')[1] || 'Januari 2026'}</p>
                              <p className="font-bold">Ketua P2SP</p>
                              <div className="h-12" />
                              <p className="font-bold underline uppercase">{school.namaKetuaP2SP}</p>
                            </div>
                          </div>
                        </div>
                      ) : docType === 'FOTO_PROGRESS' ? (
                        <div
                          key={`empty-photo-${week.mingguKe}`}
                          className="page-break bg-white p-8 min-h-[297mm] font-sans text-xs flex flex-col items-center justify-center text-center text-slate-500 border border-slate-200 print:border-none space-y-2"
                        >
                          <p className="font-bold text-slate-700">
                            Belum ada foto progres yang diunggah untuk Minggu Ke-{week.mingguKe} ({week.periode})
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-sm">
                            Silakan buka menu "Laporan Mingguan & Bobot" dan klik tombol "Upload Foto Progres" untuk menambahkan dokumentasi.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
