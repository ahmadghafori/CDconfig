import { API_CONFIG, ServiceConfig, STORAGE_KEY_CONFIG, STORAGE_KEY_CLUSTER_CACHE, STORAGE_KEY_PRODUCT_ACTIONS } from '../config/apiConfig';
import { ClusterItem } from '../types/dataTypes';
import { ProductActionState } from '../types/actionTypes';

export interface DataFetchResult {
  data: ClusterItem[];
  rawTotalCount: number;
  source: 'mock' | 'live' | 'custom';
  sourceUrl: string;
  durationMs: number;
  timestamp: string;
  stats: {
    totalItems: number;
    activeClusters: number;
    namedProjects: number;
    totalProducts: number;
    uniqueClouds: string[];
    excludedNonClusters: number;
  };
}

export interface StreamProgressStats {
  rawReceivedCount: number;
  clusterCount: number;
  namedProjects: number;
  totalProducts: number;
  uniqueClouds: string[];
  excludedNonClusters: number;
}

export interface StreamCallbacks {
  /**
   * به محض استخراج هر آیتم معتبر (isCluster: true) در لحظه صدا زده می‌شود
   */
  onItemReceived?: (
    item: ClusterItem,
    allClustersSoFar: ClusterItem[],
    stats: StreamProgressStats
  ) => void;

  /**
   * آغاز برقراری ارتباط با وب‌سرویس استریم
   */
  onStart?: (targetUrl: string, source: 'mock' | 'live') => void;

  /**
   * اتمام موفقیت‌آمیز استریم
   */
  onComplete?: (result: DataFetchResult) => void;

  /**
   * خطای شبکه یا وب‌سرویس
   */
  onError?: (error: Error) => void;

  /**
   * سیگنال لغو درخواست
   */
  signal?: AbortSignal;
}

let cachedRuntimeConfig: Partial<ServiceConfig> | null = null;

function getClusterCacheKey(config: ServiceConfig): string {
  return JSON.stringify({ source: config.defaultSource, serviceUrl: config.serviceUrl, mockDataUrl: config.mockDataUrl });
}

const CLUSTER_CACHE_DB = 'json_crack_runtime_cache';
const CLUSTER_CACHE_STORE = 'entries';

function openClusterCacheDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(CLUSTER_CACHE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CLUSTER_CACHE_STORE)) {
        db.createObjectStore(CLUSTER_CACHE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

export async function getCachedClusterResult(config: ServiceConfig): Promise<DataFetchResult | null> {
  const key = getClusterCacheKey(config);
  const db = await openClusterCacheDb();
  if (db) {
    try {
      const result = await new Promise<DataFetchResult | null>((resolve) => {
        const request = db.transaction(CLUSTER_CACHE_STORE, 'readonly').objectStore(CLUSTER_CACHE_STORE).get(key);
        request.onsuccess = () => resolve((request.result as DataFetchResult) || null);
        request.onerror = () => resolve(null);
      });
      db.close();
      if (result && Array.isArray(result.data)) return result;
    } catch (error) {
      db.close();
      console.warn('Could not read IndexedDB cluster cache', error);
    }
  }

  // Fallback for browsers where IndexedDB is unavailable.
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLUSTER_CACHE);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached?.key !== key || !Array.isArray(cached?.result?.data)) return null;
    return cached.result as DataFetchResult;
  } catch (error) {
    console.warn('Could not read cached cluster data', error);
    return null;
  }
}

export async function saveCachedClusterResult(config: ServiceConfig, result: DataFetchResult): Promise<void> {
  const key = getClusterCacheKey(config);
  const db = await openClusterCacheDb();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const transaction = db.transaction(CLUSTER_CACHE_STORE, 'readwrite');
        transaction.objectStore(CLUSTER_CACHE_STORE).put(result, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      });
      db.close();
      return;
    } catch (error) {
      db.close();
      console.warn('Could not write IndexedDB cluster cache', error);
    }
  }

  try {
    localStorage.setItem(
      STORAGE_KEY_CLUSTER_CACHE,
      JSON.stringify({ key, savedAt: new Date().toISOString(), result })
    );
  } catch (error) {
    console.warn('Could not cache cluster data', error);
  }
}

