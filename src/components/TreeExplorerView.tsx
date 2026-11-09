import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Folder,
  FolderOpen,
  FileCode,
} from 'lucide-react';

interface TreeExplorerViewProps {
  data: any;
  searchQuery?: string;
  onSelectPath?: (path: string, value: any) => void;
}

export const TreeExplorerView: React.FC<TreeExplorerViewProps> = ({
  data,
  searchQuery = '',
  onSelectPath,
}) => {
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const togglePath = (path: string) => {
    setCollapsedPaths((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const renderTreeItem = (
    keyName: string | number,
    value: any,
    currentPath: string,
    depth: number = 0
  ) => {
    const isArray = Array.isArray(value);
    const isObject = value !== null && typeof value === 'object';
    const isCollapsed = !!collapsedPaths[currentPath];

    // Search matching
    const q = searchQuery.toLowerCase();
    const isMatched =
      q.length > 0 &&
      (String(keyName).toLowerCase().includes(q) ||
        (!isObject && String(value).toLowerCase().includes(q)));

    if (!isObject) {
      return (
        <div
          key={currentPath}
          style={{ paddingRight: `${depth * 18}px` }}
          className={`flex items-center justify-between py-1 px-3 rounded hover:bg-slate-900 group font-mono text-xs transition-colors ${
            isMatched ? 'bg-amber-950/40 border border-amber-800/40' : ''
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-400">{keyName}:</span>
            {renderPrimitiveValue(value)}
          </div>
          <button
            onClick={() => handleCopy(String(value), currentPath)}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-300 rounded"
            title="کپی مقدار"
          >
            {copiedKey === currentPath ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      );
    }

    const count = isArray ? value.length : Object.keys(value).length;
    const entries: [string | number, any][] = isArray
      ? value.map((v: any, i: number): [number, any] => [i, v])
      : (Object.entries(value) as [string, any][]);

    return (
      <div key={currentPath} className="space-y-0.5">
        <div
          style={{ paddingRight: `${depth * 18}px` }}
          onClick={() => togglePath(currentPath)}
          className={`flex items-center justify-between py-1 px-2 rounded hover:bg-slate-850 cursor-pointer text-xs font-mono select-none transition-colors ${
            isMatched ? 'bg-amber-950/40 border border-amber-800/40' : ''
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <button className="text-slate-500 hover:text-slate-300 p-0.5">
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            <span className="font-semibold text-slate-200">{keyName}</span>
            <span className="text-[10px] text-slate-500">
              {isArray ? `[${count}]` : `{${count}}`}
            </span>
          </div>

          <span className="text-[10px] text-slate-600 font-sans">
            {isArray ? 'آرایه' : 'آبجکت'}
          </span>
        </div>

        {!isCollapsed && (
          <div className="border-r border-slate-800/80 mr-3">
            {entries.map(([childKey, childValue]) => {
              const childPath = isArray
                ? `${currentPath}[${childKey}]`
                : `${currentPath}.${childKey}`;
              return renderTreeItem(childKey, childValue, childPath, depth + 1);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full overflow-y-auto p-6 bg-slate-950">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="text-xs text-slate-400">
            نمای درختی ساختار داده (Hierarchical Tree View)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsedPaths({})}
              className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded transition-colors"
            >
              باز کردن همه شاخه‌ها
            </button>
            <button
              onClick={() => {
                const initialCollapsed: Record<string, boolean> = {};
                if (Array.isArray(data)) {
                  data.forEach((_, idx) => {
                    initialCollapsed[`$[${idx}]`] = true;
                  });
                }
                setCollapsedPaths(initialCollapsed);
              }}
              className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded transition-colors"
            >
              بستن زیر‌شاخه‌ها
            </button>
          </div>
        </div>

        {/* Tree Content */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 font-mono">
          {renderTreeItem('Root', data, '$', 0)}
        </div>
      </div>
    </div>
  );
};

function renderPrimitiveValue(value: any) {
  if (value === null) {
    return <span className="text-slate-500 italic">null</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <span className={value ? 'text-amber-400' : 'text-rose-400'}>
        {String(value)}
      </span>
    );
  }
  if (typeof value === 'number') {
    return <span className="text-sky-400">{value}</span>;
  }
  if (typeof value === 'string') {
    return <span className="text-emerald-400 truncate max-w-md">"{value}"</span>;
  }
  return <span className="text-slate-400">{String(value)}</span>;
}
