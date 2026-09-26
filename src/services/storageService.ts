import {
  SchoolMasterData,
  RpdItem,
  WorkerItem,
  WeeklyWageReport,
  KwitansiDocument,
  BkuTransaction,
  BkbTransaction,
  ProjectProgressWeek,
  AppStateData,
} from '../types';
import {
  initialSchoolData,
  initialWorkers,
  initialStores,
  initialRpdItems,
  initialProgressWeeks,
} from '../data/initialData';
import { initialBkbRecords } from '../data/initialData2';
import { getCompleteInitialKwitansiList, generateSampleWeeklyWageReports } from '../data/fullPreset';

const STORAGE_KEY = 'LPJ_REVITALISASI_DATA_V1';

export type { AppStateData };

export function getDefaultState(): AppStateData {
  const workers = initialWorkers;
  return {
    school: initialSchoolData,
    rpdItems: initialRpdItems,
    workers: workers,
    stores: initialStores,
    progressWeeks: initialProgressWeeks,
    kwitansiList: getCompleteInitialKwitansiList(),
    wageReports: generateSampleWeeklyWageReports(workers),
    bkbRecords: initialBkbRecords,
    manualBkuTransactions: [],
  };
}

export function loadAppState(): AppStateData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.school && parsed.rpdItems) {
        return parsed;
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
