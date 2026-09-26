import { AppStateData } from '../types';
import {
  initialSchoolData,
  initialWorkers,
  initialStores,
  initialRpdItems,
  initialProgressWeeks,
} from '../data/initialData';

const STORAGE_KEY = 'LPJ_REVITALISASI_DATA_V1';

export type { AppStateData };

/**
 * Filter out legacy demo transaction records dated between October 2025 and January 2026.
 * Preserves all user-entered data for 2026 and custom records across redeploys.
 */
export function sanitizeAndFilterDemoState(state: AppStateData): AppStateData {
  if (!state) return state;

  const isOldDemoTransaction = (item: any): boolean => {
    if (!item) return false;
    const str = JSON.stringify(item).toLowerCase();
    return (
      str.includes('2025') ||
      str.includes('oktober 2025') ||
      str.includes('november 2025') ||
      str.includes('desember 2025') ||
      str.includes('januari 2026') ||
      str.includes('2026-01-')
    );
  };

  return {
    ...state,
    kwitansiList: (state.kwitansiList || []).filter((item) => !isOldDemoTransaction(item)),
    wageReports: (state.wageReports || []).filter((item) => !isOldDemoTransaction(item)),
    bkbRecords: (state.bkbRecords || []).filter((item) => !isOldDemoTransaction(item)),
    manualBkuTransactions: (state.manualBkuTransactions || []).filter((item) => !isOldDemoTransaction(item)),
  };
}

export function getDefaultState(): AppStateData {
  return {
    school: initialSchoolData,
    rpdItems: initialRpdItems,
    workers: initialWorkers,
    stores: initialStores,
    progressWeeks: initialProgressWeeks,
    kwitansiList: [],
    wageReports: [],
    bkbRecords: [],
    manualBkuTransactions: [],
  };
}

export function loadAppState(): AppStateData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.school && parsed.rpdItems) {
        const cleanState = sanitizeAndFilterDemoState(parsed);
        saveAppState(cleanState);
        return cleanState;
      }
    }
  } catch (err) {
    console.error('Failed to load from storage:', err);
  }
  const defaultData = getDefaultState();
  saveAppState(defaultData);
  return defaultData;
}

export function saveAppState(data: AppStateData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to storage:', err);
  }
}

export function resetToDefaultState(): AppStateData {
  const defaultData = getDefaultState();
  saveAppState(defaultData);
  return defaultData;
}
