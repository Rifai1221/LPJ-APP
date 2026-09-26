import { SchoolMasterData } from '../types';

const indonesianMonths = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const monthOrderMap: Record<string, number> = {
  januari: 1, jan: 1,
  februari: 2, feb: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8, ags: 8, agt: 8,
  september: 9, sep: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11, nopember: 11, nop: 11,
  desember: 12, des: 12,
};

/**
 * Dynamically expand range of Indonesian months from a period string like
 * "01 Juli 2026 sampai 31 Oktober 2026" or "Juli - November"
 * strictly anchored to defaultYear (from Data Master Sekolah's tahunAnggaran).
 */
export function expandMonthsFromPeriodeString(periodeStr: string, defaultYear = '2026'): string[] {
  const targetYear = parseInt(defaultYear, 10) || 2026;

  if (!periodeStr || typeof periodeStr !== 'string' || periodeStr.trim() === '') {
    // Default fallback: July to November of targetYear
    return [
      `Juli ${targetYear}`,
      `Agustus ${targetYear}`,
      `September ${targetYear}`,
      `Oktober ${targetYear}`,
      `November ${targetYear}`,
    ];
  }

  const monthRegex = /(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|nopember|jan|feb|mar|apr|jun|jul|agu|agt|ags|sep|okt|nov|nop|des)/gi;
  const matches = [...periodeStr.matchAll(monthRegex)];

  if (matches.length === 0) {
    return [
      `Juli ${targetYear}`,
      `Agustus ${targetYear}`,
      `September ${targetYear}`,
      `Oktober ${targetYear}`,
      `November ${targetYear}`,
    ];
  }

  const yearMatches = [...periodeStr.matchAll(/20\d\d/g)];
  let startYear = targetYear;
  let endYear = targetYear;

  if (yearMatches.length >= 2) {
    startYear = parseInt(yearMatches[0][0], 10);
    endYear = parseInt(yearMatches[yearMatches.length - 1][0], 10);
  } else if (yearMatches.length === 1) {
    startYear = parseInt(yearMatches[0][0], 10);
    endYear = startYear;
  }

  // If startYear is less than targetYear (e.g. legacy text in period string), align startYear with targetYear
  if (startYear < targetYear) {
    const diff = targetYear - startYear;
    startYear += diff;
    endYear += diff;
  }

  const startMonthName = matches[0][0].toLowerCase();
  const endMonthName = matches[matches.length - 1][0].toLowerCase();

  const mIdxStart = monthOrderMap[startMonthName] || 7;
  let mIdxEnd = monthOrderMap[endMonthName] || mIdxStart;

  // If end month is earlier than start month, spans to next year (e.g. Nov to Feb)
  if (mIdxEnd < mIdxStart && startYear === endYear) {
    endYear = startYear + 1;
  }

  const results: string[] = [];
  let curYear = startYear;
  let curM = mIdxStart;

  while (curYear < endYear || (curYear === endYear && curM <= mIdxEnd)) {
    results.push(`${indonesianMonths[curM - 1]} ${curYear}`);
    curM++;
    if (curM > 12) {
      curM = 1;
      curYear++;
    }
    if (results.length > 24) break; // Safety cap
  }

  return results;
}

/**
 * Parse Indonesian month name and year automatically from period date string (e.g., '20 Jul - 26 Jul 2026' -> 'Juli 2026')
 */
export function getMonthFromPeriodString(periode: string, defaultYear = '2026'): string {
  if (!periode) return `Juli ${defaultYear}`;

  const lower = periode.toLowerCase();
  
  // Extract year if present
  const yearMatch = periode.match(/20\d\d/);
  const year = yearMatch ? yearMatch[0] : defaultYear;

  // Check month abbreviations / names
  if (lower.includes('jan')) return `Januari ${year}`;
  if (lower.includes('feb')) return `Februari ${year}`;
  if (lower.includes('mar')) return `Maret ${year}`;
  if (lower.includes('apr')) return `April ${year}`;
  if (lower.includes('mei')) return `Mei ${year}`;
  if (lower.includes('jun')) return `Juni ${year}`;
  if (lower.includes('jul')) return `Juli ${year}`;
  if (lower.includes('agu') || lower.includes('agt') || lower.includes('ags')) return `Agustus ${year}`;
  if (lower.includes('sep')) return `September ${year}`;
  if (lower.includes('okt')) return `Oktober ${year}`;
  if (lower.includes('nov') || lower.includes('nop')) return `November ${year}`;
  if (lower.includes('des')) return `Desember ${year}`;

  // Check numeric month if date is formatted like '26/07/2026'
  const dateNumMatch = periode.match(/\d{1,2}\/(\d{1,2})\/20\d\d/);
  if (dateNumMatch && dateNumMatch[1]) {
    const monthIdx = parseInt(dateNumMatch[1], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${indonesianMonths[monthIdx]} ${year}`;
    }
  }

  return `Juli ${year}`;
}

/**
 * Extract active construction months for a school based on school.periodePenggunaan and school.tahunAnggaran
 * from Data Master Sekolah.
 */
export function getAvailableMonthsForSchool(
  school?: SchoolMasterData,
  lists?: Array<{ bulan?: string }[] | undefined>
): string[] {
  const monthSet = new Set<string>();
  const schoolYear = school?.tahunAnggaran?.trim() || '2026';

  // 1. First Priority: Extract months from school.periodePenggunaan and school.tahunAnggaran
  if (school?.periodePenggunaan) {
    const expanded = expandMonthsFromPeriodeString(school.periodePenggunaan, schoolYear);
    expanded.forEach((m) => monthSet.add(m));
  }

  // 2. Second Priority: Collect months from all provided transaction lists
  if (lists) {
    lists.forEach((list) => {
      if (Array.isArray(list)) {
        list.forEach((item) => {
          if (item && item.bulan && typeof item.bulan === 'string' && item.bulan.trim() !== '') {
            monthSet.add(item.bulan.trim());
          }
        });
      }
    });
  }

  // If still empty, default fallback based on schoolYear
  if (monthSet.size === 0) {
    const fallbackMonths = expandMonthsFromPeriodeString('', schoolYear);
    fallbackMonths.forEach((m) => monthSet.add(m));
  }

  const monthArray = Array.from(monthSet).sort((a, b) => {
    const parseMonthYear = (str: string) => {
      const parts = str.split(' ');
      const mName = parts[0]?.toLowerCase() || '';
      const year = parseInt(parts[1] || schoolYear, 10);
      const mIdx = monthOrderMap[mName] || 1;
      return year * 100 + mIdx;
    };
    return parseMonthYear(a) - parseMonthYear(b);
  });

  return ['ALL', ...monthArray];
}
