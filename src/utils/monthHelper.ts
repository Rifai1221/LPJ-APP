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
  agustus: 8, agu: 8, ags: 8,
  september: 9, sep: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  desember: 12, des: 12,
};

/**
 * Expand range of Indonesian months from a period string like "18 Oktober 2025 s.d 25 Januari 2026" or "Juli 2025 - Oktober 2025"
 */
export function expandMonthsFromPeriodeString(periodeStr: string, defaultYear = '2026'): string[] {
  if (!periodeStr || typeof periodeStr !== 'string') return [];

  const monthRegex = /(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|ags|sep|okt|nov|des)/gi;
  const matches = [...periodeStr.matchAll(monthRegex)];

  if (matches.length === 0) return [];

  const yearMatches = [...periodeStr.matchAll(/20\d\d/g)];
  const startYear = yearMatches[0] ? parseInt(yearMatches[0][0], 10) : parseInt(defaultYear, 10);
  const endYear = yearMatches[yearMatches.length - 1] ? parseInt(yearMatches[yearMatches.length - 1][0], 10) : startYear;

  const startMonthName = matches[0][0].toLowerCase();
  const endMonthName = matches[matches.length - 1][0].toLowerCase();

  const mIdxStart = monthOrderMap[startMonthName] || 7;
  const mIdxEnd = monthOrderMap[endMonthName] || mIdxStart;

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
  if (lower.includes('nov')) return `November ${year}`;
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
 * Extract active construction months for a school based on transactions, progress weeks, or school metadata.
 */
export function getAvailableMonthsForSchool(
  school?: SchoolMasterData,
  lists?: Array<{ bulan?: string }[] | undefined>
): string[] {
  const monthSet = new Set<string>();

  // 1. First Priority: Extract months from school.periodePenggunaan in Data Master Sekolah
  if (school?.periodePenggunaan) {
    const expanded = expandMonthsFromPeriodeString(school.periodePenggunaan, school.tahunAnggaran || '2026');
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

  // If still empty, default fallback
  if (monthSet.size === 0) {
    return ['ALL', 'Juli 2026', 'Agustus 2026', 'September 2026', 'Oktober 2026', 'November 2026'];
  }

  const monthArray = Array.from(monthSet).sort((a, b) => {
    const parseMonthYear = (str: string) => {
      const parts = str.split(' ');
      const mName = parts[0]?.toLowerCase() || '';
      const year = parseInt(parts[1] || '2026', 10);
      const mIdx = monthOrderMap[mName] || 1;
      return year * 100 + mIdx;
    };
    return parseMonthYear(a) - parseMonthYear(b);
  });

  return ['ALL', ...monthArray];
}
