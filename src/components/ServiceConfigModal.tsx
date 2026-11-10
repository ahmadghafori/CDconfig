import React, { useEffect, useState } from 'react';
import {
  X,
  Globe,
  Database,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Lock,
  Download,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';
import { ServiceConfig } from '../config/apiConfig';
import { parseJsonArrayStream } from '../services/dataService';

interface ServiceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ServiceConfig;
  onSaveConfig: (newConfig: ServiceConfig) => void;
  onUploadCustomJson: (jsonData: any, fileName: string) => void;
}

export const ServiceConfigModal: React.FC<ServiceConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onUploadCustomJson,
}) => {
  const [formData, setFormData] = useState<ServiceConfig>({ ...config });
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    duration?: number;
  } | null>(null);
  const [showCodeSnippet, setShowCodeSnippet] = useState<boolean>(true);

  // The modal stays mounted while hidden; refresh its form from the latest
  // persisted settings every time the user opens it.
  useEffect(() => {
    if (isOpen) {
      setFormData({ ...config });
      setTestResult(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult({
      success: true,
      message: 'در حال برقراری ارتباط با وب‌سرویس...',
    });
    const start = performance.now();

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json, text/plain, */*',
      };
      if (formData.token.trim()) {
        const cleanToken = formData.token.trim();
        headers['Authorization'] = cleanToken.startsWith('Bearer ')
          ? cleanToken
          : `Bearer ${cleanToken}`;
      }

      const res = await fetch(formData.serviceUrl, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (!res.ok) {
        const duration = Math.round(performance.now() - start);
        setTestResult({
          success: false,
          message: `پاسخ وب‌سرویس با وضعیت ${res.status} (${res.statusText}) دریافت شد.`,
          duration,
        });
        return;
      }

      if (!res.body) {
        throw new Error('مرورگر از قابلیت ReadableStream پشتیبانی نمی‌کند.');
      }

      let totalRaw = 0;
      let clusterCount = 0;

      await parseJsonArrayStream(res.body, (rawItem) => {
        totalRaw++;
        if (rawItem && rawItem.isCluster === true) {
          clusterCount++;
        }
        // بروزرسانی زنده وضعیت در حال استریم
        setTestResult({
          success: true,
          message: `در حال دریافت استریم... (${clusterCount} کلاستر از ${totalRaw} رکورد دریافت شد)`,
          duration: Math.round(performance.now() - start),
        });
      });

      const duration = Math.round(performance.now() - start);
      setTestResult({
        success: true,
        message: `اتصال استریم با موفقیت برقرار شد! از ${totalRaw} رکورد ارسالی سرور، تعداد ${clusterCount} کلاستر فعال (isCluster: true) شناسایی شد.`,
        duration,
      });
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      setTestResult({
        success: false,
        message:
          err.message?.includes('Failed to fetch')
            ? 'خطای دسترسی یا CORS (سرور هدر Access-Control-Allow-Origin ارسال نکرده است). لطفاً از فعال بودن CORS بر روی سرور یا ابزار پروکسی اطمینان حاصل فرمایید.'
            : `خطا در برقراری ارتباط استریم: ${err.message}`,
        duration,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSaveConfig(formData);
    onClose();
  };

  // دانلود فایل config.json برای قراردادن در پوشه dist/ بعد از بیلد
  const handleDownloadConfigJson = () => {
    const jsonStr = JSON.stringify(
      {
        serviceUrl: formData.serviceUrl,
        token: formData.token,
        httpMethod: 'GET',
        defaultSource: formData.defaultSource,
        timeoutMs: formData.timeoutMs,
        clusterGraphqlEndpoint: formData.clusterGraphqlEndpoint,
      },
      null,
      2
    );
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        onUploadCustomJson(parsed, file.name);
        onClose();
      } catch (err) {
        alert('فایل انتخاب شده قالب جیسون معتبر ندارد.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                تنظیمات وب‌سرویس و احراز هویت (Service & Token Setup)
              </h3>
              <p className="text-xs text-slate-400">
                تنظیم آدرس Endpoint متد GET و Token با امکان تغییر بعد از build
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Post-Build Support Banner */}
          <div className="p-3.5 bg-indigo-950/40 border border-indigo-800/40 rounded-xl flex items-start gap-3">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-200 space-y-1">
              <div className="font-semibold text-indigo-300">
                قابلیت تغییر بعد از Build پروژه (بدون نیاز به کامپایل مجدد):
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                پس از اجرای <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded font-mono">npm run build</code>،
                فایلی با نام <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded font-mono">dist/config.json</code> در
                پوشه خروجی قرار دارد. در هر سروری می‌توانید مستقیماً آن را ویرایش کرده یا به عنوان ConfigMap تنظیم کنید.
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              منبع فعال داده‌ها (Data Source Mode):
            </label>
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, defaultSource: 'live' })}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all ${
                  formData.defaultSource === 'live'
                    ? 'bg-slate-800 text-sky-400 border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-4 h-4 text-sky-400" />
                <span>وب‌سرویس زنده (Live Service)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, defaultSource: 'mock' })}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-medium transition-all ${
                  formData.defaultSource === 'mock'
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Database className="w-4 h-4 text-emerald-400" />
                <span>فایل ماک محلی (Mock Data)</span>
              </button>
            </div>
          </div>

          {/* Live Service URL and Token */}
          <div className="space-y-4 p-4 rounded-xl border border-slate-800 bg-slate-950/60">
            {/* 1) Service URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>۱) آدرس وب‌سرویس (Service URL):</span>
                </label>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/40 font-bold">
                  متد GET
                </span>
              </div>
              <input
                type="text"
                dir="ltr"
                value={formData.serviceUrl}
                onChange={(e) =>
                  setFormData({ ...formData, serviceUrl: e.target.value })
                }
                placeholder="https://api.yourcompany.com/clusters"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* 2) Token */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>۲) توکن احراز هویت (Token / Bearer):</span>
                </label>
                <span className="text-[10px] font-mono text-slate-500">
                  هدر Authorization
                </span>
              </div>
              <input
                type="text"
                dir="ltr"
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Test Connection Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-850">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !formData.serviceUrl}
                className="flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-sky-300 bg-sky-950/70 border border-sky-800/70 hover:bg-sky-900/70 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'در حال برقراری ارتباط...' : 'تست اتصال GET با Token'}</span>
              </button>

              {testResult && (
                <div
                  className={`text-xs flex items-center gap-1.5 font-medium ${
                    testResult.success ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span className="leading-tight">{testResult.message}</span>
                  {testResult.duration && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      ({testResult.duration}ms)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cluster Config GraphQL Endpoint */}
          <div className="space-y-2 p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/15">
            <div className="text-xs font-semibold text-emerald-300">وب‌سرویس اختصاصی تنظیمات کلاستر (GraphQL)</div>
            <label className="text-[11px] text-slate-400">آدرس GraphQL برای دریافت Realm و ثبت Cluster Config</label>
            <input type="text" dir="ltr" value={formData.clusterGraphqlEndpoint || ''} onChange={e => setFormData({ ...formData, clusterGraphqlEndpoint: e.target.value })} placeholder="https://studio-gateway-gen3.depna.ir/wrksp/graphql" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500" />
          </div>

          {/* Product Action Pipeline Endpoints */}
          <div className="space-y-4 p-4 rounded-xl border border-amber-900/40 bg-amber-950/20">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>آدرس‌های وب‌سرویس عملیات محصول (HelmChart & ModuleProduct):</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              این آدرس‌ها برای دکمه‌های عملیاتی هر محصول فراخوانی می‌شوند و می‌توانید آن‌ها را بر اساس محیط سرور تغییر دهید.
            </p>

            <div className="space-y-3 pt-1">
              {/* HelmChart Endpoint */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>۱. آدرس ساخت HelmChart (متد POST):</span>
                  <span className="text-[10px] text-sky-400 font-mono">InstallModuleCommand</span>
                </label>
                <input
                  type="text"
                  value={formData.helmChartEndpoint || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, helmChartEndpoint: e.target.value })
                  }
                  dir="ltr"
                  placeholder="https://api.yourcompany.com/api/HelmChart/Build"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* PublishPackage Endpoint */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>۲. آدرس تلاش دوباره ثبت Package (متد POST):</span>
                  <span className="text-[10px] text-amber-400 font-mono">HelmChartPublishingResults</span>
                </label>
                <input
                  type="text"
                  value={formData.publishPackageEndpoint || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, publishPackageEndpoint: e.target.value })
                  }
                  dir="ltr"
                  placeholder="https://api.yourcompany.com/api/HelmChart/Publish"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* AddModuleProduct Endpoint */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>۳. آدرس ساخت ModuleProduct (متد POST با مسیر PackageGuid):</span>
                  <span className="text-[10px] text-indigo-400 font-mono">AddModuleProduct/{'{PackageGuid}'}</span>
                </label>
                <input
                  type="text"
                  value={formData.addModuleProductEndpoint || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, addModuleProductEndpoint: e.target.value })
                  }
                  dir="ltr"
                  placeholder="https://api.yourcompany.com/api/Module/AddModuleProduct/{PackageGuid}"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Filter Notice */}
          <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>فیلتر فعال: مواردی که <code className="text-emerald-400 font-mono">isCluster: false</code> هستند به صورت خودکار نادیده گرفته می‌شوند.</span>
            </span>
          </div>

          {/* Quick Mock Presets if Mock selected */}
          {formData.defaultSource === 'mock' && (
            <div className="space-y-2 p-4 rounded-xl border border-slate-800 bg-slate-950/50">
              <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>انتخاب فایل ماک محلی:</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      mockDataUrl: '/assets/aistudio/response__1__b8d05584.json',
                    })
                  }
                  className={`p-2.5 rounded-lg border text-right transition-all flex flex-col gap-1 ${
                    formData.mockDataUrl === '/assets/aistudio/response__1__b8d05584.json'
                      ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-semibold text-slate-200">
                    خروجی جدید (response 1)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 truncate" dir="ltr">
                    response__1__b8d05584.json
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      mockDataUrl: '/assets/aistudio/response_2f9d7767.json',
                    })
                  }
                  className={`p-2.5 rounded-lg border text-right transition-all flex flex-col gap-1 ${
                    formData.mockDataUrl === '/assets/aistudio/response_2f9d7767.json'
                      ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-semibold text-slate-200">
                    خروجی قبلی (response)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 truncate" dir="ltr">
                    response_2f9d7767.json
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Alternative: Upload Custom JSON or Download Config */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Download config.json button */}
            <button
              type="button"
              onClick={handleDownloadConfigJson}
              className="p-3 rounded-xl border border-slate-800 hover:border-indigo-600 bg-slate-950/50 hover:bg-indigo-950/20 text-right transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="text-xs font-medium text-slate-200">
                    دانلود فایل config.json
                  </div>
                  <div className="text-[10px] text-slate-500">
                    برای قرار دادن در dist/ سرور
                  </div>
                </div>
              </div>
            </button>

            {/* Custom file upload */}
            <label className="p-3 rounded-xl border border-slate-800 hover:border-emerald-600 bg-slate-950/50 hover:bg-emerald-950/20 text-right transition-colors flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-2.5">
                <Upload className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="text-xs font-medium text-slate-200">
                    آپلود فایل JSON تستی
                  </div>
                  <div className="text-[10px] text-slate-500">
                    انتخاب فایل خروجی دیگر
                  </div>
                </div>
              </div>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Code Configuration Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>محتوای فایل config.json (در پوشه public یا dist سرور):</span>
              </span>
              <button
                type="button"
                onClick={() => setShowCodeSnippet(!showCodeSnippet)}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                {showCodeSnippet ? 'مخفی کردن' : 'نمایش'}
              </button>
            </div>

            {showCodeSnippet && (
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300 leading-relaxed overflow-x-auto" dir="ltr">
{`{
  "serviceUrl": "${formData.serviceUrl}",
  "token": "${formData.token || 'YOUR_TOKEN_HERE'}",
  "httpMethod": "GET",
  "defaultSource": "${formData.defaultSource}",\n  "clusterGraphqlEndpoint": "${formData.clusterGraphqlEndpoint}"
}`}
              </pre>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <div className="text-xs text-slate-400">
            منبع فعال:{' '}
            <span className="font-semibold text-slate-200">
              {formData.defaultSource === 'live' ? 'وب‌سرویس زنده (GET)' : 'فایل ماک محلی'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-colors"
            >
              ذخیره و اعمال
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
