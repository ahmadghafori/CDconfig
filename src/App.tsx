import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchClusterServiceStream,
  getActiveServiceConfig,
  saveActiveServiceConfig,
  DataFetchResult,
  StreamProgressStats,
} from './services/dataService';
import { ServiceConfig } from './config/apiConfig';
import { ClusterItem, GraphNode, ViewMode } from './types/dataTypes';
import { buildJsonGraph } from './utils/jsonCrackLayout';
import { TopNavbar } from './components/TopNavbar';
import { GraphCanvas } from './components/GraphCanvas';
import { DetailInspector } from './components/DetailInspector';
import { ServiceConfigModal } from './components/ServiceConfigModal';
import { ClusterTopologyView } from './components/ClusterTopologyView';
import { TreeExplorerView } from './components/TreeExplorerView';
import { RawJsonEditorView } from './components/RawJsonEditorView';
import {
  AlertCircle,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Layers,
  Server,
  Zap,
  Database,
} from 'lucide-react';
import { ProductActionState } from './types/actionTypes';
import {
  executeBuildHelmChart,
  executeRetryPublishPackage,
  executeAddModuleProduct,
  checkIsRegistryNotFoundError,
} from './services/productActionService';

export default function App() {
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig>(getActiveServiceConfig);
  const [dataResult, setDataResult] = useState<DataFetchResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<ViewMode>('graph');
  const [filterEmpty, setFilterEmpty] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [expandDepth, setExpandDepth] = useState<number>(1);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState<boolean>(false);
  const [loadingSeconds, setLoadingSeconds] = useState<number>(0);
  const [productActionStates, setProductActionStates] = useState<Record<string, ProductActionState>>({});

  // Timer while loading to show progress during long queries
  useEffect(() => {
    let interval: any = null;
    if (isLoading) {
      setLoadingSeconds(0);
      interval = setInterval(() => {
        setLoadingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setLoadingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [, setStreamStats] = useState<StreamProgressStats | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Load data from service/mock using real-time streaming
  const loadData = useCallback(async (customConfig?: Partial<ServiceConfig>) => {
    // Abort previous in-flight request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setIsStreaming(true);
    setError(null);

    const activeConf = { ...serviceConfig, ...(customConfig || {}) };
    const targetUrl = activeConf.defaultSource === 'mock' ? activeConf.mockDataUrl : activeConf.serviceUrl;

    try {
      await fetchClusterServiceStream(
        {
          signal: controller.signal,
          onItemReceived: (_newItem, allClustersSoFar, stats) => {
            // Dismiss blocking loading overlay as soon as the first cluster arrives!
            setIsLoading(false);
            setStreamStats(stats);
            setDataResult({
              data: allClustersSoFar,
              rawTotalCount: stats.rawReceivedCount,
              source: activeConf.defaultSource,
              sourceUrl: targetUrl,
              durationMs: 0,
              timestamp: new Date().toISOString(),
              stats: {
                totalItems: allClustersSoFar.length,
                activeClusters: allClustersSoFar.length,
                namedProjects: stats.namedProjects,
                totalProducts: stats.totalProducts,
                uniqueClouds: stats.uniqueClouds,
                excludedNonClusters: stats.excludedNonClusters,
              },
            });
          },
          onComplete: (finalResult) => {
            setIsLoading(false);
            setIsStreaming(false);
            setDataResult(finalResult);
          },
          onError: (err) => {
            setIsLoading(false);
            setIsStreaming(false);
            setError(err.message || 'خطایی در دریافت اطلاعات رخ داده است.');
          },
        },
        customConfig
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setIsLoading(false);
        setIsStreaming(false);
        setError(err.message || 'خطایی در دریافت اطلاعات رخ داده است.');
      }
    }
  }, [serviceConfig]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute graph nodes & edges
  const { nodes, edges } = useMemo(() => {
    if (!dataResult || !dataResult.data) {
      return { nodes: [], edges: [] };
    }
    return buildJsonGraph(dataResult.data, collapsedMap, {
      filterEmptyClusters: filterEmpty,
      searchQuery,
      maxAutoExpandDepth: expandDepth,
    });
  }, [dataResult, collapsedMap, filterEmpty, searchQuery, expandDepth]);

  // Handle toggling node collapse in graph
  const handleToggleCollapse = (nodeIdOrPath: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [nodeIdOrPath]: prev[nodeIdOrPath] !== undefined ? !prev[nodeIdOrPath] : false,
    }));
  };

  const handleSetExpandDepth = (depth: number) => {
    setExpandDepth(depth);
    setCollapsedMap({});
  };

  const handleCollapseAll = () => {
    // Set all root paths to collapsed
    const newCollapsed: Record<string, boolean> = {};
    nodes.forEach((n) => {
      newCollapsed[n.rawPath] = true;
      newCollapsed[n.id] = true;
    });
    setCollapsedMap(newCollapsed);
    setExpandDepth(0);
  };

  // Handle uploading custom JSON file
  const handleUploadCustomJson = (jsonData: any, fileName: string) => {
    const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
    // Filter out isCluster === false
    const clusterItems = dataArray.filter((i) => i && i.isCluster === true);
    setDataResult({
      data: clusterItems,
      rawTotalCount: dataArray.length,
      source: 'custom',
      sourceUrl: fileName,
      durationMs: 0,
      timestamp: new Date().toISOString(),
      stats: {
        totalItems: clusterItems.length,
        activeClusters: clusterItems.length,
        namedProjects: clusterItems.filter((i) => i.projectName).length,
        totalProducts: clusterItems.reduce(
          (acc, i) => acc + (Array.isArray(i.productlist) ? i.productlist.length : 0),
          0
        ),
        uniqueClouds: [],
        excludedNonClusters: dataArray.length - clusterItems.length,
      },
    });
  };

  // Handle saving new service config
  const handleSaveConfig = (newConfig: ServiceConfig) => {
    setServiceConfig(newConfig);
    saveActiveServiceConfig(newConfig);
  };

  // When clicking on a cluster item in Topology view, jump to it or inspect it
  const handleSelectClusterItem = (item: ClusterItem) => {
    // Find matching graph node if available
    const matchedNode = nodes.find(
      (n) =>
        (item.projectName && n.label === item.projectName) ||
        (item.clusterConfigInfo?.clusterGetResult?.title &&
          n.label === item.clusterConfigInfo.clusterGetResult.title)
    );
    if (matchedNode) {
      setSelectedNode(matchedNode);
    }
    setCurrentView('graph');
  };

  // اجرای اکشن‌های پایپ‌لاین محصول (HelmChart, Publish Retry, ModuleProduct)
  const handleExecuteAction = useCallback(
    async (productId: string, actionType: 'helm' | 'publish' | 'module') => {
      // پیدا کردن متادیتاهای محصول
      const nodeWithMeta = nodes.find((n) => n.actionMetadata?.productId === productId);
      const meta = nodeWithMeta?.actionMetadata;
      const currentState = productActionStates[productId];

      const branchGuid = meta?.branchGuid || currentState?.branchGuid || '';
      const projectGuid = meta?.projectGuid || currentState?.projectGuid || '';
      const productName = meta?.productName || currentState?.productName || 'محصول';

      if (actionType === 'helm') {
        setProductActionStates((prev) => ({
          ...prev,
          [productId]: {
            productId,
            productName,
            branchGuid,
            projectGuid,
            step: 'building_helm',
            packageGuid: prev[productId]?.packageGuid || null,
            requiresPublishRetry: false,
            errorMessage: null,
            lastMessage: 'در حال ارسال درخواست ساخت HelmChart...',
            timestamp: new Date().toLocaleTimeString('fa-IR'),
          },
        }));

        try {
          const res = await executeBuildHelmChart(
            { branchGuid, projectGuid, productGuid: productId },
            serviceConfig
          );

          const isRegistryWarning = checkIsRegistryNotFoundError(res);

          if (res.isSuccessful && res.data) {
            if (isRegistryWarning) {
              setProductActionStates((prev) => ({
                ...prev,
                [productId]: {
                  ...prev[productId],
                  step: 'helm_warning_registry',
                  requiresPublishRetry: true,
                  helmBuildData: res.data,
                  packageGuid: res.data.packageGuid_SC || prev[productId]?.packageGuid || null,
                  lastMessage:
                    res.message ||
                    'پکیج در رجیستری هلم یافت نشد. دکمه ثبت دوباره فعال شد.',
                  errorMessage: res.message,
                  lastResponse: res,
                },
              }));
            } else {
              setProductActionStates((prev) => ({
                ...prev,
                [productId]: {
                  ...prev[productId],
                  step: 'helm_success',
                  requiresPublishRetry: false,
                  helmBuildData: res.data,
                  packageGuid: res.data.packageGuid_SC,
                  lastMessage: res.message || 'ساخت چارت هلم با موفقیت انجام شد.',
                  lastResponse: res,
                },
              }));
            }
          } else {
            if (isRegistryWarning) {
              setProductActionStates((prev) => ({
                ...prev,
                [productId]: {
                  ...prev[productId],
                  step: 'helm_warning_registry',
                  requiresPublishRetry: true,
                  errorMessage:
                    res.message || 'پکیج در رجیستری هلم یافت نشد پس از تلاش‌های مکرر.',
                  lastMessage: res.message,
                  lastResponse: res,
                },
              }));
            } else {
              setProductActionStates((prev) => ({
                ...prev,
                [productId]: {
                  ...prev[productId],
                  step: 'error',
                  errorMessage: res.message || 'خطا در اجرای سرویس ساخت HelmChart',
                  lastResponse: res,
                },
              }));
            }
          }
        } catch (err: any) {
          setProductActionStates((prev) => ({
            ...prev,
            [productId]: {
              ...prev[productId],
              step: 'error',
              errorMessage: err.message || 'خطای غیرمنتظره در ارتباط با وب‌سرویس',
            },
          }));
        }
      } else if (actionType === 'publish') {
        setProductActionStates((prev) => ({
          ...prev,
          [productId]: {
            ...prev[productId],
            step: 'publishing_package',
            lastMessage: 'در حال تلاش دوباره برای ثبت در رجیستری هلم...',
            errorMessage: null,
          },
        }));

        try {
          const packageGuid =
            currentState?.packageGuid ||
            currentState?.helmBuildData?.packageGuid_SC ||
            '';
          const res = await executeRetryPublishPackage(
            {
              version: currentState?.helmBuildData?.version || '0.0.0',
              packageGuid_SC: packageGuid,
              packageName:
                currentState?.helmBuildData?.packageName ||
                `Product-${productId.slice(0, 8)}`,
              solutionName:
                currentState?.helmBuildData?.solutionName || 'Solution',
              product: productId,
            },
            serviceConfig
          );

          if (res.isSuccessful) {
            const newPackageGuid = res.data || packageGuid;
            setProductActionStates((prev) => ({
              ...prev,
              [productId]: {
                ...prev[productId],
                step: 'package_published',
                requiresPublishRetry: false,
                packageGuid: newPackageGuid,
                lastMessage:
                  res.message || 'ثبت پکیج در رجیستری با موفقیت انجام شد.',
                lastResponse: res,
              },
            }));
          } else {
            setProductActionStates((prev) => ({
              ...prev,
              [productId]: {
                ...prev[productId],
                step: 'error',
                errorMessage: res.message || 'خطا در ثبت دوباره پکیج در رجیستری',
                lastResponse: res,
              },
            }));
          }
        } catch (err: any) {
          setProductActionStates((prev) => ({
            ...prev,
            [productId]: {
              ...prev[productId],
              step: 'error',
              errorMessage: err.message || 'خطای شبکه در ثبت دوباره رجیستری',
            },
          }));
        }
      } else if (actionType === 'module') {
        const packageGuid = currentState?.packageGuid;
        if (!packageGuid) {
          alert(
            'ابتدا باید مرحله ساخت HelmChart یا ثبت Package با موفقیت انجام شود تا PackageGuid تولید گردد.'
          );
          return;
        }

        setProductActionStates((prev) => ({
          ...prev,
          [productId]: {
            ...prev[productId],
            step: 'adding_module',
            lastMessage: 'در حال ایجاد ماژول محصول (AddModuleProduct)...',
            errorMessage: null,
          },
        }));

        try {
          const res = await executeAddModuleProduct(
            packageGuid,
            { branchGuid, projectGuid, productGuid: productId },
            serviceConfig
          );

          if (res.isSuccessful) {
            setProductActionStates((prev) => ({
              ...prev,
              [productId]: {
                ...prev[productId],
                step: 'module_success',
                moduleGuid: res.data,
                lastMessage: res.message || 'ماژول محصول با موفقیت ایجاد شد.',
                lastResponse: res,
              },
            }));
          } else {
            setProductActionStates((prev) => ({
              ...prev,
              [productId]: {
                ...prev[productId],
                step: 'error',
                errorMessage: res.message || 'خطای سرور در ساخت ماژول محصول',
                lastResponse: res,
              },
            }));
          }
        } catch (err: any) {
          setProductActionStates((prev) => ({
            ...prev,
            [productId]: {
              ...prev[productId],
              step: 'error',
              errorMessage: err.message || 'خطا در ساخت ModuleProduct',
            },
          }));
        }
      }
    },
    [nodes, productActionStates, serviceConfig]
  );

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Navbar */}
      <TopNavbar
        currentView={currentView}
        onChangeView={setCurrentView}
        onOpenServiceConfig={() => setIsServiceModalOpen(true)}
        dataSource={dataResult?.source || serviceConfig.defaultSource}
        sourceUrl={
          dataResult?.sourceUrl ||
          (serviceConfig.defaultSource === 'live'
            ? serviceConfig.serviceUrl
            : serviceConfig.mockDataUrl)
        }
        isLoading={isLoading}
        onRefresh={() => loadData()}
        filterEmpty={filterEmpty}
        onToggleFilterEmpty={setFilterEmpty}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={dataResult?.stats.totalItems || 0}
        activeCount={dataResult?.stats.activeClusters || 0}
        isStreaming={isStreaming}
        expandDepth={expandDepth}
        onSetExpandDepth={handleSetExpandDepth}
        onCollapseAll={handleCollapseAll}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Loading Overlay with Elapsed Seconds for Long Requests */}
        {isLoading && (
          <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-4 animate-in fade-in duration-150">
            <div className="relative">
              <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-emerald-300 font-bold">
                {loadingSeconds}s
              </div>
            </div>
            <div className="space-y-1 max-w-md">
              <div className="text-sm font-semibold text-slate-100">
                در حال دریافت پاسخ از{' '}
                {serviceConfig.defaultSource === 'mock' ? 'فایل ماک...' : 'وب‌سرویس...'}
              </div>
              <p className="text-xs text-slate-400">
                {serviceConfig.defaultSource === 'live'
                  ? `ارتباط با وب‌سرویس برقرار است؛ بدون محدودیت زمانی تا دریافت کامل پاسخ منتظر می‌ماند (${loadingSeconds} ثانیه گذشته)`
                  : 'در حال بارگذاری فایل تستی...'}
              </p>
              <div className="text-[11px] text-slate-500 font-mono truncate max-w-sm mx-auto" dir="ltr">
                {serviceConfig.defaultSource === 'mock'
                  ? serviceConfig.mockDataUrl
                  : serviceConfig.serviceUrl}
              </div>
            </div>

            {loadingSeconds >= 3 && serviceConfig.defaultSource === 'live' && (
              <div className="flex items-center gap-2 pt-2 animate-in fade-in">
                <button
                  onClick={() => {
                    const newConf: ServiceConfig = {
                      ...serviceConfig,
                      defaultSource: 'mock',
                    };
                    setServiceConfig(newConf);
                    saveActiveServiceConfig(newConf);
                    loadData(newConf);
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/70 border border-emerald-800/60 hover:bg-emerald-900/60 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>سوییچ موقت به فایل ماک تستی</span>
                </button>
                <button
                  onClick={() => setIsServiceModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>تغییر تنظیمات</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error Fallback */}
        {error && !isLoading && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full p-6 bg-slate-900 border border-rose-900/60 rounded-2xl shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-800/60 flex items-center justify-center mx-auto text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  خطا در دریافت پاسخ از وب‌سرویس
                </h3>
                <p className="text-xs text-rose-300/90 mt-1 leading-relaxed">
                  {error}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  onClick={() => setIsServiceModalOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>تنظیم URL و Token سرویس</span>
                </button>
                {serviceConfig.defaultSource === 'live' && (
                  <button
                    onClick={() => {
                      const newConf: ServiceConfig = {
                        ...serviceConfig,
                        defaultSource: 'mock',
                      };
                      setServiceConfig(newConf);
                      saveActiveServiceConfig(newConf);
                      loadData(newConf);
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>مشاهده موقت با فایل ماک</span>
                  </button>
                )}
                <button
                  onClick={() => loadData()}
                  className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تلاش مجدد</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Views */}
        {!error && (
          <div className="flex-1 flex relative overflow-hidden">
            {/* Live Streaming Floating Progress Pill */}
            {isStreaming && (
              <div className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-emerald-500/50 text-xs text-emerald-300 shadow-xl backdrop-blur-md animate-in fade-in">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-medium">
                  دریافت استریم زنده: {dataResult?.data.length || 0} کلاستر دریافت شد...
                </span>
              </div>
            )}

            {currentView === 'graph' && (
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                selectedNodeId={selectedNode?.id || null}
                onSelectNode={setSelectedNode}
                onToggleCollapse={handleToggleCollapse}
                searchQuery={searchQuery}
                productActionStates={productActionStates}
                onExecuteAction={handleExecuteAction}
              />
            )}

            {currentView === 'topology' && (
              <ClusterTopologyView
                items={dataResult?.data || []}
                onSelectClusterItem={handleSelectClusterItem}
                searchQuery={searchQuery}
              />
            )}

            {currentView === 'tree' && (
              <TreeExplorerView
                data={dataResult?.data || []}
                searchQuery={searchQuery}
              />
            )}

            {currentView === 'json' && (
              <RawJsonEditorView data={dataResult?.data || []} />
            )}

            {/* Right Side Inspector Drawer (for Graph View) */}
            {selectedNode && currentView === 'graph' && (
              <DetailInspector
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                rawJsonData={dataResult?.data}
                productActionStates={productActionStates}
                onExecuteAction={handleExecuteAction}
              />
            )}
          </div>
        )}
      </div>

      {/* Service Configuration & Swapping Modal */}
      <ServiceConfigModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        config={serviceConfig}
        onSaveConfig={handleSaveConfig}
        onUploadCustomJson={handleUploadCustomJson}
        onRefreshData={() => loadData(serviceConfig)}
      />
    </div>
  );
}
