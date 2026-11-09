import React from 'react';
import {
  Globe,
  Database,
  Sliders,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ViewMode } from '../types/dataTypes';

interface TopNavbarProps {
  currentView: ViewMode;
  onChangeView: (mode: ViewMode) => void;
  onOpenServiceConfig: () => void;
  dataSource: 'mock' | 'live' | 'custom';
  sourceUrl: string;
  isLoading: boolean;
  onRefresh: () => void;
  filterEmpty: boolean;
  onToggleFilterEmpty: (val: boolean) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  totalCount: number;
  activeCount: number;
  isStreaming?: boolean;
  expandDepth?: number;
  onSetExpandDepth?: (depth: number) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentView,
  onChangeView,
  onOpenServiceConfig,
  dataSource,
  sourceUrl,
  isLoading,
  onRefresh,
  filterEmpty,
  onToggleFilterEmpty,
  searchQuery,
  onSearchChange,
  totalCount,
  activeCount,
  isStreaming = false,
  expandDepth = 1,
  onSetExpandDepth,
  onExpandAll,
  onCollapseAll,
}) => {
  return (
    <header className="flex flex-col bg-slate-900 border-b border-slate-800 z-30 shrink-0">
      {/* Upper Row: Strict 3-Zone Top Bar Contract */}
      <div className="flex items-center justify-between gap-8 px-6 py-3 border-b border-slate-850">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm shadow-sm">
            {'{}'}
          </div>
          <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
            JSON Diagram Visualizer
          </span>
        </div>

        {/* Zone 2: Navigation views with clean typography */}
        <nav className="flex items-center gap-6 text-xs font-medium text-slate-400">
          <button
            onClick={() => onChangeView('graph')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              currentView === 'graph'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'hover:text-slate-200'
            }`}
          >
            دیاگرام گرافی (Graph)
          </button>

          <button
            onClick={() => onChangeView('topology')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              currentView === 'topology'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'hover:text-slate-200'
            }`}
          >
            توپولوژی کلاستر (Topology)
          </button>

          <button
            onClick={() => onChangeView('tree')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              currentView === 'tree'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'hover:text-slate-200'
            }`}
          >
            نمای درختی (Tree)
          </button>

          <button
            onClick={() => onChangeView('json')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
              currentView === 'json'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'hover:text-slate-200'
            }`}
          >
            کد خام (Raw JSON)
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenServiceConfig}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
            title="تنظیمات سرویس و جابجایی ماک/زنده"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>تنظیمات سرویس (Service Setup)</span>
          </button>
        </div>
      </div>

      {/* Workspace Secondary Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2 bg-slate-950/60 text-xs">
        {/* Left: Search & Filter Controls */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="جستجو در پروژه‌ها، کلاسترها، محصولات یا فیلدها..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-3 pr-9 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Active Clusters Filter Status or Live Streaming Badge */}
          {isStreaming ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-sm shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>دریافت استریم زنده ({activeCount} کلاستر)...</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium bg-indigo-950/60 border-indigo-700/60 text-indigo-300 shrink-0"
              title="فقط مواردی که isCluster برابر true است نمایش داده می‌شوند"
            >
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                کلاسترهای فعال ({activeCount})
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">
                [isCluster: true]
              </span>
            </div>
          )}

          {/* Depth / Expansion Controls for Graph View */}
          {currentView === 'graph' && onSetExpandDepth && (
            <div className="hidden lg:flex items-center gap-1.5 pl-2 border-r border-slate-800 shrink-0">
              <span className="text-[11px] text-slate-400">عمق دیاگرام:</span>
              <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => onSetExpandDepth(1)}
                  className={`px-2 py-0.5 rounded font-mono transition-colors ${
                    expandDepth === 1
                      ? 'bg-emerald-500/20 text-emerald-400 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="عمق ۱: سریع‌ترین حالت، بارگذاری ۶۰ فریم بر ثانیه"
                >
                  عمق ۱ (سریع)
                </button>
                <button
                  type="button"
                  onClick={() => onSetExpandDepth(2)}
                  className={`px-2 py-0.5 rounded font-mono transition-colors ${
                    expandDepth === 2
                      ? 'bg-emerald-500/20 text-emerald-400 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="عمق ۲: باز کردن زیر‌مجموعه‌های کلاستر"
                >
                  عمق ۲
                </button>
                <button
                  type="button"
                  onClick={() => onSetExpandDepth(4)}
                  className={`px-2 py-0.5 rounded font-mono transition-colors ${
                    expandDepth >= 4
                      ? 'bg-emerald-500/20 text-emerald-400 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="عمق عمیق: باز کردن تمام سطوح"
                >
                  همه سطوح
                </button>
              </div>

              {onCollapseAll && (
                <button
                  type="button"
                  onClick={onCollapseAll}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-400 hover:text-white transition-colors"
                  title="بستن تمام نودها"
                >
                  بستن همه
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Data Source Status & Quick Refresh */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <span className="flex items-center gap-1">
              {dataSource === 'mock' ? (
                <Database className="w-3 h-3 text-emerald-400" />
              ) : (
                <Globe className="w-3 h-3 text-sky-400" />
              )}
              <span className="font-sans text-slate-300">
                منبع:{' '}
                {dataSource === 'mock'
                  ? 'ماک محلی'
                  : dataSource === 'live'
                  ? 'وب‌سرویس زنده'
                  : 'فایل سفارشی'}
              </span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500 truncate max-w-44" title={sourceUrl}>
              {sourceUrl}
            </span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="فراخوانی مجدد سرویس (Refresh)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
