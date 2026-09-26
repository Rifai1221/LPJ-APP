import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { AppStateData } from '../types';
import { sanitizeAndFilterDemoState } from './storageService';
import {
  SchoolTenant,
  DEFAULT_PRESET_TENANTS,
  PRESET_SDN1_MUARA_DUA,
  createSchoolStateForTenant,
} from '../data/tenantPresets';
import { initialStores } from '../data/initialData';

const ACTIVE_TENANT_STORAGE_KEY = 'ACTIVE_SCHOOL_TENANT_ID_V1';
const TENANT_CACHE_PREFIX = 'LPJ_TENANT_CACHE_';

function withTimeout<T>(promise: Promise<T>, ms = 3500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Firestore request timed out after ${ms}ms`));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// 1. Get currently active tenant ID (with fallback to global Firestore setting)
export function getStoredActiveTenantId(): string {
  try {
    const saved = localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
    if (saved) return saved;
    if (isHideDemoPresets()) {
      return 'sch_real_primary';
    }
    return PRESET_SDN1_MUARA_DUA.id;
  } catch {
    return 'sch_real_primary';
  }
}

export function setStoredActiveTenantId(tenantId: string): void {
  try {
    localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenantId);
  } catch (err) {
    console.error('Failed to set active tenant:', err);
  }
}

// Global active school tracker stored in Firestore
export async function getGlobalActiveTenantId(): Promise<string | null> {
  try {
    const activeDocRef = doc(db, 'app_settings', 'active_school');
    const snap = await withTimeout(getDoc(activeDocRef), 3000);
    if (snap.exists() && snap.data()?.activeTenantId) {
      return snap.data().activeTenantId as string;
    }
  } catch (err) {
    console.warn('Could not read global active school from Firestore:', err);
  }
  return null;
}

// Check whether the user wants to hide pure demo presets (Default TRUE for real production)
export function isHideDemoPresets(): boolean {
  try {
    const val = localStorage.getItem('LPJ_HIDE_DEMO_DATA');
    if (val === 'false') return false;
    return true; // Clean production by default
  } catch {
    return true;
  }
}

// 2. Fetch all registered school tenants (Cloud Firestore + Local Presets)
// CRITICAL: Any school saved in Firestore is real user data and MUST NEVER be dropped or overwritten!
export async function getAllSchoolTenants(): Promise<SchoolTenant[]> {
  const tenantsMap = new Map<string, SchoolTenant>();
  const hideDemo = isHideDemoPresets();

  // Step A: Load custom/active schools saved in Firestore FIRST (Highest Priority!)
  try {
    const schoolsCol = collection(db, 'schools');
    const snapshot = await withTimeout(getDocs(schoolsCol), 3500);
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && (data.npsn || data.namaSekolah)) {
        // Any document stored in Firestore was created or saved by the user!
        // We always include it.
        tenantsMap.set(docSnap.id, {
          id: docSnap.id,
          npsn: data.npsn || '10105685',
          namaSekolah: data.namaSekolah || 'Sekolah Terdaftar',
          jenjang: data.jenjang || 'SD',
          kabKota: data.kabKota || '-',
          provinsi: data.provinsi || '-',
          email: data.email || '-',
          isDemo: Boolean(data.isDemo && !data.lastActive),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          lastLogin: data.lastLogin?.toDate ? data.lastLogin.toDate().toISOString() : (data.lastLogin || new Date().toISOString()),
        });
      }
    });
  } catch (err) {
    console.warn('Could not fetch schools from Firestore:', err);
  }

  // Step B: Also check local storage custom tenants list if any offline registered
  try {
    const customListRaw = localStorage.getItem('LOCAL_CUSTOM_TENANTS_LIST');
    if (customListRaw) {
      const customList: SchoolTenant[] = JSON.parse(customListRaw);
      customList.forEach((c) => {
        if (!tenantsMap.has(c.id)) {
          tenantsMap.set(c.id, c);
        }
      });
    }
  } catch {}

  // Step C: Include default presets unless user explicitly toggled "hideDemo" AND presets are not in Firestore
  DEFAULT_PRESET_TENANTS.forEach((preset) => {
    if (!tenantsMap.has(preset.id)) {
      if (!hideDemo) {
        tenantsMap.set(preset.id, preset);
      }
    }
  });

  // Step D: Ensure at least one school exists (Real School first if demo is hidden)
  if (tenantsMap.size === 0) {
    if (hideDemo) {
      const realPrimary: SchoolTenant = {
        id: 'sch_real_primary',
        npsn: '',
        namaSekolah: 'SEKOLAH SAYA (LENGKAPI IDENTITAS)',
        jenjang: 'SD',
        kabKota: '',
        provinsi: '',
        email: '',
        isDemo: false,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      tenantsMap.set(realPrimary.id, realPrimary);
    } else {
      tenantsMap.set(PRESET_SDN1_MUARA_DUA.id, PRESET_SDN1_MUARA_DUA);
    }
  }

  return Array.from(tenantsMap.values());
}

// Helper to remove any undefined values before saving to Firestore (Firestore rejects 'undefined')
function sanitizeForFirestore<T>(obj: T): Record<string, any> {
  return JSON.parse(JSON.stringify(obj, (_key, value) => (value === undefined ? null : value)));
}

// 3. Register a brand new School in Firestore
export async function registerNewSchoolTenant(
  params: {
    namaSekolah: string;
    npsn: string;
    jenjang: 'SD' | 'SMP' | 'SMA' | 'SMK';
    kabKota: string;
    provinsi: string;
    email: string;
    password?: string;
    templateType: 'full' | 'blank';
  }
): Promise<{ tenant: SchoolTenant; state: AppStateData }> {
  const cleanNpsn = params.npsn.trim().replace(/\D/g, '');
  const tenantId = `sch_${cleanNpsn || Date.now()}`;

  const newTenant: SchoolTenant = {
    id: tenantId,
    npsn: cleanNpsn || '10000000',
    namaSekolah: params.namaSekolah.trim().toUpperCase(),
    jenjang: params.jenjang,
    kabKota: params.kabKota.trim(),
    provinsi: params.provinsi.trim(),
    email: params.email.trim(),
    isDemo: false,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  const initialState = createSchoolStateForTenant(newTenant, params.templateType);

  // 1. Save metadata to Firestore
  try {
    const schoolDocRef = doc(db, 'schools', tenantId);
    await setDoc(schoolDocRef, {
      id: newTenant.id,
      npsn: newTenant.npsn,
      namaSekolah: newTenant.namaSekolah,
      jenjang: newTenant.jenjang,
      kabKota: newTenant.kabKota,
      provinsi: newTenant.provinsi,
      email: newTenant.email,
      isDemo: false,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });

    // 2. Save isolated initial LPJ state to Firestore subcollection
    const dataDocRef = doc(db, 'schools', tenantId, 'lpj_data', 'current');
    const cleanState = sanitizeForFirestore(initialState);
    await setDoc(dataDocRef, {
      ...cleanState,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore write warning during registration, caching locally:', err);
  }

  // 3. Cache locally
  try {
    localStorage.setItem(`${TENANT_CACHE_PREFIX}${tenantId}`, JSON.stringify(initialState));
    
    // update local custom list
    const customListRaw = localStorage.getItem('LOCAL_CUSTOM_TENANTS_LIST');
    const customList: SchoolTenant[] = customListRaw ? JSON.parse(customListRaw) : [];
    if (!customList.some((t) => t.id === newTenant.id)) {
      customList.push(newTenant);
      localStorage.setItem('LOCAL_CUSTOM_TENANTS_LIST', JSON.stringify(customList));
    }
  } catch {}

  setStoredActiveTenantId(tenantId);
  return { tenant: newTenant, state: initialState };
}

// 4. Load LPJ data for a specific school from Cloud Firestore (with local fallback)
// CRITICAL: This function must NEVER overwrite existing Firestore documents with default template!
export async function loadSchoolTenantAppState(tenant: SchoolTenant): Promise<{
  state: AppStateData;
  source: 'cloud' | 'cache' | 'fresh_preset';
}> {
  const tenantId = tenant.id;
  const defaultState = createSchoolStateForTenant(tenant, 'full');

  // Try 1: Fetch directly from Cloud Firestore (Highest Authority)
  try {
    const dataDocRef = doc(db, 'schools', tenantId, 'lpj_data', 'current');
    const docSnap = await withTimeout(getDoc(dataDocRef), 3500);

    if (docSnap.exists()) {
      const cloudData = docSnap.data();
      if (cloudData && cloudData.school) {
        const rawMergedState: AppStateData = {
          ...defaultState,
          ...cloudData,
          school: {
            ...defaultState.school,
            ...(cloudData.school || {}),
          },
          realSchoolData: cloudData.realSchoolData || defaultState.realSchoolData,
          rpdItems: Array.isArray(cloudData.rpdItems) ? cloudData.rpdItems : (defaultState.rpdItems || []),
          workers: Array.isArray(cloudData.workers) ? cloudData.workers : (defaultState.workers || []),
          stores: Array.isArray(cloudData.stores) ? cloudData.stores : (defaultState.stores || []),
          progressWeeks: Array.isArray(cloudData.progressWeeks) ? cloudData.progressWeeks : defaultState.progressWeeks,
          kwitansiList: Array.isArray(cloudData.kwitansiList) ? cloudData.kwitansiList : (defaultState.kwitansiList || []),
          wageReports: Array.isArray(cloudData.wageReports) ? cloudData.wageReports : (defaultState.wageReports || []),
          manualBkuTransactions: Array.isArray(cloudData.manualBkuTransactions) ? cloudData.manualBkuTransactions : [],
          bkbRecords: Array.isArray(cloudData.bkbRecords) ? cloudData.bkbRecords : [],
        };
        const mergedState = sanitizeAndFilterDemoState(rawMergedState);

        // Update local cache safely with actual cloud data
        try {
          localStorage.setItem(`${TENANT_CACHE_PREFIX}${tenantId}`, JSON.stringify(mergedState));
        } catch {}

        return {
          state: mergedState,
          source: 'cloud',
        };
      }
    }
  } catch (err) {
    console.warn(`[Multi-Tenant] Could not read Firestore for ${tenantId}:`, err);
  }

  // Try 2: Load from local cache for this school
  try {
    const cachedRaw = localStorage.getItem(`${TENANT_CACHE_PREFIX}${tenantId}`);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && parsed.school) {
        const rawMergedCache: AppStateData = {
          ...defaultState,
          ...parsed,
          school: {
            ...defaultState.school,
            ...(parsed.school || {}),
          },
          realSchoolData: parsed.realSchoolData || defaultState.realSchoolData,
          rpdItems: Array.isArray(parsed.rpdItems) ? parsed.rpdItems : (defaultState.rpdItems || []),
          workers: Array.isArray(parsed.workers) ? parsed.workers : (defaultState.workers || []),
          stores: Array.isArray(parsed.stores) ? parsed.stores : (defaultState.stores || []),
          progressWeeks: Array.isArray(parsed.progressWeeks) ? parsed.progressWeeks : defaultState.progressWeeks,
          kwitansiList: Array.isArray(parsed.kwitansiList) ? parsed.kwitansiList : (defaultState.kwitansiList || []),
          wageReports: Array.isArray(parsed.wageReports) ? parsed.wageReports : (defaultState.wageReports || []),
          manualBkuTransactions: Array.isArray(parsed.manualBkuTransactions) ? parsed.manualBkuTransactions : [],
          bkbRecords: Array.isArray(parsed.bkbRecords) ? parsed.bkbRecords : [],
        };
        const mergedCache = sanitizeAndFilterDemoState(rawMergedCache);

        return {
          state: mergedCache,
          source: 'cache',
        };
      }
    }
  } catch (err) {
    console.warn(`[Multi-Tenant] Local cache read error for ${tenantId}:`, err);
  }

  // Try 3: Initialize from preset template in memory ONLY (DO NOT overwrite Firestore!)
  try {
    localStorage.setItem(`${TENANT_CACHE_PREFIX}${tenantId}`, JSON.stringify(defaultState));
  } catch {}

  return {
    state: defaultState,
    source: 'fresh_preset',
  };
}

// 5. Save school LPJ data to Cloud Firestore (Isolated per school tenant)
export async function saveSchoolTenantAppState(
  tenantId: string,
  stateData: AppStateData
): Promise<boolean> {
  // Always update local cache instantly for instant UI responsiveness
  try {
    localStorage.setItem(`${TENANT_CACHE_PREFIX}${tenantId}`, JSON.stringify(stateData));
  } catch (err) {
    console.error('Failed to cache locally:', err);
  }

  // Save to isolated Firestore path: schools/{tenantId}/lpj_data/current
  try {
    const dataDocRef = doc(db, 'schools', tenantId, 'lpj_data', 'current');
    const cleanData = sanitizeForFirestore(stateData);
    await setDoc(dataDocRef, {
      ...cleanData,
      updatedAt: serverTimestamp(),
    });

    // Touch metadata lastActive and ensure isDemo is marked false (User actively uses this data)
    const schoolDocRef = doc(db, 'schools', tenantId);
    await setDoc(
      schoolDocRef,
      {
        id: tenantId,
        npsn: stateData.school.npsn || '10105685',
        namaSekolah: stateData.school.namaSekolah,
        kabKota: stateData.school.kabKota,
        provinsi: stateData.school.provinsi,
        lastActive: serverTimestamp(),
        isDemo: false,
      },
      { merge: true }
    );

    // Also update global active school pointer so other sessions / newly published URLs pick it up
    const activeRef = doc(db, 'app_settings', 'active_school');
    await setDoc(
      activeRef,
      {
        activeTenantId: tenantId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return true;
  } catch (err) {
    console.error(`[Multi-Tenant] Failed to save Firestore for ${tenantId}:`, err);
    return false;
  }
}

// 6. Delete a school tenant and its associated LPJ data
export async function deleteSchoolTenant(tenantId: string): Promise<boolean> {
  // 1. Remove from localStorage cache
  try {
    localStorage.removeItem(`${TENANT_CACHE_PREFIX}${tenantId}`);
    
    const customListRaw = localStorage.getItem('LOCAL_CUSTOM_TENANTS_LIST');
    if (customListRaw) {
      const customList: SchoolTenant[] = JSON.parse(customListRaw);
      const updated = customList.filter((t) => t.id !== tenantId);
      localStorage.setItem('LOCAL_CUSTOM_TENANTS_LIST', JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('Error clearing local cache during tenant delete:', err);
  }

  // 2. Delete from Firestore
  try {
    const dataDocRef = doc(db, 'schools', tenantId, 'lpj_data', 'current');
    await deleteDoc(dataDocRef);

    const schoolDocRef = doc(db, 'schools', tenantId);
    await deleteDoc(schoolDocRef);
    return true;
  } catch (err) {
    console.warn('Firestore delete error:', err);
    return false;
  }
}