export function loadProductActionStates(): Record<string, ProductActionState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCT_ACTIONS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const restored = parsed as Record<string, ProductActionState>;
    for (const state of Object.values(restored)) {
      if (!state || typeof state !== 'object') continue;
      const interrupted: Record<string, 'helm' | 'publish' | 'module'> = {
        building_helm: 'helm',
        publishing_package: 'publish',
        adding_module: 'module',
      };
      const operation = interrupted[state.step];
      if (operation) {
        const message = 'اجرای عملیات پیش از دریافت پاسخ نهایی متوقف شده است؛ برای بررسی وضعیت، استعلام مجدد را اجرا کنید.';
        state.step = 'error';
        state.lastMessage = message;
        state.errorMessage = message;
        state.operationErrors = { ...state.operationErrors, [operation]: { operation, message } };
        state.operationHistory = {
          ...state.operationHistory,
          [operation]: { status: 'interrupted', message, timestamp: new Date().toISOString() },
        };
      }
    }
    return restored;
  } catch (error) {
    console.warn('Could not restore product action history', error);
    return {};
  }
}

export function saveProductActionStates(states: Record<string, ProductActionState>): void {
  try {
    localStorage.setItem(STORAGE_KEY_PRODUCT_ACTIONS, JSON.stringify(states));
  } catch (error) {
    console.warn('Could not persist product action history', error);
  }
}


/**
 * خواندن تنظیمات runtime از فایل public/config.json
 * این متد به برنامه اجازه می‌دهد پس از بیلد شدن (npm run build) در محیط سرور
 * بدون کامپایل مجدد، فایل config.json را بخواند.
 */
export async function loadRuntimeConfig(): Promise<ServiceConfig> {
  // Load the deployment config only once, but always re-read user overrides.
  // localStorage is origin-scoped and survives page reloads, browser restarts,
  // and new frontend builds as long as the application origin stays the same.
  if (!cachedRuntimeConfig) {
    try {
      const res = await fetch('/config.json', { cache: 'no-store' });
      if (res.ok) {
        cachedRuntimeConfig = await res.json();
      } else {
        cachedRuntimeConfig = {};
      }
    } catch {
      // Development mode or deployments without a public config.json.
      cachedRuntimeConfig = {};
    }
  }

  let savedConfig: Partial<ServiceConfig> = {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        savedConfig = parsed;
      }
      if (savedConfig.timeoutMs === 15000) savedConfig.timeoutMs = 0;
    }
  } catch (e) {
    console.warn('Could not read saved service config from localStorage', e);
  }

  return { ...API_CONFIG, ...(cachedRuntimeConfig || {}), ...savedConfig };
}

/**
 * دریافت تنظیمات همگام فعلی
 */
export function getActiveServiceConfig(): ServiceConfig {
  let savedConfig: Partial<ServiceConfig> = {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      savedConfig = JSON.parse(saved);
      if (savedConfig.timeoutMs === 15000) {
        savedConfig.timeoutMs = 0;
      }
    }
  } catch (e) {
    // Fallback
  }

  return {
    ...API_CONFIG,
    ...(cachedRuntimeConfig || {}),
    ...savedConfig,
  };
}

/**
 * ذخیره تنظیمات در حافظه مرورگر
 */
export function saveActiveServiceConfig(config: ServiceConfig): void {
  try {
    // Persist every service endpoint and option together as one versionable JSON object.
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save service config', e);
    throw new Error('ذخیره تنظیمات در این مرورگر ممکن نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید.');
  }
}

/**
 * ریست کردن تنظیمات به پیش‌فرض فایل config.json
 */
export function resetServiceConfigToDefault(): ServiceConfig {
  try {
    localStorage.removeItem(STORAGE_KEY_CONFIG);
  } catch (e) {
    console.error('Failed to reset config', e);
  }
  return { ...API_CONFIG, ...(cachedRuntimeConfig || {}) };
}

