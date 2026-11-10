import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Compass,
  ChevronDown,
  ChevronRight,
  Zap,
  Play,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { GraphEdge, GraphNode, NodeRowField } from '../types/dataTypes';
import { ProductActionState } from '../types/actionTypes';
import { generateSmoothBezierPath } from '../utils/jsonCrackLayout';

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode | null) => void;
  onToggleCollapse: (nodeIdOrPath: string) => void;
  searchQuery?: string;
  focusNodeId?: string | null;
  onFitViewTrigger?: () => void;
  productActionStates?: Record<string, ProductActionState>;
  onExecuteAction?: (productId: string, actionType: 'helm' | 'publish' | 'module') => void;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onToggleCollapse,
  searchQuery = '',
  focusNodeId = null,
  productActionStates = {},
  onExecuteAction,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  // High performance direct transform ref (avoids React state churn during 60fps pan/zoom)
  const transformRef = useRef<{ x: number; y: number; scale: number }>({
    x: 80,
    y: 80,
    scale: 0.85,
  });

  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rAFRef = useRef<number | null>(null);

  // Visual state synced on drag end or debounced for minimap and controls
  const [scaleDisplay, setScaleDisplay] = useState<number>(0.85);
  const [panDisplay, setPanDisplay] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [isGrabbing, setIsGrabbing] = useState<boolean>(false);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState<boolean>(true);

  // Directly apply hardware accelerated transform to DOM element
  const applyTransform = useCallback((x: number, y: number, scale: number) => {
    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    }
  }, []);

  // Calculate canvas bounding box for "Fit to View" & Minimap
  const boundingBox = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    });

    const padding = 100;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
      width: Math.max(maxX - minX + padding * 2, 800),
      height: Math.max(maxY - minY + padding * 2, 600),
    };
  }, [nodes]);

  // Fit graph to viewport smoothly
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current || nodes.length === 0) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const scaleX = (clientWidth - 80) / boundingBox.width;
    const scaleY = (clientHeight - 80) / boundingBox.height;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.15), 1.15);

    const centerX = (clientWidth - boundingBox.width * newScale) / 2 - boundingBox.minX * newScale;
    const centerY = (clientHeight - boundingBox.height * newScale) / 2 - boundingBox.minY * newScale;

    transformRef.current = { x: centerX, y: centerY, scale: newScale };
    applyTransform(centerX, centerY, newScale);
    setScaleDisplay(newScale);
    setPanDisplay({ x: centerX, y: centerY });
  }, [boundingBox, nodes.length, applyTransform]);

  // Initial fit on data load ONLY once, so expanding nodes keeps current zoom & pan position!
  const hasAutoFittedRef = useRef<boolean>(false);
  useEffect(() => {
    if (nodes.length > 0 && !hasAutoFittedRef.current) {
      hasAutoFittedRef.current = true;
      handleFitToScreen();
    }
  }, [nodes.length, handleFitToScreen]);

  // Center and highlight a node selected through global search.
  useEffect(() => {
    if (!focusNodeId || !containerRef.current) return;
    const target = nodes.find((node) => node.id === focusNodeId);
    if (!target) return;

    const { clientWidth, clientHeight } = containerRef.current;
    const scale = Math.min(Math.max(transformRef.current.scale, 0.9), 1.2);
    const centerX = target.x + target.width / 2;
    const centerY = target.y + target.height / 2;
    const x = clientWidth / 2 - centerX * scale;
    const y = clientHeight / 2 - centerY * scale;

    if (worldRef.current) {
      worldRef.current.style.transition = 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)';
    }
    transformRef.current = { x, y, scale };
    applyTransform(x, y, scale);
    setScaleDisplay(scale);
    setPanDisplay({ x, y });

    const transitionTimer = window.setTimeout(() => {
      if (worldRef.current) worldRef.current.style.transition = '';
    }, 500);

    return () => window.clearTimeout(transitionTimer);
  }, [focusNodeId, nodes, applyTransform]);

  // Mouse wheel zoom with GPU direct transform
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const curScale = transformRef.current.scale;
    const newScale = Math.min(Math.max(curScale * zoomFactor, 0.1), 2.5);

    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const newPanX = cursorX - (cursorX - transformRef.current.x) * (newScale / curScale);
    const newPanY = cursorY - (cursorY - transformRef.current.y) * (newScale / curScale);

    transformRef.current = { x: newPanX, y: newPanY, scale: newScale };
    applyTransform(newPanX, newPanY, newScale);

    // Debounced display update
    if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
    rAFRef.current = requestAnimationFrame(() => {
      setScaleDisplay(newScale);
      setPanDisplay({ x: newPanX, y: newPanY });
    });
  };

  // High performance dragging (Zero React re-renders while dragging)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - transformRef.current.x,
      y: e.clientY - transformRef.current.y,
    };
    setIsGrabbing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;

    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    transformRef.current.x = newX;
    transformRef.current.y = newY;

    if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
    rAFRef.current = requestAnimationFrame(() => {
      applyTransform(newX, newY, transformRef.current.scale);
    });
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsGrabbing(false);
      setPanDisplay({ x: transformRef.current.x, y: transformRef.current.y });
    }
  };

  // Manual zoom buttons
  const handleZoom = (factor: number) => {
    const newScale = Math.min(Math.max(transformRef.current.scale * factor, 0.1), 2.5);
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const centerX = clientWidth / 2;
    const centerY = clientHeight / 2;

    const newPanX = centerX - (centerX - transformRef.current.x) * (newScale / transformRef.current.scale);
    const newPanY = centerY - (centerY - transformRef.current.y) * (newScale / transformRef.current.scale);

    transformRef.current = { x: newPanX, y: newPanY, scale: newScale };
    applyTransform(newPanX, newPanY, newScale);
    setScaleDisplay(newScale);
    setPanDisplay({ x: newPanX, y: newPanY });
  };

  // Search matching checker
  const isNodeMatchingSearch = useCallback(
    (node: GraphNode): boolean => {
      if (!searchQuery || searchQuery.trim() === '') return false;
      const q = searchQuery.toLowerCase();
      if (node.label.toLowerCase().includes(q)) return true;
      if (node.rawPath.toLowerCase().includes(q)) return true;
      if (node.metadata?.projectName?.toLowerCase().includes(q)) return true;
      return node.fields.some(
        (f) =>
          f.key.toLowerCase().includes(q) ||
          String(f.value).toLowerCase().includes(q)
      );
    },
    [searchQuery]
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-slate-950 bg-graph-grid ${
        isGrabbing ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Canvas World Transform Layer with GPU Acceleration */}
      <div
        ref={worldRef}
        className="absolute top-0 left-0 origin-top-left will-change-transform"
        style={{
          transform: `translate3d(${transformRef.current.x}px, ${transformRef.current.y}px, 0) scale(${transformRef.current.scale})`,
          contain: 'layout style',
        }}
      >
        {/* SVG Bezier Connection Edges */}
        <svg
          className="absolute top-0 left-0 overflow-visible pointer-events-none"
          style={{
            width: boundingBox.width * 2,
            height: boundingBox.height * 2,
          }}
        >
          <defs>
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="edge-gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
            </linearGradient>
            <marker
              id="arrowhead"
              markerWidth="7"
              markerHeight="5"
              refX="6"
              refY="2.5"
              orient="auto"
            >
              <polygon points="0 0, 7 2.5, 0 5" fill="#10b981" />
            </marker>
            <marker
              id="arrowhead-active"
              markerWidth="9"
              markerHeight="7"
              refX="7"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 9 3.5, 0 7" fill="#34d399" />
            </marker>
          </defs>

          {edges.map((edge) => {
            const isHovered = hoveredEdgeId === edge.id;
            const isConnectedToSelected =
              selectedNodeId === edge.sourceNodeId || selectedNodeId === edge.targetNodeId;
            const pathD = generateSmoothBezierPath(
              edge.startX,
              edge.startY,
              edge.endX,
              edge.endY
            );

            return (
              <g key={edge.id} className="pointer-events-auto cursor-pointer">
                {/* Invisible wider stroke for hover */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseLeave={() => setHoveredEdgeId(null)}
                />
                {/* Rendered bezier line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    isHovered || isConnectedToSelected
                      ? 'url(#edge-gradient-active)'
                      : 'rgba(100, 116, 139, 0.4)'
                  }
                  strokeWidth={isHovered || isConnectedToSelected ? 2.5 : 1.5}
                  strokeDasharray={isConnectedToSelected ? '4 2' : undefined}
                  markerEnd={
                    isHovered || isConnectedToSelected
                      ? 'url(#arrowhead-active)'
                      : 'url(#arrowhead)'
                  }
                />
                {/* Edge port dots */}
                <circle
                  cx={edge.startX}
                  cy={edge.startY}
                  r={3}
                  fill={isHovered || isConnectedToSelected ? '#60a5fa' : '#64748b'}
                />
                <circle
                  cx={edge.endX}
                  cy={edge.endY}
                  r={3}
                  fill={isHovered || isConnectedToSelected ? '#34d399' : '#10b981'}
                />
              </g>
            );
          })}
        </svg>

        {/* Node Cards */}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isMatched = isNodeMatchingSearch(node);

          return (
            <div
              key={node.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(node);
              }}
              style={{
                transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                width: `${node.width}px`,
              }}
              className={`absolute top-0 left-0 rounded-xl bg-slate-900/95 border text-xs shadow-lg backdrop-blur-sm transition-shadow duration-100 ${
                isSelected
                  ? 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-950/50'
                  : isMatched
                  ? 'border-amber-400 ring-2 ring-amber-400/30'
                  : node.isActionNode
                  ? 'border-amber-500/50 ring-1 ring-amber-500/30 hover:border-amber-400 shadow-amber-950/30'
                  : node.isClusterNode
                  ? 'border-indigo-500/40 hover:border-indigo-400'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Node Header */}
              <div
                className={`flex items-center justify-between px-3 py-2 border-b rounded-t-xl transition-colors ${
                  node.isActionNode
                    ? 'bg-amber-950/40 border-amber-900/50'
                    : node.isRealmGroup
                    ? 'bg-cyan-950/50 border-cyan-800/50'
                    : node.isClusterNode
                    ? 'bg-indigo-950/50 border-indigo-900/40'
                    : node.type === 'array'
                    ? 'bg-sky-950/40 border-slate-800'
                    : 'bg-slate-800/60 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                  <span
                    className={`font-mono text-[10px] font-semibold px-1 rounded flex items-center gap-0.5 ${
                      node.isActionNode
                        ? 'text-amber-300 bg-amber-900/60'
                        : node.isRealmGroup
                        ? 'text-cyan-200 bg-cyan-900/60'
                        : node.isClusterNode
                        ? 'text-indigo-300 bg-indigo-900/60'
                        : node.type === 'array'
                        ? 'text-sky-300 bg-sky-900/50'
                        : 'text-emerald-300 bg-emerald-900/40'
                    }`}
                  >
                    {node.isActionNode ? (
                      <>
                        <Zap className="w-2.5 h-2.5" />
                        <span>Action</span>
                      </>
                    ) : node.isRealmGroup ? (
                      'Realm'
                    ) : node.isClusterNode ? (
                      'Cluster'
                    ) : node.type === 'array' ? (
                      '[]'
                    ) : (
                      '{}'
                    )}
                  </span>
                  <span
                    className="font-medium text-slate-200 truncate"
                    title={node.label}
                  >
                    {node.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {node.isRealmGroup ? `${node.metadata?.realmChildCount ?? 0} فرزند` : node.itemCount !== undefined ? `${node.itemCount}` : ''}
                  </span>

                  {node.fields.some((f) => f.isExpandable) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle collapse for this node path
                        onToggleCollapse(node.rawPath || node.id);
                      }}
                      className="p-1 hover:bg-slate-700/60 text-slate-400 hover:text-slate-100 rounded transition-colors"
                      title={node.isCollapsed ? 'باز کردن زیر‌مجموعه' : 'بستن زیر‌مجموعه'}
                    >
                      {node.isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Render Body: Specialized Action Card or Standard Properties */}
              {node.isActionNode && node.actionMetadata ? (
                (() => {
                  const actionState = productActionStates[node.actionMetadata.productId];
                  const productId = node.actionMetadata.productId;
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
                    <div className="p-2 space-y-1.5 select-none text-[11px]">
                      {/* Step 1: Build HelmChart */}
                      <div className="flex items-center justify-between gap-1 p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] bg-sky-950 text-sky-400 border border-sky-800 shrink-0">
                            ۱
                          </span>
                          <span className="text-slate-200 font-medium truncate">
                            ساخت HelmChart
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onExecuteAction) onExecuteAction(productId, 'helm');
                          }}
                          disabled={isHelmBuilding}
                          className={`px-2 py-0.5 rounded font-medium text-[10px] flex items-center gap-1 transition-all ${
                            isHelmBuilding
                              ? 'bg-sky-600/30 text-sky-300 border border-sky-500/40 cursor-wait'
                              : isHelmDone
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900'
                              : 'bg-sky-600 hover:bg-sky-500 text-white active:scale-95'
                          }`}
                        >
                          {isHelmBuilding ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>در حال ساخت...</span>
                            </>
                          ) : isHelmDone ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>موفق</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>ساخت</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Step 2: Retry Registry Warning (Active if registry not found) */}
                      {hasRegistryWarning && (
                        <div className="p-1.5 rounded-lg bg-amber-950/50 border border-amber-500/60 space-y-1 animate-pulse">
                          <div className="flex items-center gap-1 text-[10px] text-amber-300 font-medium">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="truncate">عدم یافتن در رجیستری هلم!</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onExecuteAction) onExecuteAction(productId, 'publish');
                            }}
                            disabled={isPublishing}
                            className="w-full py-0.5 px-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-medium flex items-center justify-center gap-1 transition-all"
                          >
                            {isPublishing ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>در حال ثبت...</span>
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3 h-3" />
                                <span>تلاش دوباره برای ثبت package</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Step 3: Add ModuleProduct (Locked until PackageGuid is received) */}
                      <div
                        className={`flex items-center justify-between gap-1 p-1.5 rounded-lg border transition-all ${
                          isModuleLocked
                            ? 'bg-slate-950/20 border-slate-800/40 opacity-60'
                            : 'bg-slate-950/60 border-indigo-900/60'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 ${
                              isModuleLocked
                                ? 'bg-slate-800 text-slate-500'
                                : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                            }`}
                          >
                            ۲
                          </span>
                          <span className="text-slate-200 font-medium truncate">
                            ساخت ModuleProduct
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onExecuteAction) onExecuteAction(productId, 'module');
                          }}
                          disabled={isModuleLocked || isModuleAdding}
                          className={`px-2 py-0.5 rounded font-medium text-[10px] flex items-center gap-1 transition-all ${
                            isModuleLocked
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : isModuleAdding
                              ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 cursor-wait'
                              : isModuleDone
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                          }`}
                          title={
                            isModuleLocked
                              ? 'تا زمان دریافت PackageGuid قفل است'
                              : 'ساخت ماژول محصول'
                          }
                        >
                          {isModuleLocked ? (
                            <>
                              <Lock className="w-2.5 h-2.5" />
                              <span>قفل</span>
                            </>
                          ) : isModuleAdding ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>در حال ساخت...</span>
                            </>
                          ) : isModuleDone ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>ساخته شد</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>ساخت ماژول</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* PackageGuid status footer */}
                      <div className="pt-1 flex items-center justify-between text-[9px] font-mono text-slate-400 border-t border-slate-800/80">
                        <span className="text-slate-500">PackageGuid:</span>
                        <span
                          className={`truncate max-w-[190px] ${
                            actionState?.packageGuid
                              ? 'text-emerald-400 font-semibold'
                              : 'text-slate-600'
                          }`}
                          title={actionState?.packageGuid || 'هنوز ایجاد نشده'}
                        >
                          {actionState?.packageGuid
                            ? `${actionState.packageGuid.slice(0, 18)}...`
                            : 'قفل / در انتظار Helm'}
                        </span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Node Rows (Property Table) */
                <div className="divide-y divide-slate-850/60 py-1">
                  {node.fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between px-3 py-1 hover:bg-slate-800/40 group transition-colors"
                    >
                      {/* Key Label */}
                      <div className="flex items-center gap-1 truncate max-w-[45%] text-slate-300 font-mono">
                        <span className="truncate" title={field.key}>
                          {field.key}
                        </span>
                        <span className="text-slate-600">:</span>
                      </div>

                      {/* Value with Type Highlighting */}
                      <div className="flex items-center gap-1.5 truncate max-w-[52%] justify-end font-mono text-[11px]">
                        {renderFieldValue(field)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Canvas Controls */}
      <div className="absolute bottom-6 left-6 flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl shadow-2xl backdrop-blur-md z-20">
        <button
          onClick={() => handleZoom(1.2)}
          className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
          title="بزرگ‌نمایی (Zoom In)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(0.8)}
          className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
          title="کوچک‌نمایی (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-800 mx-0.5" />
        <button
          onClick={() => {
            transformRef.current = { x: 100, y: 100, scale: 1 };
            applyTransform(100, 100, 1);
            setScaleDisplay(1);
            setPanDisplay({ x: 100, y: 100 });
          }}
          className="px-2.5 py-1 text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="مقیاس ۱:۱"
        >
          {Math.round(scaleDisplay * 100)}%
        </button>
        <div className="w-px h-4 bg-slate-800 mx-0.5" />
        <button
          onClick={handleFitToScreen}
          className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
          title="تنظیم خودکار با ابعاد صفحه (Fit View)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowMinimap(!showMinimap)}
          className={`p-2 rounded-lg transition-colors ${
            showMinimap
              ? 'bg-slate-800 text-emerald-400'
              : 'hover:bg-slate-800 text-slate-400 hover:text-white'
          }`}
          title="نمایش رادار نقشه (Minimap)"
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Performance indicator badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-[11px] font-mono rounded-lg ml-1">
          <Zap className="w-3 h-3 text-emerald-400" />
          <span>{nodes.length} نود | 60FPS</span>
        </div>
      </div>

      {/* Minimap Radar View */}
      {showMinimap && nodes.length > 0 && (
        <div className="absolute bottom-6 right-6 w-44 h-32 bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md pointer-events-none z-20 hidden md:block">
          <div className="relative w-full h-full p-2">
            <svg
              className="w-full h-full"
              viewBox={`${boundingBox.minX} ${boundingBox.minY} ${boundingBox.width} ${boundingBox.height}`}
            >
              {edges.map((e) => (
                <line
                  key={e.id}
                  x1={e.startX}
                  y1={e.startY}
                  x2={e.endX}
                  y2={e.endY}
                  stroke="rgba(100, 116, 139, 0.3)"
                  strokeWidth={2}
                />
              ))}

              {nodes.map((n) => (
                <rect
                  key={n.id}
                  x={n.x}
                  y={n.y}
                  width={n.width}
                  height={n.height}
                  rx={6}
                  fill={
                    selectedNodeId === n.id
                      ? '#10b981'
                      : n.isClusterNode
                      ? '#6366f1'
                      : '#334155'
                  }
                  opacity={0.85}
                />
              ))}

              {containerRef.current && (
                <rect
                  x={-panDisplay.x / scaleDisplay}
                  y={-panDisplay.y / scaleDisplay}
                  width={containerRef.current.clientWidth / scaleDisplay}
                  height={containerRef.current.clientHeight / scaleDisplay}
                  fill="rgba(16, 185, 129, 0.08)"
                  stroke="#10b981"
                  strokeWidth={Math.max(2 / scaleDisplay, 3)}
                  rx={4}
                />
              )}
            </svg>
            <span className="absolute top-1 left-2 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
              Minimap
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Syntax color rendering for values
 */
function renderFieldValue(field: NodeRowField) {
  const { value, valueType, isExpandable } = field;

  if (isExpandable) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
        <span>{valueType === 'array' ? value : '{...}'}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </span>
    );
  }

  if (valueType === 'string') {
    const str = String(value);
    const isUrl = str.startsWith('http://') || str.startsWith('https://');
    return (
      <span
        className={`truncate ${
          isUrl ? 'text-cyan-400 underline decoration-cyan-800' : 'text-emerald-400'
        }`}
        title={str}
      >
        "{str}"
      </span>
    );
  }

  if (valueType === 'number') {
    return <span className="text-sky-400 font-semibold">{value}</span>;
  }

  if (valueType === 'boolean') {
    return (
      <span
        className={`font-semibold ${
          value ? 'text-amber-400' : 'text-rose-400'
        }`}
      >
        {String(value)}
      </span>
    );
  }

  if (valueType === 'null') {
    return <span className="text-slate-500 italic">null</span>;
  }

  return <span className="text-slate-400 truncate">{String(value)}</span>;
}
