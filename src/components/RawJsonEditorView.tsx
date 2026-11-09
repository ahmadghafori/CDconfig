import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, Search, FileCode2 } from 'lucide-react';

interface RawJsonEditorViewProps {
  data: any;
}

export const RawJsonEditorView: React.FC<RawJsonEditorViewProps> = ({ data }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  const jsonString = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  }, [data]);

  const lines = useMemo(() => {
    return jsonString.split('\n');
  }, [jsonString]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 font-mono text-xs">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <FileCode2 className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-200 font-semibold font-sans">
            کد خام JSON ({lines.length.toLocaleString('fa-IR')} خط)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو در خطوط..."
              className="bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-700 w-44"
            />
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg transition-colors border border-slate-700/60"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-sans">کپی شد</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="font-sans">کپی کامل</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="font-sans">دانلود JSON</span>
          </button>
        </div>
      </div>

      {/* Code Viewer with Line Numbers */}
      <div className="flex-1 overflow-auto p-4 flex">
        {/* Line Numbers */}
        <div className="select-none text-right pr-4 pl-2 text-slate-600 font-mono text-[11px] border-r border-slate-850">
          {lines.map((_, i) => (
            <div key={i} className="leading-6">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code Content */}
        <div className="pl-4 flex-1 overflow-x-auto text-[11px] leading-6 text-slate-300 selection:bg-emerald-500/20">
          {lines.map((line, i) => {
            const isMatch = search && line.toLowerCase().includes(search.toLowerCase());
            return (
              <div
                key={i}
                className={`whitespace-pre ${
                  isMatch ? 'bg-amber-950/40 text-amber-200 font-semibold' : ''
                }`}
              >
                {highlightJsonSyntax(line)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function highlightJsonSyntax(line: string) {
  // Simple regex-based color syntax for json lines
  const keyMatch = line.match(/^(\s*)(".*?")(\s*:)/);
  if (keyMatch) {
    const indent = keyMatch[1];
    const key = keyMatch[2];
    const colon = keyMatch[3];
    const rest = line.slice(keyMatch[0].length);

    return (
      <>
        <span>{indent}</span>
        <span className="text-sky-300">{key}</span>
        <span className="text-slate-500">{colon}</span>
        <span>{colorizeValue(rest)}</span>
      </>
    );
  }
  return colorizeValue(line);
}

function colorizeValue(str: string) {
  if (str.includes('true') || str.includes('false')) {
    return (
      <span className="text-amber-400">{str}</span>
    );
  }
  if (str.includes('null')) {
    return <span className="text-slate-500 italic">{str}</span>;
  }
  if (str.trim().startsWith('"')) {
    return <span className="text-emerald-400">{str}</span>;
  }
  if (/\b\d+(\.\d+)?\b/.test(str)) {
    return <span className="text-cyan-400">{str}</span>;
  }
  return <span>{str}</span>;
}
