import React, { useEffect, useState } from 'react';
import {
  X,
  Copy,
  Check,
  Code2,
  ListTree,
  Server,
  Layers,
  Box,
  ExternalLink,
  Shield,
  Activity,
  FolderTree,
  Zap,
  Play,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { GraphNode } from '../types/dataTypes';
import { ProductActionState } from '../types/actionTypes';
import { ClusterConfigEditor } from './ClusterConfigEditor';

interface DetailInspectorProps {
  node: GraphNode | null;
  onClose: () => void;
  rawJsonData: any;
  productActionStates?: Record<string, ProductActionState>;
  onExecuteAction?: (productId: string, actionType: 'helm' | 'publish' | 'module') => void;
  clusterGraphqlEndpoint?: string;
  authToken?: string;
  onClusterConfigSaved?: () => void;
}

export const DetailInspector: React.FC<DetailInspectorProps> = ({
  node,
  onClose,
  rawJsonData,
  productActionStates = {},
  onExecuteAction,
  clusterGraphqlEndpoint = 'https://studio-gateway-gen3.depna.ir/wrksp/graphql',
  authToken = '',
  onClusterConfigSaved,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showClusterEditor, setShowClusterEditor] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'pipeline' | 'json'>(
    node?.isActionNode ? 'pipeline' : 'details'
  );

  // Selecting the clusterConfig child in the graph should open its editor,
  // while the mutation still needs the owning ClusterGetResult (guid + config).
  const isClusterConfigNode = !!node && (
    node.label === 'clusterConfig' || /(?:^|\.)clusterConfig$/.test(node.rawPath)
  );
  useEffect(() => {
    setShowClusterEditor(isClusterConfigNode);
  }, [node?.id, isClusterConfigNode]);

  if (!node) return null;

  // Resolve JSON value from rawPath
  const resolvedValue = resolvePath(rawJsonData, node.rawPath);
  const clusterOwnerPath = isClusterConfigNode
    ? node.rawPath.replace(/\.clusterConfig$/, '')
    : '';
  const clusterOwner = clusterOwnerPath ? resolvePath(rawJsonData, clusterOwnerPath) : null;
  // Also walk the selected node's ancestors. This handles graph paths with
  // array indexes and nested clusterConfigInfo.clusterGetResult objects.
  const pathTokens = node.rawPath.replace(/^\$\.?/, '').split(/[.\[\]]+/).filter(Boolean);
  let ancestor: any = rawJsonData;
  let owningCluster: any = null;
  for (const token of pathTokens) {
    if (ancestor && typeof ancestor === 'object' && ancestor.clusterConfig === resolvedValue) {
      owningCluster = ancestor;
      break;
    }
    ancestor = ancestor?.[token];
  }
  if (!owningCluster && ancestor && typeof ancestor === 'object' && ancestor.clusterConfig === resolvedValue) {
    owningCluster = ancestor;
  }
  const clusterGetResult =
    (resolvedValue?.guid && resolvedValue?.clusterConfig ? resolvedValue : null) ||
    (clusterOwner?.clusterConfig ? clusterOwner : null) ||
    (owningCluster?.clusterConfig ? owningCluster : null) ||
    resolvedValue?.clusterConfigInfo?.clusterGetResult ||
    resolvedValue?.clusterGetResult;
  const clusterCardData = clusterGetResult
    ? { clusterConfigInfo: { clusterGetResult } }
    : resolvedValue;

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <aside className="w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col h-full shadow-2xl backdrop-blur-md z-30 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2 truncate">
          <span
            className={`font-mono text-xs px-1.5 py-0.5 rounded font-semibold ${
              node.isClusterNode
                ? 'text-indigo-300 bg-indigo-950 border border-indigo-800/40'
                : node.type === 'array'
                ? 'text-sky-300 bg-sky-950 border border-sky-800/40'
                : 'text-emerald-300 bg-emerald-950 border border-emerald-800/40'
            }`}
          >
            {node.isClusterNode ? 'Cluster Node' : node.type}
          </span>
          <h2 className="text-sm font-semibold text-slate-100 truncate" title={node.label}>
            {node.label}
          </h2>
        </div>

        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-lg transition-colors"
          title="بستن پنل"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Path Bar */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="font-mono text-[11px] text-slate-400 truncate flex items-center gap-1.5">
          <span className="text-slate-600 font-sans">مسیر:</span>
          <span className="text-emerald-400 truncate" title={node.rawPath}>
            {node.rawPath}
          </span>
        </div>
        <button
          onClick={() => handleCopy(node.rawPath, 'path')}
          className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800 rounded transition-colors shrink-0"
          title="کپی مسیر JSON"
        >
          {copiedKey === 'path' ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-800 bg-slate-900/50 p-1 gap-1">
        {node.actionMetadata && (
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'pipeline'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-400/80 hover:text-amber-300 hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>پایپ‌لاین عملیات</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'details'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListTree className="w-3.5 h-3.5" />
          <span>مشخصات</span>
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'json'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>JSON خام</span>
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'pipeline' && node.actionMetadata ? (
          /* Pipeline Tab */
          renderProductPipeline(
            node.actionMetadata,
            productActionStates[node.actionMetadata.productId],
            onExecuteAction,
            handleCopy,
            copiedKey
          )
        ) : activeTab === 'details' ? (
          <>
            {/* Quick banner if this node has actions */}
            {node.actionMetadata && (
              <div
                onClick={() => setActiveTab('pipeline')}
                className="p-3 rounded-lg border border-amber-600/40 bg-amber-950/20 hover:bg-amber-950/30 cursor-pointer flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="text-xs font-semibold text-amber-200">
                      پایپ‌لاین Helm & Module برای این محصول فعال است
                    </div>
                    <div className="text-[10px] text-slate-400">
                      برای اجرای سرویس‌ها کلیک کنید
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-amber-400">ورود به عملیات ←</span>
              </div>
            )}

            {/* Special Cluster Info Card if applicable */}
            {renderSpecialServiceCards(
              clusterCardData,
              handleCopy,
              copiedKey,
              () => setShowClusterEditor(true)
            )}
            {showClusterEditor && clusterGetResult && (
              <ClusterConfigEditor
                cluster={clusterGetResult}
                endpoint={clusterGraphqlEndpoint}
                authToken={authToken}
                onClose={() => setShowClusterEditor(false)}
                onSaved={() => onClusterConfigSaved?.()}
              />
            )}
            {isClusterConfigNode && !clusterGetResult && (
              <div className="rounded-lg border border-rose-800/60 bg-rose-950/20 p-3 text-xs text-rose-300">
                اطلاعات اصلی کلاستر برای ویرایش پیدا نشد. نود باید از مسیر clusterGetResult.clusterConfig انتخاب شود.
              </div>
            )}

            {/* Properties Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">
                  فیلدها و مقادیر ({node.fields.length})
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Key-Value</span>
              </div>

              <div className="rounded-lg border border-slate-800 overflow-hidden divide-y divide-slate-800/80 bg-slate-950/40">
                {node.fields.map((field) => (
                  <div
                    key={field.id}
                    className="p-2.5 hover:bg-slate-850/50 flex flex-col gap-1 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-medium text-slate-200">
                        {field.key}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        {field.valueType}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-xs truncate max-w-[80%]">
                        {field.valueType === 'object' || field.valueType === 'array' ? (
                          <span className="text-indigo-400 font-semibold">
                            {field.valueType === 'array' ? 'Array / لیست' : 'Object / آبجکت'}
                          </span>
                        ) : field.valueType === 'string' ? (
                          <span className="text-emerald-400 break-all select-all">
                            "{String(field.value)}"
                          </span>
                        ) : field.valueType === 'boolean' ? (
                          <span className={field.value ? 'text-amber-400' : 'text-rose-400'}>
                            {String(field.value)}
                          </span>
                        ) : field.valueType === 'number' ? (
                          <span className="text-sky-400 tabular-nums">{field.value}</span>
                        ) : (
                          <span className="text-slate-500 italic">null</span>
                        )}
                      </div>

                      {field.value !== null &&
                        typeof field.value !== 'object' && (
                          <button
                            onClick={() => handleCopy(String(field.value), field.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 transition-opacity"
                            title="کپی مقدار"
                          >
                            {copiedKey === field.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Raw JSON Tab */
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-mono">
                {typeof resolvedValue === 'object' && resolvedValue !== null
                  ? Array.isArray(resolvedValue)
                    ? `آرایه (${resolvedValue.length} عضو)`
                    : `آبجکت (${Object.keys(resolvedValue).length} فیلد)`
                  : 'مقدار تکی'}
              </span>
              <button
                onClick={() =>
                  handleCopy(JSON.stringify(resolvedValue, null, 2), 'full_json')
                }
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
              >
                {copiedKey === 'full_json' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>کپی شد</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>کپی JSON</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-emerald-300/90 overflow-x-auto max-h-[500px] leading-relaxed">
              {JSON.stringify(resolvedValue, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </aside>
  );
};

/**
 * کارت‌های تخصصی برای سرویس‌های کلاستر (Consul, Jaeger, ArgoCD, Kubernetes, Products)
 */
function renderSpecialServiceCards(
  data: any,
  onCopy: (text: string, id: string) => void,
  copiedKey: string | null,
  onEditCluster: () => void
) {
  if (!data || typeof data !== 'object') return null;

  // Check if it's a cluster config or contains clusterGetResult
  const clusterInfo = data.clusterConfigInfo || data;
  const clusterGet = clusterInfo?.clusterGetResult || (clusterInfo?.guid && clusterInfo?.clusterConfig ? clusterInfo : null);

  // Support both new flattened structure and legacy nested structure
  const consul = clusterInfo?.consulConfig?.url
    ? clusterInfo.consulConfig
    : clusterInfo?.consulConfig?.config?.consul;

  const jaeger = clusterInfo?.jaegerConfig?.ui
    ? clusterInfo.jaegerConfig
    : clusterInfo?.jaegerConfig?.config?.jaeger;

  const registry = clusterInfo?.register?.url
    ? clusterInfo.register
    : clusterInfo?.register?.config?.registery;

  const argo = clusterGet?.clusterConfig?.argoCD;
  const products = Array.isArray(data.productlist) ? data.productlist : null;

  const hasSpecialServices = clusterGet || consul || jaeger || registry || argo || products;

  if (!hasSpecialServices) return null;

  return (
    <div className="space-y-3">
      {/* Cluster Meta */}
      {clusterGet && (
        <button
          type="button"
          onClick={onEditCluster}
          className="w-full text-right p-3 rounded-lg border border-indigo-900/50 bg-indigo-950/20 hover:bg-indigo-950/40 hover:border-indigo-700 transition-colors space-y-2 cursor-pointer"
          title="برای ویرایش تنظیمات کلاستر کلیک کنید"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
              <Server className="w-3.5 h-3.5" />
              <span>Cluster Config ({clusterGet.title || 'تنظیمات'})</span>
            </div>
            <span className="text-[10px] text-indigo-300">ویرایش تنظیمات ←</span>
          </div>
          <div className="text-[11px] space-y-1 text-slate-300 font-mono">
            <div><span className="text-slate-500 font-sans">شناسه کلاستر: </span>{clusterGet.id || clusterGet.guid}</div>
            <div><span className="text-slate-500 font-sans">کانال انتشار: </span><span className="text-emerald-400 font-sans">{clusterGet.releaseChannelsName || 'پیش‌فرض'}</span></div>
            {clusterGet.clusterConfig?.exposure?.gatewayName && (
              <div><span className="text-slate-500 font-sans">Gateway: </span>{clusterGet.clusterConfig.exposure.gatewayName} ({clusterGet.clusterConfig.exposure.ingressClassName || 'nginx'})</div>
            )}
          </div>
        </button>
      )}

      {/* ArgoCD */}
      {argo && (
        <div className="p-3 rounded-lg border border-sky-900/40 bg-sky-950/20 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>ArgoCD Deployment</span>
            </div>
            {argo.address && (
              <a
                href={argo.address}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:text-sky-200"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="text-[11px] font-mono text-slate-300">
            <div className="truncate">
              <span className="text-slate-500 font-sans">آدرس: </span>
              {argo.address || 'تعیین نشده'}
            </div>
            <div>
              <span className="text-slate-500 font-sans">کاربر: </span>
              {argo.user || '-'}
            </div>
          </div>
        </div>
      )}

      {/* Consul & Jaeger & Registry Quick Info */}
      {(consul || jaeger || registry) && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {consul && (
              <div className="p-2.5 rounded-lg border border-purple-900/40 bg-purple-950/20 text-xs">
                <div className="text-purple-300 font-medium mb-1 flex items-center gap-1">
                  <Box className="w-3 h-3" />
                  <span>Consul KV</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate" title={consul.url}>
                  {consul.url}
                </div>
                {consul.project && (
                  <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                    {consul.project}
                  </div>
                )}
              </div>
            )}

            {jaeger && (
              <div className="p-2.5 rounded-lg border border-amber-900/40 bg-amber-950/20 text-xs">
                <div className="text-amber-300 font-medium mb-1 flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  <span>Jaeger Tracing</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate" title={jaeger.ui}>
                  UI: {jaeger.ui}
                </div>
                {jaeger.collector && (
                  <div className="text-[9px] font-mono text-slate-500 truncate">
                    Col: {jaeger.collector}
                  </div>
                )}
              </div>
            )}
          </div>

          {registry && (
            <div className="p-2.5 rounded-lg border border-emerald-900/40 bg-emerald-950/20 text-xs">
              <div className="text-emerald-300 font-medium mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Server className="w-3 h-3" />
                  <span>Package Registry ({registry.name || 'Helm'})</span>
                </div>
                {registry.url && (
                  <a
                    href={registry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-200"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="text-[10px] font-mono text-slate-300 truncate" title={registry.url}>
                {registry.url}
              </div>
              {registry.username && (
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                  کاربر: {registry.username}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Product List */}
      {products && products.length > 0 && (
        <div className="p-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
            <div className="flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5" />
              <span>محصولات متصل ({products.length})</span>
            </div>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {products.map((p: any, i: number) => (
              <div
                key={i}
                className="p-1.5 bg-slate-900/60 rounded border border-slate-800 text-[11px] font-mono flex items-center justify-between"
              >
                <span className="text-slate-200 truncate">{p.productName}</span>
                <span className="text-[9px] text-slate-500 truncate max-w-[40%]">
                  {p.branchMain ? `branch: ${p.branchMain.slice(0, 8)}...` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper to resolve object by path
 */
function resolvePath(obj: any, path: string): any {
  if (!obj || !path || path === '$') return obj;
  try {
    const cleanPath = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;
    const tokens = cleanPath.match(/[^.\[\]]+/g) || [];
    let current = obj;
    for (const token of tokens) {
      if (current === undefined || current === null) return null;
      current = current[token];
    }
    return current;
  } catch (e) {
    return obj;
  }
}

/**
 * رندر پنل اختصاصی پایپ‌لاین عملیاتی محصول (HelmChart & ModuleProduct)
 */
function renderProductPipeline(
  meta: NonNullable<GraphNode['actionMetadata']>,
  actionState: ProductActionState | undefined,
  onExecuteAction?: (productId: string, actionType: 'helm' | 'publish' | 'module') => void,
  handleCopy?: (text: string, id: string) => void,
  copiedKey?: string | null
) {
  const isHelmBuilding = actionState?.step === 'building_helm';
  const isHelmDone = !!actionState?.packageGuid;
  const hasRegistryWarning =
    actionState?.requiresPublishRetry ||
    actionState?.step === 'helm_warning_registry';
  const isPublishing = actionState?.step === 'publishing_package';
  const isModuleAdding = actionState?.step === 'adding_module';
  const isModuleDone = !!actionState?.moduleGuid;
  const isModuleLocked = !actionState?.packageGuid;

  return (
    <div className="space-y-4">
      {/* Product Metadata Summary Card */}
      <div className="p-3 rounded-lg border border-amber-600/30 bg-amber-950/20 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-amber-300 text-xs font-semibold">
            <Zap className="w-4 h-4" />
            <span>پایپ‌لاین محصول: {meta.productName}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
            {actionState?.step || 'idle'}
          </span>
        </div>

        <div className="space-y-1.5 text-[11px] font-mono text-slate-300 divide-y divide-slate-800/60 pt-1">
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-500 font-sans">ProductGuid:</span>
            <div className="flex items-center gap-1">
              <span className="text-emerald-400 select-all" title={meta.productId}>
                {meta.productId.slice(0, 16)}...
              </span>
              {handleCopy && (
                <button
                  onClick={() => handleCopy(meta.productId, 'copy_product_id')}
                  className="p-0.5 text-slate-500 hover:text-slate-300 rounded"
                >
                  {copiedKey === 'copy_product_id' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-500 font-sans">BranchGuid (branchMain):</span>
            <div className="flex items-center gap-1">
              <span className="text-sky-400 select-all" title={meta.branchGuid}>
                {meta.branchGuid.slice(0, 16)}...
              </span>
              {handleCopy && (
                <button
                  onClick={() => handleCopy(meta.branchGuid, 'copy_branch_id')}
                  className="p-0.5 text-slate-500 hover:text-slate-300 rounded"
                >
                  {copiedKey === 'copy_branch_id' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-500 font-sans">ProjectGuid (ریشه والد):</span>
            <div className="flex items-center gap-1">
              <span className="text-indigo-400 select-all" title={meta.projectGuid}>
                {meta.projectGuid ? `${meta.projectGuid.slice(0, 16)}...` : 'بدون مقدار'}
              </span>
              {handleCopy && meta.projectGuid && (
                <button
                  onClick={() => handleCopy(meta.projectGuid, 'copy_project_id')}
                  className="p-0.5 text-slate-500 hover:text-slate-300 rounded"
                >
                  {copiedKey === 'copy_project_id' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Persistent per-operation history */}
      {actionState?.operationHistory && (
        <div className="p-3 rounded-lg border border-slate-700 bg-slate-950/70 space-y-2">
          <div className="text-xs font-semibold text-slate-200">سوابق آخرین وضعیت عملیات</div>
          {(['helm', 'publish', 'module'] as const).map((operation) => {
            const entry = actionState.operationHistory?.[operation];
            if (!entry) return null;
            const labels = {
              helm: 'ساخت HelmChart',
              publish: 'ثبت Package در Registry',
              module: 'ساخت ModuleProduct',
            };
            const successful = entry.status === 'success';
            const interrupted = entry.status === 'interrupted';
            return (
              <div key={operation} className="border-t border-slate-800 pt-2 space-y-1">
                <div className="flex items-center gap-2 text-[11px]">
                  {successful ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span className="text-slate-200 font-medium">{labels[operation]}</span>
                  <span className={successful ? 'mr-auto text-emerald-400' : 'mr-auto text-rose-300'}>
                    {successful ? 'موفق' : interrupted ? 'متوقف‌شده' : 'ناموفق'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 break-words">{entry.message}</p>
                <div className="text-[9px] text-slate-500 font-mono" dir="ltr">
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
                {entry.response && (
                  <details className="text-[10px] text-slate-400">
                    <summary className="cursor-pointer hover:text-slate-200">جزئیات پاسخ همین عملیات</summary>
                    <pre className="mt-1 p-2 rounded bg-slate-950 whitespace-pre-wrap break-words overflow-x-auto max-h-36">
                      {JSON.stringify(entry.response, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Operation-specific error details */}
      {actionState?.operationErrors &&
        (Object.keys(actionState.operationErrors) as Array<'helm' | 'publish' | 'module'>)
          .filter((operation) => !!actionState.operationErrors?.[operation])
          .map((operation) => {
            const failure = actionState.operationErrors?.[operation];
            if (!failure) return null;
            const operationLabels = {
              helm: 'ساخت HelmChart',
              publish: 'ثبت Package در Registry',
              module: 'ساخت ModuleProduct',
            };
            return (
              <div
                key={operation}
                className="p-3 rounded-lg border border-rose-700/60 bg-rose-950/30 space-y-2"
              >
                <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>خطا در {operationLabels[operation]}</span>
                  {(typeof failure.httpStatus === 'number' ||
                    typeof failure.statusCode === 'number') && (
                    <span className="mr-auto font-mono text-[10px] text-rose-200">
                      {typeof failure.httpStatus === 'number'
                        ? `HTTP ${failure.httpStatus}`
                        : `کد سرویس ${failure.statusCode}`}
                      {typeof failure.httpStatus === 'number' &&
                        typeof failure.statusCode === 'number' &&
                        failure.statusCode !== failure.httpStatus &&
                        ` | کد سرویس ${failure.statusCode}`}
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-rose-100 break-words">
                  {failure.message}
                </p>
                {failure.requestId && (
                  <div className="text-[10px] text-slate-400 font-mono break-all">
                    Request ID: {failure.requestId}
                  </div>
                )}
                {failure.subStatuses && failure.subStatuses.length > 0 && (
                  <div className="space-y-1.5 border-t border-rose-900/60 pt-2">
                    <div className="text-[10px] text-rose-200 font-semibold">
                      جزئیات خطاهای برگشتی سرویس ({failure.subStatuses.length})
                    </div>
                    {failure.subStatuses.map((item, index) => (
                      <div
                        key={`${operation}-${index}`}
                        className="rounded bg-slate-950/70 p-2 text-[10px] space-y-1"
                      >
                        <div className="flex flex-wrap gap-x-2 text-slate-400">
                          {item.subject && <span>موضوع: {item.subject}</span>}
                          <span>کد: {item.subStatusCode}</span>
                          {item.subActionType !== undefined && (
                            <span>نوع عملیات: {item.subActionType}</span>
                          )}
                        </div>
                        {item.message && (
                          <p className="text-rose-200 break-words">{item.message}</p>
                        )}
                        {item.exception && (
                          <pre className="text-slate-400 whitespace-pre-wrap break-words overflow-x-auto">
                            {typeof item.exception === 'string'
                              ? item.exception
                              : JSON.stringify(item.exception, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {failure.exception && (
                  <details className="text-[10px] text-slate-400">
                    <summary className="cursor-pointer hover:text-slate-200">
                      مشاهده Exception
                    </summary>
                    <pre className="mt-1 p-2 rounded bg-slate-950 whitespace-pre-wrap break-words overflow-x-auto">
                      {typeof failure.exception === 'string'
                        ? failure.exception
                        : JSON.stringify(failure.exception, null, 2)}
                    </pre>
                  </details>
                )}
                {failure.rawResponse && (
                  <details className="text-[10px] text-slate-400">
                    <summary className="cursor-pointer hover:text-slate-200">
                      مشاهده متن خام پاسخ
                    </summary>
                    <pre className="mt-1 p-2 rounded bg-slate-950 whitespace-pre-wrap break-words overflow-x-auto">
                      {failure.rawResponse}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}

      {/* STEP 1: Build HelmChart */}
      <div
        className={`p-3 rounded-lg border transition-all ${
          isHelmDone
            ? 'border-emerald-600/50 bg-emerald-950/20'
            : 'border-slate-800 bg-slate-900/60'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs bg-sky-950 text-sky-400 border border-sky-800">
              ۱
            </span>
            <span className="text-xs font-semibold text-slate-200">
              ساخت HelmChart
            </span>
          </div>
          {isHelmDone ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>موفقیت‌آمیز</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono">POST</span>
          )}
        </div>

        <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
          ارسال دستور <code className="text-sky-300 font-mono text-[10px]">InstallModuleCommand</code> شامل BranchGuid، ProjectGuid و ProductGuid جهت ایجاد چارت هلم.
        </p>

        {/* Headers Preview */}
        <div className="mb-2 p-1.5 rounded bg-slate-950/70 border border-slate-800 text-[10px] font-mono space-y-0.5 text-slate-400">
          <div className="text-[9px] text-slate-500 font-sans font-medium">هدرهای اختصاصی درخواست:</div>
          <div className="flex justify-between"><span className="text-slate-500">resource-type:</span> <span className="text-sky-400">PRODUCT</span></div>
          <div className="flex justify-between truncate"><span className="text-slate-500">resource-ref-id:</span> <span className="text-emerald-400 truncate max-w-[170px]" title={meta.productId}>{meta.productId}</span></div>
          <div className="flex justify-between truncate"><span className="text-slate-500">branch-id:</span> <span className="text-amber-400 truncate max-w-[170px]" title={meta.branchGuid}>{meta.branchGuid}</span></div>
        </div>

        {/* Helm Result if available */}
        {actionState?.helmBuildData && (
          <div className="p-2 mb-2 rounded bg-slate-950/80 border border-slate-800 text-[10px] font-mono space-y-1 text-slate-300">
            <div className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>چارت با مشخصات زیر تولید شد:</span>
            </div>
            <div>
              <span className="text-slate-500">Version:</span>{' '}
              {actionState.helmBuildData.version}
            </div>
            <div>
              <span className="text-slate-500">PackageGuid_SC:</span>{' '}
              <span className="text-amber-300 select-all">
                {actionState.helmBuildData.packageGuid_SC}
              </span>
            </div>
            <div>
              <span className="text-slate-500">PackageName:</span>{' '}
              {actionState.helmBuildData.packageName}
            </div>
            <div>
              <span className="text-slate-500">SolutionName:</span>{' '}
              {actionState.helmBuildData.solutionName}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            if (onExecuteAction) onExecuteAction(meta.productId, 'helm');
          }}
          disabled={isHelmBuilding}
          className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
            isHelmBuilding
              ? 'bg-sky-600/30 text-sky-300 border border-sky-500/40 cursor-wait'
              : isHelmDone
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              : 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-950 active:scale-95'
          }`}
        >
          {isHelmBuilding ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>در حال ارسال درخواست ساخت...</span>
            </>
          ) : isHelmDone ? (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>اجرای مجدد ساخت HelmChart</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>اجرای ساخت HelmChart</span>
            </>
          )}
        </button>
      </div>

      {/* STEP 2: Registry Warning & Retry */}
      {!!actionState?.packageGuid && (
        <div className="p-3 rounded-lg border border-amber-600/70 bg-amber-950/40 space-y-2 animate-in fade-in">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{hasRegistryWarning ? 'هشدار: پکیج در Helm Registry یافت نشد!' : 'ثبت مجدد / استعلام وضعیت Package'}</span>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed font-mono">
            {hasRegistryWarning ? (actionState?.errorMessage || 'Package was not found in the Helm registry after max attempts.') : 'برای بررسی مجدد وضعیت ثبت پکیج، می‌توانید این عملیات را دوباره اجرا کنید.'}
          </p>
          <button
            onClick={() => {
              if (onExecuteAction) onExecuteAction(meta.productId, 'publish');
            }}
            disabled={isPublishing}
            className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-md shadow-amber-950 active:scale-95 transition-all"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>در حال تلاش دوباره برای ثبت در رجیستری...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>استعلام مجدد / تلاش دوباره برای ثبت Package</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* STEP 3: Add ModuleProduct */}
      <div
        className={`p-3 rounded-lg border transition-all ${
          isModuleDone
            ? 'border-emerald-600/50 bg-emerald-950/20'
            : isModuleLocked
            ? 'border-slate-800/80 bg-slate-950/40 opacity-75'
            : 'border-indigo-600/50 bg-indigo-950/20'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${
                isModuleLocked
                  ? 'bg-slate-800 text-slate-500 border border-slate-700'
                  : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
              }`}
            >
              ۲
            </span>
            <span className="text-xs font-semibold text-slate-200">
              ساخت ModuleProduct
            </span>
          </div>

          <div className="flex items-center gap-1">
            {isModuleLocked ? (
              <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                <Lock className="w-3 h-3" />
                <span>قفل</span>
              </span>
            ) : isModuleDone ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>ساخته شد</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-medium">
                <Unlock className="w-3 h-3" />
                <span>آماده</span>
              </span>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
          {isModuleLocked ? (
            <span className="text-slate-500">
              🔒 این مرحله تا زمانی که{' '}
              <code className="text-slate-400 font-mono text-[10px]">
                PackageGuid_SC
              </code>{' '}
              از مرحله قبل تولید نشود، قفل و غیرفعال است.
            </span>
          ) : (
            <span>
              ارسال به سرویس{' '}
              <code className="text-indigo-300 font-mono text-[10px]">
                AddModuleProduct/{actionState?.packageGuid?.slice(0, 8)}...
              </code>
            </span>
          )}
        </p>

        {/* Headers Preview for ModuleProduct */}
        <div className="mb-2 p-1.5 rounded bg-slate-950/70 border border-slate-800 text-[10px] font-mono space-y-0.5 text-slate-400">
          <div className="text-[9px] text-slate-500 font-sans font-medium">هدرهای ارسالی درخواست:</div>
          <div className="flex justify-between"><span className="text-slate-500">resource-type:</span> <span className="text-sky-400">PRODUCT</span></div>
          <div className="flex justify-between truncate"><span className="text-slate-500">resource-ref-id:</span> <span className="text-emerald-400 truncate max-w-[170px]" title={meta.productId}>{meta.productId}</span></div>
          <div className="flex justify-between truncate"><span className="text-slate-500">branch-id:</span> <span className="text-amber-400 truncate max-w-[170px]" title={meta.branchGuid}>{meta.branchGuid}</span></div>
        </div>

        {/* ModuleGuid result if created */}
        {actionState?.moduleGuid && (
          <div className="p-2 mb-2 rounded bg-slate-950/80 border border-emerald-900/60 text-[10px] font-mono space-y-1 text-slate-300">
            <div className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>ماژول محصول با موفقیت ایجاد شد:</span>
            </div>
            <div>
              <span className="text-slate-500">ModuleGuid: </span>
              <span className="text-emerald-300 font-semibold select-all">
                {actionState.moduleGuid}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            if (onExecuteAction) onExecuteAction(meta.productId, 'module');
          }}
          disabled={isModuleLocked || isModuleAdding}
          className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
            isModuleLocked
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              : isModuleAdding
              ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 cursor-wait'
              : isModuleDone
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950 active:scale-95'
          }`}
        >
          {isModuleLocked ? (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>قفل (نیازمند PackageGuid)</span>
            </>
          ) : isModuleAdding ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>در حال ایجاد ماژول محصول...</span>
            </>
          ) : isModuleDone ? (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>ایجاد مجدد ModuleProduct</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>ساخت ModuleProduct</span>
            </>
          )}
        </button>
      </div>

      {/* Server Response Viewer if available */}
      {actionState?.lastResponse && (
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              <span>آخرین پاسخ دریافتی سرور</span>
            </div>
            {handleCopy && (
              <button
                onClick={() =>
                  handleCopy(
                    JSON.stringify(actionState.lastResponse, null, 2),
                    'copy_last_resp'
                  )
                }
                className="text-[10px] text-slate-400 hover:text-slate-200"
              >
                {copiedKey === 'copy_last_resp' ? 'کپی شد' : 'کپی'}
              </button>
            )}
          </div>
          <pre className="p-2 bg-slate-950 rounded border border-slate-800/80 text-[10px] font-mono text-emerald-400/90 max-h-40 overflow-y-auto leading-relaxed">
            {JSON.stringify(actionState.lastResponse, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
