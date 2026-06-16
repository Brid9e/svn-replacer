import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Folder, File, ChevronRight, ChevronDown, Loader2, Settings, Sun, Moon, RefreshCw, ArrowLeft, Filter, ArrowUpDown, Search, History } from "lucide-react";
import "./index.css";

const appWindow = getCurrentWindow();

interface SvnEntry {
  name: string;
  kind: string;
  date: string;
}

interface ReplaceResult {
  success: boolean;
  message: string;
}

interface SvnLogEntry {
  revision: string;
  author: string;
  date: string;
  message: string;
}

interface TreeNode {
  name: string;
  fullUrl: string;
  kind: string;
  date: string;
  children: TreeNode[];
  expanded: boolean;
  loaded: boolean;
}

function TreeItem({
  node,
  depth,
  onSelect,
  selectedUrl,
  isFiltered,
  sortEntries,
  searchText,
  matchesSearch,
}: {
  node: TreeNode;
  depth: number;
  onSelect: (url: string, name: string) => void;
  selectedUrl: string | null;
  isFiltered: (name: string, kind: string) => boolean;
  sortEntries: (entries: TreeNode[]) => TreeNode[];
  searchText: string;
  matchesSearch: (node: TreeNode, text: string) => boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [, forceUpdate] = useState(0);

  const toggle = async () => {
    if (node.kind !== "dir") {
      onSelect(node.fullUrl, node.name);
      return;
    }

    if (!node.loaded) {
      setLoading(true);
      try {
        const entries: SvnEntry[] = await invoke("svn_ls", {
          url: node.fullUrl.replace(/\/?$/, "/"),
        });
        node.children = entries
          .filter((e) => e.name)
          .map((e) => ({
            name: e.name,
            fullUrl: `${node.fullUrl.replace(/\/?$/, "/")}${e.name}`,
            kind: e.kind,
            date: e.date,
            children: [],
            expanded: false,
            loaded: false,
          }));
        node.loaded = true;
      } finally {
        setLoading(false);
      }
    }
    node.expanded = !node.expanded;
    forceUpdate((n) => n + 1);
    onSelect(node.fullUrl, node.name);
  };

  const isSelected = selectedUrl === node.fullUrl;

  return (
    <div>
      <div
        className={`tree-node ${isSelected ? "tree-selected" : ""}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={toggle}
      >
        <span className="tree-icon">
          {node.kind === "dir"
            ? loading
              ? <Loader2 size={12} className="spin" />
              : node.expanded
                ? <ChevronDown size={12} />
                : <ChevronRight size={12} />
            : <span style={{ width: 12, display: "inline-block" }} />}
        </span>
        <span className="tree-kind">{node.kind === "dir" ? <Folder size={14} /> : <File size={14} />}</span>
        <span className="tree-name">{node.name}</span>
      </div>
      {node.expanded &&
        sortEntries(node.children)
          .filter((c) => !isFiltered(c.name, c.kind))
          .filter((c) => matchesSearch(c, searchText))
          .map((child) => (
          <TreeItem
            key={child.fullUrl}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            selectedUrl={selectedUrl}
            isFiltered={isFiltered}
            sortEntries={sortEntries}
            searchText={searchText}
            matchesSearch={matchesSearch}
          />
        ))}
    </div>
  );
}

function App() {
  // Theme
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // View: "replace" | "settings"
  const [view, setView] = useState<"replace" | "settings">("replace");

  // Base URL (stored in localStorage)
  const [baseUrl, setBaseUrl] = useState(() => {
    const saved = (localStorage.getItem("baseUrl") || "").trim();
    try { return decodeURI(saved); } catch { return saved; }
  });

  // Tree
  const [treeRoot, setTreeRoot] = useState<TreeNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [filterExt, setFilterExt] = useState(() => (localStorage.getItem("filterExt") || ""));
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortByDate, setSortByDate] = useState(() => localStorage.getItem("sortByDate") === "true");

  // Sort helper: newest first
  const sortEntries = useCallback((entries: TreeNode[]) => {
    if (!sortByDate) return entries;
    return [...entries].sort((a, b) => {
      if (a.date < b.date) return 1;
      if (a.date > b.date) return -1;
      return 0;
    });
  }, [sortByDate]);

  // Filter helper: returns true if a file-type node should be hidden
  const isFiltered = useCallback((name: string, kind: string) => {
    if (kind === "dir" || !filterExt.trim()) return false;
    const exts = filterExt.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (exts.length === 0) return false;
    const lower = name.toLowerCase();
    return exts.some((e) => lower.endsWith(e));
  }, [filterExt]);

  // Search
  const [searchText, setSearchText] = useState("");

  // Returns true if the node or any descendant matches the search text
  const matchesSearch = useCallback((node: TreeNode, text: string): boolean => {
    if (!text.trim()) return true;
    const lower = text.toLowerCase();
    if (node.name.toLowerCase().includes(lower)) return true;
    return node.children.some((c) => matchesSearch(c, text));
  }, []);

  // Replace
  const [sourcePath, setSourcePath] = useState("");
  const [commitMsg, setCommitMsg] = useState("update shj-fxc");
  const [replacing, setReplacing] = useState(false);
  const [output, setOutput] = useState<{ type: string; text: string } | null>(null);

  // Drag-drop
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  // Drag refs
  const headerRef = useRef<HTMLElement>(null);
  const dragRegionRef = useRef<HTMLDivElement>(null);

  // Splitter
  const [leftWidth, setLeftWidth] = useState(280);
  const splitting = useRef(false);

  // Persist theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Persist baseUrl (trimmed)
  useEffect(() => {
    localStorage.setItem("baseUrl", baseUrl.trim());
  }, [baseUrl]);

  // Persist filter extension
  useEffect(() => {
    localStorage.setItem("filterExt", filterExt);
  }, [filterExt]);

  // Persist sort preference
  useEffect(() => {
    localStorage.setItem("sortByDate", String(sortByDate));
  }, [sortByDate]);

  // Restore cached tree on mount
  useEffect(() => {
    if (!baseUrl) return;
    try {
      const cached = localStorage.getItem(`treeCache_${baseUrl}`);
      if (cached) {
        const root = JSON.parse(cached) as TreeNode;
        // Reset all sub-nodes to collapsed/unloaded so they fetch fresh on expand
        const reset = (n: TreeNode) => {
          n.expanded = n.kind === "dir" && n.children.length > 0 && n.name === (baseUrl.split("/").filter(Boolean).pop() || "root");
          n.loaded = n === root;
          n.children.forEach(reset);
        };
        reset(root);
        setTreeRoot(root);
      }
    } catch { /* ignore cache errors */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag-drop listener
  useEffect(() => {
    const unlisten = getCurrentWindow().onDragDropEvent((e) => {
      switch (e.payload.type) {
        case "enter":
          dragCounter.current += 1;
          setDragOver(true);
          break;
        case "leave":
          dragCounter.current -= 1;
          if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setDragOver(false);
          }
          break;
        case "over":
          break;
        case "drop":
          dragCounter.current = 0;
          setDragOver(false);
          if (e.payload.paths.length > 0) {
            setSourcePath(e.payload.paths[0]);
          }
          break;
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Manual window drag (replaces data-tauri-drag-region)
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.buttons === 1) {
        e.detail === 2
          ? appWindow.toggleMaximize()
          : appWindow.startDragging();
      }
    };
    const header = headerRef.current;
    const dragRegion = dragRegionRef.current;
    header?.addEventListener("mousedown", onMouseDown);
    dragRegion?.addEventListener("mousedown", onMouseDown);
    return () => {
      header?.removeEventListener("mousedown", onMouseDown);
      dragRegion?.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  const loadTree = useCallback(async () => {
    if (!baseUrl.trim()) return;
    setTreeLoading(true);
    setTreeRoot(null);
    setSelectedUrl(null);
    setSelectedName(null);
    try {
      const url = baseUrl.trim().replace(/\/?$/, "/");
      const entries: SvnEntry[] = await invoke("svn_ls", { url });
      const root: TreeNode = {
        name: baseUrl.split("/").filter(Boolean).pop() || "root",
        fullUrl: url,
        kind: "dir",
        date: "",
        children: entries
          .filter((e) => e.name)
          .map((e) => ({
            name: e.name,
            fullUrl: `${url}${e.name}`,
            kind: e.kind,
            date: e.date,
            children: [],
            expanded: false,
            loaded: false,
          })),
        expanded: true,
        loaded: true,
      };
      // Cache
      try { localStorage.setItem(`treeCache_${baseUrl}`, JSON.stringify(root)); } catch { /* ignore */ }
      setTreeRoot(root);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput({ type: "error", text: `Load failed: ${msg}` });
    } finally {
      setTreeLoading(false);
    }
  }, [baseUrl]);

  const onSelect = useCallback((url: string, name: string) => {
    setSelectedUrl(url);
    setSelectedName(name);
  }, []);

  const pickSource = useCallback(async () => {
    const defaultPath = sourcePath
      ? sourcePath.replace(/\/$/, "").split("/").slice(0, -1).join("/") || "/"
      : undefined;
    const selected = await open({
      multiple: false,
      directory: true,
      defaultPath,
    });
    if (selected) setSourcePath(selected);
  }, [sourcePath]);

  const doReplace = useCallback(async () => {
    if (!selectedUrl || !sourcePath.trim()) {
      setOutput({ type: "error", text: "请选择目标目录和源文件" });
      return;
    }
    setReplacing(true);
    setOutput(null);
    try {
      const result: ReplaceResult = await invoke("do_replace", {
        source: sourcePath,
        targetUrl: selectedUrl,
        commitMsg: commitMsg || "update shj-fxc",
      });
      setOutput({ type: "success", text: result.message.trim() });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput({ type: "error", text: msg });
    } finally {
      setReplacing(false);
    }
  }, [selectedUrl, sourcePath, commitMsg]);

  // Log
  const [logEntries, setLogEntries] = useState<SvnLogEntry[] | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);

  const doLog = useCallback(async () => {
    if (!selectedUrl) return;
    setLoadingLog(true);
    setLogEntries(null);
    try {
      const entries: SvnLogEntry[] = await invoke("svn_log", { url: selectedUrl, limit: 50 });
      setLogEntries(entries);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput({ type: "error", text: `Log failed: ${msg}` });
    } finally {
      setLoadingLog(false);
    }
  }, [selectedUrl]);

  // Format date for display
  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleString(); } catch { return d; }
  };

  // Splitter mouse handlers
  const onSplitterDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    splitting.current = true;
    const startX = e.clientX;
    const startW = leftWidth;

    const onMove = (ev: MouseEvent) => {
      if (!splitting.current) return;
      const w = Math.min(Math.max(startW + ev.clientX - startX, 180), window.innerWidth * 0.6);
      setLeftWidth(w);
    };

    const onUp = () => {
      splitting.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [leftWidth]);

  return (
    <div className="app">
      <div className="layout">
        {/* Left: Tree (full height) */}
        <div className="panel-left" style={{ width: leftWidth }}>
          <div className="panel-drag" ref={dragRegionRef} />
          <div className="tree-toolbar">
            <button className="btn" onClick={loadTree} disabled={treeLoading || !baseUrl} style={{ flex: 1 }}>
              {treeLoading ? <span className="spinner" /> : "Load Tree"}
            </button>
            {treeRoot && (
              <button className="btn btn-icon" onClick={() => setSortByDate((v) => !v)} title={sortByDate ? "按名称排序" : "按日期排序"}>
                <ArrowUpDown size={14} className={sortByDate ? "text-primary" : ""} />
              </button>
            )}
            {treeRoot && (
              <button className="btn btn-icon" onClick={() => setFilterOpen((v) => !v)} title="筛选">
                <Filter size={14} className={filterOpen ? "text-primary" : ""} />
              </button>
            )}
            {treeRoot && (
              <button className="btn btn-icon" onClick={loadTree} disabled={treeLoading} title="刷新">
                <RefreshCw size={14} className={treeLoading ? "spin" : ""} />
              </button>
            )}
          </div>
          <div className="tree-search">
            <Search size={12} className="tree-search-icon" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索..."
            />
          </div>
          {filterOpen && (
            <div className="tree-filter">
              <input
                value={filterExt}
                onChange={(e) => setFilterExt(e.target.value)}
                placeholder="扩展名, 逗号隔开, 如: .jar,.class"
              />
            </div>
          )}
          <div className="tree-container">
            {!baseUrl ? (
              <div className="tree-empty">请在设置中配置 SVN 地址</div>
            ) : treeRoot ? (
              <TreeItem
                node={treeRoot}
                depth={0}
                onSelect={onSelect}
                selectedUrl={selectedUrl}
                isFiltered={isFiltered}
                sortEntries={sortEntries}
                searchText={searchText}
                matchesSearch={matchesSearch}
              />
            ) : (
              <div className="tree-empty">点击 Load Tree</div>
            )}
          </div>
        </div>

        {/* Right side: header + content */}
        <div className="panel-right">
          <header className="header" ref={headerRef}>
            <div className="header-left">
              {(view === "settings" || logEntries) && (
                <button className="btn-icon" onClick={() => { if (logEntries) setLogEntries(null); else setView("replace"); }} title="返回">
                  <ArrowLeft size={16} />
                </button>
              )}
            </div>
            <div className="header-actions">
              {view !== "settings" && !logEntries && (
                <button className="btn-icon" onClick={() => setView("settings")} title="设置">
                  <Settings size={16} />
                </button>
              )}
            </div>
          </header>

          {view === "replace" && logEntries ? (
            <div className="main log-view">
              <div className="field">
                <label>History</label>
                <div className="target-display">
                  <span className="target-path">{selectedUrl}</span>
                </div>
              </div>
              {logEntries.length === 0 ? (
                <div className="log-empty">暂无提交记录</div>
              ) : (
                <div className="log-list">
                  {logEntries.map((entry, i) => (
                    <div key={i} className="log-item">
                      <div className="log-revision">r{entry.revision}</div>
                      <div className="log-body">
                        <div className="log-meta">
                          <span className="log-author">{entry.author}</span>
                          <span className="log-date">{fmtDate(entry.date)}</span>
                        </div>
                        <div className="log-msg">{entry.message || <span className="log-empty-msg">(no message)</span>}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : view === "replace" ? (
            <div className="main">
              <div className="field">
                <label>Target</label>
                <div className="target-display">
                  {selectedName ? (
                    <span className="target-path">{selectedUrl}</span>
                  ) : (
                    <span className="target-placeholder">在左侧树中选择目标目录</span>
                  )}
                </div>
                {selectedName && (
                  <button className="btn btn-icon" onClick={doLog} title="查看提交历史" style={{ alignSelf: "flex-end" }}>
                    {loadingLog ? <Loader2 size={14} className="spin" /> : <History size={14} />} Log
                  </button>
                )}
              </div>

              <div className="field">
                <label>Source Directory</label>
                <div className={`file-input-row ${dragOver ? "drag-over" : ""}`}>
                  <input
                    value={sourcePath}
                    onChange={(e) => setSourcePath(e.target.value)}
                    placeholder="拖入文件或文件夹到此处"
                    readOnly
                  />
                  <button className="btn" onClick={pickSource}>
                    Browse
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Commit Message</label>
                <input
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                  placeholder="update shj-fxc"
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={doReplace}
                disabled={replacing || !selectedUrl || !sourcePath}
              >
                {replacing ? <span className="spinner" /> : "Replace & Commit"}
              </button>

              {output && (
                <div className={`output-box ${output.type}`}>
                  {output.text}
                </div>
              )}
            </div>
          ) : (
            <div className="main">
              <div className="settings-section">
                <label>主题</label>
                <div className="theme-toggle">
                  <button
                    className={`theme-opt${theme === "light" ? " active" : ""}`}
                    onClick={() => setTheme("light")}
                  >
                    <Sun size={14} /> 亮色
                  </button>
                  <button
                    className={`theme-opt${theme === "dark" ? " active" : ""}`}
                    onClick={() => setTheme("dark")}
                  >
                    <Moon size={14} /> 暗色
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <label>SVN 地址</label>
                <input
                  value={baseUrl}
                  onChange={(e) => {
                    // 自动解码百分号编码的 URL
                    const decoded = (() => { try { return decodeURI(e.target.value); } catch { return e.target.value; } })();
                    setBaseUrl(decoded);
                  }}
                  placeholder="https://svn.example.com/svn/project/"
                />
              </div>
            </div>
          )}
        </div>

        {/* Splitter overlay */}
        <div className="splitter" style={{ left: leftWidth - 3 }} onMouseDown={onSplitterDown} />
      </div>
    </div>
  );
}

export default App;