/**
 * 🚀 موتور استخراج تک‌تک آبجکت‌های JSON از ReadableStream به صورت لایو و بی‌درنگ
 * این پارسر از ساختار بافرینگ پیشرفته استفاده می‌کند و آبجکت‌های تودرتو را بدون خطا جدا می‌کند.
 */
export async function parseJsonArrayStream(
  stream: ReadableStream<Uint8Array>,
  onRawItem: (rawItem: any) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        try {
          await reader.cancel();
        } catch (e) {
          // ignore
        }
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // پردازش تک‌تک آبجکت‌های درون بافر
      while (true) {
        // حذف کاراکترهای اضافه مانند فاصله‌ها، شروع براکت آرایه [، کاما , و خطوط جدید
        let startIndex = 0;
        while (
          startIndex < buffer.length &&
          (buffer[startIndex] === ' ' ||
            buffer[startIndex] === '\n' ||
            buffer[startIndex] === '\r' ||
            buffer[startIndex] === '\t' ||
            buffer[startIndex] === ',' ||
            buffer[startIndex] === '[')
        ) {
          startIndex++;
        }

        if (startIndex > 0) {
          buffer = buffer.slice(startIndex);
        }

        // اگر بافر خالی است یا به انتهای آرایه ] رسیده‌ایم
        if (buffer.length === 0 || buffer[0] === ']') {
          if (buffer[0] === ']') {
            buffer = buffer.slice(1);
          }
          break;
        }

        // ما منتظر شروع یک آبجکت JSON با { هستیم
        if (buffer[0] !== '{') {
          // اگر کاراکتر دیگری است و براکت نیست، شاید داده‌ی رشته‌ای یا ادامه‌دار باشد
          break;
        }

        // جستجوی کرلی‌براکت متناظر پایانی با در نظر گرفتن رشته‌ها و کاراکترهای اسکیپ شده (\)
        let depth = 0;
        let inString = false;
        let isEscaped = false;
        let foundEndIndex = -1;

        for (let j = 0; j < buffer.length; j++) {
          const char = buffer[j];

          if (isEscaped) {
            isEscaped = false;
            continue;
          }

          if (char === '\\') {
            if (inString) {
              isEscaped = true;
            }
            continue;
          }

          if (char === '"') {
            inString = !inString;
            continue;
          }

          if (!inString) {
            if (char === '{') {
              depth++;
            } else if (char === '}') {
              depth--;
              if (depth === 0) {
                foundEndIndex = j;
                break;
              }
            }
          }
        }

        // اگر یک آبجکت کامل پیدا شد
        if (foundEndIndex !== -1) {
          const jsonChunk = buffer.slice(0, foundEndIndex + 1);
          buffer = buffer.slice(foundEndIndex + 1);

          try {
            const parsed = JSON.parse(jsonChunk);
            onRawItem(parsed);
          } catch (parseErr) {
            console.warn('خطا در پارس کردن تکه JSON از استریم:', jsonChunk, parseErr);
          }
        } else {
          // آبجکت هنوز کامل نشده و باید منتظر چانک‌های بعدی از وب‌سرویس باشیم
          break;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch (e) {
      // ignore
    }
  }
}

/**
 * 📡 فراخوانی استریم داده‌ها از وب‌سرویس (Stream Reader)
 * به محض دریافت هر چانک، آن را استخراج کرده و به کامپوننت ارسال می‌کند.
 */
export async function fetchClusterServiceStream(
  callbacks: StreamCallbacks,
  overrideConfig?: Partial<ServiceConfig>
): Promise<DataFetchResult> {
  const baseConfig = await loadRuntimeConfig();
  const config: ServiceConfig = {
    ...baseConfig,
    ...(overrideConfig || {}),
  };

  const startTime = performance.now();
  const source = config.defaultSource;
  const targetUrl = source === 'mock' ? config.mockDataUrl : config.serviceUrl;

  callbacks.onStart?.(targetUrl, source);

  const controller = new AbortController();
  const signal = callbacks.signal || controller.signal;

  let timeoutId: any = null;
  // بر اساس دستور: بدون تایم‌اوت مگر اینکه صریحاً بزرگتر از ۰ تنظیم شده باشد
  if (config.timeoutMs && config.timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      ...(config.customHeaders || {}),
    };

    if (config.token && config.token.trim()) {
      const cleanToken = config.token.trim();
      headers['Authorization'] = cleanToken.startsWith('Bearer ')
        ? cleanToken
        : `Bearer ${cleanToken}`;
    }

    const response = await fetch(targetUrl, {
      method: source === 'live' ? config.httpMethod || 'GET' : 'GET',
      headers: source === 'live' ? headers : undefined,
      signal,
      cache: 'no-store',
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`خطای وب‌سرویس: وضعیت ${response.status} (${response.statusText})`);
    }

    if (!response.body) {
      throw new Error('مرورگر از ReadableStream پشتیبانی نمی‌کند.');
    }

    const clusterItems: ClusterItem[] = [];
    let rawReceivedCount = 0;
    let excludedCount = 0;
    let namedProjects = 0;
    let totalProducts = 0;
    const cloudSet = new Set<string>();

    // خواندن استریم بایت به بایت و استخراج هر آیتم
    await parseJsonArrayStream(
      response.body,
      (rawItem: any) => {
        rawReceivedCount++;

        // 🎯 فیلتر کلیدی: فقط مواردی که isCluster: true هستند اضافه می‌شوند
        if (rawItem && rawItem.isCluster === true) {
          clusterItems.push(rawItem);

          if (rawItem.projectName && rawItem.projectName.trim() !== '') {
            namedProjects++;
          }
          if (Array.isArray(rawItem.productlist)) {
            totalProducts += rawItem.productlist.length;
          }
          const clouds = rawItem.clusterConfigInfo?.clusterGetResult?.clusterConfig?.clouds;
          if (Array.isArray(clouds)) {
            clouds.forEach((c: any) => {
              if (typeof c === 'string') cloudSet.add(c);
              else if (c && c.name) cloudSet.add(c.name);
            });
          }

          // ارسال فوری به فرانتاند جهت رندر زنده
          callbacks.onItemReceived?.(rawItem, [...clusterItems], {
            rawReceivedCount,
            clusterCount: clusterItems.length,
            namedProjects,
            totalProducts,
            uniqueClouds: Array.from(cloudSet),
            excludedNonClusters: excludedCount,
          });
        } else {
          excludedCount++;
        }
      },
      signal
    );

    const durationMs = Math.round(performance.now() - startTime);

    const finalResult: DataFetchResult = {
      data: clusterItems,
      rawTotalCount: rawReceivedCount,
      source,
      sourceUrl: targetUrl,
      durationMs,
      timestamp: new Date().toISOString(),
      stats: {
        totalItems: clusterItems.length,
        activeClusters: clusterItems.length,
        namedProjects,
        totalProducts,
        uniqueClouds: Array.from(cloudSet),
        excludedNonClusters: excludedCount,
      },
    };

    callbacks.onComplete?.(finalResult);
    return finalResult;
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      if (config.timeoutMs && config.timeoutMs > 0) {
        throw new Error(`زمان درخواست به پایان رسید (${config.timeoutMs}ms Timeout).`);
      }
      throw new Error('درخواست توسط کاربر لغو گردید.');
    }

    if (error.message?.includes('Failed to fetch') && source === 'live') {
      const err = new Error(
        `امکان دسترسی به آدرس "${targetUrl}" وجود ندارد (خطای CORS یا شبکه). لطفاً مطمئن شوید سرور هدرهای CORS را ارسال می‌کند یا در تنظیمات آدرس را تغییر دهید.`
      );
      callbacks.onError?.(err);
      throw err;
    }

    callbacks.onError?.(error);
    throw error;
  }
}

/**
 * متد کمکی دریافت داده (با پشتیبانی کامل از استریم)
 */
export async function fetchClusterServiceData(
  overrideConfig?: Partial<ServiceConfig>
): Promise<DataFetchResult> {
  return new Promise((resolve, reject) => {
    fetchClusterServiceStream(
      {
        onComplete: resolve,
        onError: reject,
      },
      overrideConfig
    ).catch(reject);
  });
}
