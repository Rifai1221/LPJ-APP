import { AppStateData } from '../types';
import {
  initialSchoolData,
  initialWorkers,
  initialStores,
  initialRpdItems,
  initialProgressWeeks,
} from '../data/initialData';
import { DEFAULT_DIVISIONS, renumberDivisions } from '../utils/divisionHelper';

const STORAGE_KEY = 'LPJ_REVITALISASI_DATA_V1';

export type { AppStateData };

/**
 * Standardize divisions array for a progress week so it strictly matches the 14 locked divisions.
 */
function standardizeWeekDivisions(existingDivisions: any[] = []): any[] {
  const currentMap = new Map<string, any>();
  if (Array.isArray(existingDivisions)) {
    existingDivisions.forEach((d) => {
      if (d) {
        if (d.id) currentMap.set(d.id, d);
        if (d.uraian) currentMap.set(d.uraian.toUpperCase().trim(), d);
      }
    });
  }

  const result = DEFAULT_DIVISIONS.map((def) => {
    const matched = currentMap.get(def.id) || currentMap.get(def.uraian.toUpperCase().trim());
    return {
      ...def,
      prestasiMingguLalu: matched ? Number(matched.prestasiMingguLalu) || 0 : 0,
      prestasiMingguIni: matched ? Number(matched.prestasiMingguIni) || 0 : 0,
      prestasiSdMingguIni: matched ? Number(matched.prestasiSdMingguIni) || 0 : 0,
    };
  });

  return renumberDivisions(result);
}

/**
 * Preserves all user-entered data while enforcing the locked 14-division structure across redeploys.
 */
export function sanitizeAndFilterDemoState(state: AppStateData): AppStateData {
  if (!state) return state;

  const rawWeeks = Array.isArray(state.progressWeeks) && state.progressWeeks.length > 0
    ? state.progressWeeks
    : initialProgressWeeks;

  const normalizedWeeks = rawWeeks.map((w) => ({
    ...w,
    divisions: standardizeWeekDivisions(w.divisions),
  }));

  return {
    ...state,
    progressWeeks: normalizedWeeks,
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
