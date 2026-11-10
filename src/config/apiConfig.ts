/**
 * ============================================================================
 * 🔌 SERVICE CONFIGURATION / فایل کانفیگ اصلی وب‌سرویس
 * ============================================================================
 * 
 * فقط کافیست ۲ پارامتر زیر را مقداردهی کنید:
 * 1) serviceUrl: آدرس وب‌سرویس شما که از نوع GET است.
 * 2) token: توکن احراز هویت شما (به عنوان هدر Authorization ارسال می‌شود).
 * 
 * 💡 قابلیت تغییر بعد از Build:
 * پس از اجرای دستور npm run build، فایل dist/config.json ایجاد می‌شود.
 * می‌توانید در سرور یا محیط استقرار، بدون کامپایل مجدد، مستقیماً فایل config.json
 * را باز کرده و serviceUrl یا token را ویرایش کنید!
 * همچنین در داخل برنامه از منوی تنظیمات نیز می‌توانید مقادیر را تغییر دهید.
 * ============================================================================
 */

export interface ServiceConfig {
  /**
   * منبع فعال: 'live' برای وب‌سرویس واقعی | 'mock' برای فایل ماک
   */
  defaultSource: 'live' | 'mock';

  /**
   * ۱) 👈 آدرس وب‌سرویس شما (متد GET)
   */
  serviceUrl: string;

  /**
   * ۲) 👈 توکن احراز هویت شما (Bearer Token)
   */
  token: string;

  /**
   * متد درخواست (همیشه GET بر اساس درخواست)
   */
  httpMethod: 'GET';

  /**
   * مسیر فایل ماک محلی در صورت سوییچ به حالت تست
   */
  mockDataUrl: string;

  /**
   * هدرهای دلخواه اضافی
   */
  customHeaders?: Record<string, string>;

  /**
   * آدرس وب‌سرویس ساخت HelmChart (متد POST با InstallModuleCommand)
   */
  helmChartEndpoint: string;

  /**
   * آدرس وب‌سرویس تلاش دوباره ثبت Package در Registry (متد POST با HelmChartPublishingResults)
   */
  publishPackageEndpoint: string;

  /**
   * آدرس وب‌سرویس ساخت ماژول محصول (متد POST با AddModuleProduct/{PackageGuid})
   */
  addModuleProductEndpoint: string;

  /** آدرس اختصاصی GraphQL برای عملیات Cluster Config */
  clusterGraphqlEndpoint: string;

  /** آدرس GraphQL مستقل برای عملیات محصول */
  productActionsGraphqlEndpoint?: string;

  /**
   * مهلت زمانی درخواست به میلی‌ثانیه
   */
  timeoutMs: number;
}

/**
 * 👈 تنظیمات پیش‌فرض برنامه:
 */
export const API_CONFIG: ServiceConfig = {
  // ۱) آدرس وب‌سرویس واقعی (متد GET)
  serviceUrl: (import.meta.env.VITE_SERVICE_URL as string) || 'https://api.yourcompany.com/clusters',

  // ۲) توکن احراز هویت شما
  token: '',

  // ۳) آدرس‌های وب‌سرویس‌های عملیاتی پایپ‌لاین محصول:
  helmChartEndpoint: 'https://api.yourcompany.com/api/HelmChart/Build',
  publishPackageEndpoint: 'https://api.yourcompany.com/api/HelmChart/Publish',
  addModuleProductEndpoint: 'https://api.yourcompany.com/api/Module/AddModuleProduct',

  // GraphQL endpoint for Cluster Config read/write operations
  clusterGraphqlEndpoint: 'https://studio-gateway-gen3.depna.ir/wrksp/graphql',
  productActionsGraphqlEndpoint: 'https://studio-gateway-gen3.depna.ir/kcsrv/graphql',

  // منبع پیش‌فرض: دریافت زنده از سرویس
  defaultSource: 'live',

  // متد درخواست HTTP
  httpMethod: 'GET',

  // فایل ماک برای تست محلی
  mockDataUrl: '/assets/aistudio/response__1__b8d05584.json',

  // مهلت دریافت پاسخ: ۰ به معنی بدون محدودیت زمانی (Unlimited Timeout)
  timeoutMs: 0,
};

export const STORAGE_KEY_CONFIG = 'json_crack_service_config';
export const STORAGE_KEY_CUSTOM_DATA = 'json_crack_custom_data_cache';

export const STORAGE_KEY_CLUSTER_CACHE = 'json_crack_cluster_tree_cache_v1';
export const STORAGE_KEY_PRODUCT_ACTIONS = 'json_crack_product_action_states_v1';
