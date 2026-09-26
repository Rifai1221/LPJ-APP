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
 * Preserves all user-entered data, progress, kwitansi, and records across redeploys.
 */
export function sanitizeAndFilterDemoState(state: AppStateData): AppStateData {
  if (!state) return state;

  return {
    ...state,
    kwitansiList: state.kwitansiList || [],
    wageReports: state.wageReports || [],
    bkbRecords: state.bkbRecords || [],
    manualBkuTransactions: state.manualBkuTransactions || [],
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
    deletedBkuIds: [],
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
