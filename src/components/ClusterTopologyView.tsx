import React from 'react';
import {
  Server,
  Layers,
  Box,
  Activity,
  Globe,
  GitBranch,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Database,
} from 'lucide-react';
import { ClusterItem } from '../types/dataTypes';

interface ClusterTopologyViewProps {
  items: ClusterItem[];
  onSelectClusterItem: (item: ClusterItem) => void;
  searchQuery?: string;
}

export const ClusterTopologyView: React.FC<ClusterTopologyViewProps> = ({
  items,
  onSelectClusterItem,
  searchQuery = '',
}) => {
  // Filter items that have cluster or project information
  const activeClusters = items.filter((item) => {
    if (!item || item.isCluster !== true) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const title = item.clusterConfigInfo?.clusterGetResult?.title || '';
    const projName = item.projectName || '';
    const products = item.productlist?.map((p) => p.productName).join(' ') || '';
    return (
      title.toLowerCase().includes(q) ||
      projName.toLowerCase().includes(q) ||
      products.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full h-full overflow-y-auto p-6 bg-slate-950">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Topology Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-400" />
              <span>نقشه توپولوژی کلاسترها و میکروسرویس‌ها (Cluster Topology)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              نمایش ساختار یافته پروژه‌ها، کلاسترها، درگاه‌های ارتباطی و سرویس‌های زیرساخت
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>تعداد کلاسترهای فعال:</span>
            <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/50 text-indigo-300 font-semibold">
              {activeClusters.length} کلاستر
            </span>
          </div>
        </div>

        {/* Cluster Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeClusters.map((item, idx) => {
            const clusterGet = item.clusterConfigInfo?.clusterGetResult;
            const consul = item.clusterConfigInfo?.consulConfig?.url
              ? item.clusterConfigInfo.consulConfig
              : item.clusterConfigInfo?.consulConfig?.config?.consul;
            const jaeger = item.clusterConfigInfo?.jaegerConfig?.ui
              ? item.clusterConfigInfo.jaegerConfig
              : item.clusterConfigInfo?.jaegerConfig?.config?.jaeger;
            const registry = item.clusterConfigInfo?.register?.url
              ? item.clusterConfigInfo.register
              : item.clusterConfigInfo?.register?.config?.registery;
            const argo = clusterGet?.clusterConfig?.argoCD;
            const products = item.productlist || [];

            return (
              <div
                key={idx}
                onClick={() => onSelectClusterItem(item)}
                className="group relative bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 shadow-lg hover:shadow-indigo-950/30 transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
                        <Server className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {clusterGet?.title || item.projectName || `کلاستر #${idx + 1}`}
                        </h3>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {item.projectName ? `پروژه: ${item.projectName}` : 'تنظیمات زیرساخت'}
                        </span>
                      </div>
                    </div>

                    {clusterGet?.releaseChannelsName && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                        {clusterGet.releaseChannelsName}
                      </span>
                    )}
                  </div>

                  {/* Gateway & Exposure */}
                  {clusterGet?.clusterConfig?.exposure && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-sans">Gateway / Ingress:</span>
                        <span className="text-sky-400">
                          {clusterGet.clusterConfig.exposure.gatewayName || 'N/A'}
                        </span>
                      </div>
                      {clusterGet.clusterConfig.exposure.gatewayNamespace && (
                        <div className="flex items-center justify-between text-slate-500 text-[10px]">
                          <span className="font-sans">Namespace:</span>
                          <span>{clusterGet.clusterConfig.exposure.gatewayNamespace}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Microservices & Infrastructure Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {argo && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-sky-950/40 text-sky-300 border border-sky-800/30">
                        <Activity className="w-3 h-3 text-sky-400" />
                        <span>ArgoCD</span>
                      </span>
                    )}
                    {consul && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-purple-950/40 text-purple-300 border border-purple-800/30">
                        <Box className="w-3 h-3 text-purple-400" />
                        <span>Consul</span>
                      </span>
                    )}
                    {jaeger && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-amber-950/40 text-amber-300 border border-amber-800/30">
                        <Activity className="w-3 h-3 text-amber-400" />
                        <span>Jaeger</span>
                      </span>
                    )}
                    {registry && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/30">
                        <Database className="w-3 h-3 text-emerald-400" />
                        <span>Helm Repo</span>
                      </span>
                    )}
                  </div>

                  {/* Connected Products list */}
                  {products.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          <span>محصولات متصل ({products.length}):</span>
                        </span>
                      </div>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {products.slice(0, 4).map((p, pIdx) => (
                          <div
                            key={pIdx}
                            className="text-[11px] font-mono text-slate-300 flex items-center justify-between py-0.5"
                          >
                            <span className="truncate">{p.productName}</span>
                            <span className="text-[9px] text-slate-500 font-sans">فعال</span>
                          </div>
                        ))}
                        {products.length > 4 && (
                          <div className="text-[10px] text-indigo-400 font-mono">
                            + {products.length - 4} محصول دیگر...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-indigo-400 group-hover:text-indigo-300 font-medium">
                  <span>مشاهده جزئیات و ساختار دیاگرام</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
