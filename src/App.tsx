import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { RefreshCw, Download, FilePlus, Trash2, RotateCcw, Wrench, ArrowDownToLine, Settings } from "lucide-react";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { useSvnCommands } from "./hooks/useSvnCommands";
import { useTree } from "./hooks/useTree";
import { WorkspaceBar } from "./components/WorkspaceBar";
import { TreePanel } from "./components/TreePanel";
import { TabBar } from "./components/TabBar";
import { Toolbar } from "./components/Toolbar";
import { TerminalPanel } from "./components/TerminalPanel";
import type { TerminalMessage } from "./components/TerminalPanel";
import { LogPanel } from "./components/panels/LogPanel";
import { CommitPanel } from "./components/panels/ReplacePanel";
import { StatusPanel } from "./components/panels/StatusPanel";
import { DiffPanel } from "./components/panels/DiffPanel";
import { SettingsPanel } from "./components/panels/SettingsPanel";
import { WorkspacePanel } from "./components/panels/WorkspacePanel";
import type { ToolbarAction } from "./components/Toolbar";
import type { SvnLogEntry } from "./types";
import "./index.css";

const appWindow = getCurrentWindow();

// Force React to flush pending state updates before long async operations
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function App() {
  // Theme
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Tab-based navigation
  const [activeTab, setActiveTab] = useState<"status" | "log" | "commit" | "diff">("commit");
  const [overlay, setOverlay] = useState<"settings" | "workspace" | null>(null);
  const [editWsId, setEditWsId] = useState<string | null>(null);
  const [wsForm, setWsForm] = useState({ name: "", baseUrl: "", username: "", password: "" });

  // Hooks
  const { workspaces, activeId, activeWorkspace, setWorkspaces, setActiveId, setWsField } = useWorkspaces();
  const { svnLs, svnLog, testConnection, svnStatus, svnUpdate, svnCheckout, svnAdd, svnDelete, svnDiff, svnRevert, svnCleanup, svnResolve, svnCommit, svnRemoteDelete, readLocalDir } = useSvnCommands(workspaces, activeId);
  const {
    treeRoot, treeLoading, selectedUrl, selectedName,
    filterOpen, searchText, setSearchText, setFilterOpen,
    setSelectedUrl, setSelectedName,
    resetTree, loadTree,
    sortEntries, isFiltered, matchesSearch,
    statusMap, setStatusMap,
    localMode, setLocalMode, loadLocalTree,
    localPath,
  } = useTree(activeWorkspace, svnLs, readLocalDir);

  // Commit
  const [committing, setCommitting] = useState(false);
  // Update
  const [updating, setUpdating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  // Diff
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const msgIdRef = useRef(0);
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const addMessage = useCallback((type: string, text: string) => {
    const id = ++msgIdRef.current;
    setMessages((prev) => [...prev, { id, type, text }]);
  }, []);
  // Backward-compatible: existing setOutput calls also append to terminal
  const setOutput = useCallback((msg: { type: string; text: string } | null) => {
    if (msg) addMessage(msg.type, msg.text);
  }, [addMessage]);

  // Status selection
  const [statusSelectedPaths, setStatusSelectedPaths] = useState<string[]>([]);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Log
  const [logEntries, setLogEntries] = useState<SvnLogEntry[] | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);

  // Drag-drop
  const dragCounter = useRef(0);

  // Refs
  const dragRegionRef = useRef<HTMLDivElement>(null);

  // Splitter
  const [leftWidth, setLeftWidth] = useState(280);
  const splitting = useRef(false);

  const closeOverlay = useCallback(() => setOverlay(null), []);

  // Tree selection
  const onSelect = useCallback((url: string, name: string) => {
    setSelectedUrl(url);
    setSelectedName(name);
  }, [setSelectedUrl, setSelectedName]);

  const handleLoadTree = useCallback(async () => {
    const err = await loadTree();
    if (err) { setOutput({ type: "error", text: `Load failed: ${err}` }); return; }
    // Load local file status
    const ws = workspaces.find((w) => w.id === activeId);
    if (ws?.sourcePath?.trim()) {
      try {
        const entries = await svnStatus(ws.sourcePath.trim());
        const map: Record<string, string> = {};
        for (const e of entries) {
          map[e.path] = e.item;
        }
        setStatusMap(map);
      } catch { /* status is optional */ }
    }
  }, [loadTree, workspaces, activeId, svnStatus, setStatusMap]);

  const handleToggleTreeMode = useCallback(async () => {
    if (localMode) {
      setLocalMode(false);
      await handleLoadTree();
    } else {
      const selected = await open({ multiple: false, directory: true });
      if (!selected) return;
      setLocalMode(true);
      const err = await loadLocalTree(selected);
      if (err) { setOutput({ type: "error", text: `Load failed: ${err}` }); return; }
      // Load SVN status for the local directory
      try {
        const entries = await svnStatus(selected);
        const map: Record<string, string> = {};
        for (const e of entries) map[e.path] = e.item;
        setStatusMap(map);
      } catch { /* status is optional */ }
    }
  }, [localMode, handleLoadTree, loadLocalTree, svnStatus, setStatusMap, setLocalMode]);

  const handleRefreshTree = useCallback(async () => {
    if (localMode && localPath) {
      const err = await loadLocalTree(localPath);
      if (err) { setOutput({ type: "error", text: `刷新失败: ${err}` }); }
    } else {
      await handleLoadTree();
    }
  }, [localMode, localPath, loadLocalTree, handleLoadTree]);

  // Force loading state flush before any long async invoke

  // Load diff
  const loadDiff = useCallback(async (url: string) => {
    setLoadingDiff(true);
    await tick();
    try {
      const content = await svnDiff(url);
      setDiffContent(content || "(empty diff)");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput({ type: "error", text: `Diff failed: ${msg}` });
      setDiffContent(null);
    } finally {
      setLoadingDiff(false);
    }
  }, [svnDiff]);

  // Tree node context menu actions
  const handleContextAction = useCallback((action: string, url: string, name: string) => {
    switch (action) {
      case "copy-url":
        navigator.clipboard.writeText(url).catch(() => {});
        setOutput({ type: "success", text: `已复制: ${url}` });
        break;
      case "view-log":
        setSelectedUrl(url);
        setSelectedName(name);
        setActiveTab("log");
        break;
      case "diff":
        setDiffContent(null);
        setActiveTab("diff");
        loadDiff(url);
        break;
      case "delete":
        if (localMode) {
          setConfirmDialog({
            message: `确认从 SVN 删除 ${name}？`,
            onConfirm: () => {
              setConfirmDialog(null);
              svnDelete(url)
                .then((result) => {
                  setOutput({ type: "success", text: `删除成功:\n${result}` });
                  if (localPath) loadLocalTree(localPath);
                })
                .catch((e: unknown) => setOutput({ type: "error", text: `删除失败: ${e instanceof Error ? e.message : String(e)}` }));
            },
          });
        } else {
          setConfirmDialog({
            message: `确认从 SVN 仓库删除 ${name}？此操作将直接提交。`,
            onConfirm: () => {
              setConfirmDialog(null);
              setOutput({ type: "success", text: `正在删除 ${url}...` });
              svnRemoteDelete(url, `delete ${name}`)
                .then(async (result) => {
                  setOutput({ type: "success", text: `删除成功:\n${result}` });
                  await loadTree();
                })
                .catch((e: unknown) => setOutput({ type: "error", text: `删除失败: ${e instanceof Error ? e.message : String(e)}` }));
            },
          });
        }
        break;
    }
  }, [setSelectedUrl, setSelectedName, loadDiff, svnRemoteDelete, loadTree, localMode, svnDelete, localPath, loadLocalTree]);

  // Standard Commit
  const handleCommit = useCallback(async () => {
    const ws = workspaces.find((w) => w.id === activeId);
    if (!ws?.sourcePath.trim() || !ws?.commitMsg.trim()) {
      setOutput({ type: "error", text: "请填写工作副本路径和提交信息" });
      return;
    }
    setCommitting(true);
    await tick();
    try {
      // Auto-update before commit to avoid out-of-date errors (best-effort)
      setOutput({ type: "success", text: "正在更新工作副本..." });
      try { await svnUpdate(ws.sourcePath.trim(), "working"); } catch { /* update failed, attempt commit anyway */ }
      // Auto-resolve any remaining conflicts (best-effort)
      try { await svnResolve(ws.sourcePath.trim(), "working", true); } catch { /* resolve failed, attempt commit anyway */ }
      const result = await svnCommit(ws.sourcePath.trim(), ws.commitMsg.trim());
      setOutput({ type: "success", text: result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput({ type: "error", text: msg });
    } finally {
      setCommitting(false);
    }
  }, [activeId, workspaces, svnCommit, svnUpdate, svnResolve]);

  // Load log
  const loadLog = useCallback(async (url: string) => {
    setLoadingLog(true);
    await tick();
    try {
      setLogEntries(await svnLog(url, 50));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput({ type: "error", text: `Log failed: ${msg}` });
      setLogEntries(null);
    } finally {
      setLoadingLog(false);
    }
  }, [svnLog]);

  // Auto-load log when entering log tab
  useEffect(() => {
    if (activeTab === "log" && selectedUrl) loadLog(selectedUrl);
  }, [activeTab, selectedUrl, loadLog]);

  // Source directory picker
  const pickSource = useCallback(async () => {
    const current = activeWorkspace?.sourcePath || "";
    const defaultPath = current
      ? current.replace(/\/$/, "").split("/").slice(0, -1).join("/") || "/"
      : undefined;
    const selected = await open({ multiple: false, directory: true, defaultPath });
    if (selected) setWsField("sourcePath", selected);
  }, [activeWorkspace?.sourcePath, setWsField]);

  // Status directory picker
  const pickStatusDir = useCallback(async (): Promise<string | null> => {
    const selected = await open({ multiple: false, directory: true });
    return selected || null;
  }, []);

  // Generic file picker for Add/Delete operations
  const pickFile = useCallback(async (): Promise<string | null> => {
    const selected = await open({ multiple: false, directory: false });
    return selected || null;
  }, []);

  // Toolbar actions per active tab
  const toolbarActions = useMemo((): ToolbarAction[] => {
    switch (activeTab) {
      case "log":
        return [{ id: "refresh", label: "Refresh", icon: RefreshCw, disabled: !selectedUrl || loadingLog }];
      case "diff":
        return [{ id: "refresh", label: "Refresh", icon: RefreshCw, disabled: !selectedUrl || loadingDiff }];
      case "status":
        return [
          { id: "checkout", label: "Checkout", icon: ArrowDownToLine, disabled: checkingOut || !activeWorkspace?.baseUrl },
          { id: "update", label: "Update", icon: Download, disabled: updating || !activeWorkspace?.sourcePath },
          { id: "add", label: "Add", icon: FilePlus, disabled: adding || !activeWorkspace?.sourcePath },
          { id: "delete", label: "Delete", icon: Trash2, disabled: deleting || !activeWorkspace?.sourcePath },
          { id: "revert", label: "Revert", icon: RotateCcw, disabled: reverting || !activeWorkspace?.sourcePath },
          { id: "cleanup", label: "Cleanup", icon: Wrench, disabled: cleaning || !activeWorkspace?.sourcePath },
        ];
      default:
        return [];
    }
  }, [activeTab, selectedUrl, updating, adding, deleting, reverting, cleaning, checkingOut, loadingLog, loadingDiff, activeWorkspace?.sourcePath, activeWorkspace?.baseUrl]);

  const handleToolbarAction = useCallback(async (action: string) => {
    switch (action) {
      case "settings": setOverlay("settings"); break;
      case "refresh":
        if (!selectedUrl) return;
        if (activeTab === "diff") {
          loadDiff(selectedUrl);
        } else {
          loadLog(selectedUrl);
        }
        break;
      case "checkout": {
        if (!activeWorkspace?.baseUrl?.trim()) {
          setOutput({ type: "error", text: "请先配置 SVN 地址" });
          return;
        }
        const dest = await open({ multiple: false, directory: true });
        if (!dest) return;
        setCheckingOut(true);
        await tick();
        try {
          const result = await svnCheckout(activeWorkspace.baseUrl.trim(), dest);
          setOutput({ type: "success", text: result });
          setWsField("sourcePath", dest);
        } catch (e: unknown) {
          setOutput({ type: "error", text: `Checkout 失败: ${e instanceof Error ? e.message : String(e)}` });
        } finally { setCheckingOut(false); }
        break;
      }
      case "update": {
        if (!activeWorkspace?.sourcePath?.trim()) {
          setOutput({ type: "error", text: "请先在 Commit 标签页中设置 Source Directory（工作副本路径）" });
          return;
        }
        setUpdating(true);
        await tick();
        try {
          const result = await svnUpdate(activeWorkspace.sourcePath.trim(), "working");
          setOutput({ type: "success", text: result });
        } catch (e: unknown) {
          setOutput({ type: "error", text: `Update 失败: ${e instanceof Error ? e.message : String(e)}` });
        } finally { setUpdating(false); }
        break;
      }
      case "add": {
        const targets = statusSelectedPaths.length > 0 ? statusSelectedPaths : await pickFile().then((f) => f ? [f] : []);
        if (targets.length === 0) return;
        setAdding(true);
        await tick();
        try {
          const results = await Promise.all(targets.map((f) => svnAdd(f)));
          setOutput({ type: "success", text: results.join("").trim() || `已添加 ${targets.length} 项` });
        } catch (e: unknown) {
          setOutput({ type: "error", text: `Add 失败: ${e instanceof Error ? e.message : String(e)}` });
        } finally { setAdding(false); setStatusSelectedPaths([]); }
        break;
      }
      case "delete": {
        const targets = statusSelectedPaths.length > 0 ? statusSelectedPaths : await pickFile().then((f) => f ? [f] : []);
        if (targets.length === 0) return;
        setDeleting(true);
        await tick();
        try {
          const results = await Promise.all(targets.map((f) => svnDelete(f)));
          setOutput({ type: "success", text: results.join("").trim() || `已删除 ${targets.length} 项` });
        } catch (e: unknown) {
          setOutput({ type: "error", text: `Delete 失败: ${e instanceof Error ? e.message : String(e)}` });
        } finally { setDeleting(false); setStatusSelectedPaths([]); }
        break;
      }
      case "revert": {
        const targets = statusSelectedPaths.length > 0 ? statusSelectedPaths : [];
        if (targets.length === 0) {
          setOutput({ type: "error", text: "请先在 Status 列表中选择要还原的文件" });
          return;
        }
        setReverting(true);
        await tick();
        try {
          const results = await Promise.all(targets.map((f) => svnRevert(f)));
          setOutput({ type: "success", text: results.join("").trim() || `已还原 ${targets.length} 项` });
        } catch (e: unknown) {
          setOutput({ type: "error", text: `Revert 失败: ${e instanceof Error ? e.message : String(e)}` });
        } finally { setReverting(false); setStatusSelectedPaths([]); }
        break;
      }
      case "cleanup": {
        if (!activeWorkspace?.sourcePath?.trim()) {
          setOutput({ type: "error", text: "请先设置 Source Directory" });
          return;
        }
        setCleaning(true);
        await tick();
        try {
          const result = await svnCleanup(activeWorkspace.sourcePath.trim());
          setOutput({ type: "success", text: result || "Cleanup 完成" });
        } catch (e: unknown) {
          setOutput({ type: "error", text: `Cleanup 失败: ${e instanceof Error ? e.message : String(e)}` });
        } finally { setCleaning(false); }
        break;
      }
      default: setOutput({ type: "error", text: `功能 "${action}" 尚未实现` });
    }
  }, [selectedUrl, loadLog, loadDiff, activeTab, activeWorkspace?.sourcePath, activeWorkspace?.baseUrl, svnUpdate, svnCheckout, svnAdd, svnDelete, svnRevert, svnCleanup, pickFile, statusSelectedPaths, setWsField, checkingOut]);

  // Test connection
  const handleTestConnection = useCallback(async () => {
    const ws = workspaces.find((w) => w.id === activeId);
    if (!ws?.baseUrl.trim()) {
      setOutput({ type: "error", text: "请先配置 SVN 地址" });
      return;
    }
    setOutput({ type: "success", text: "正在测试连接..." });
    await tick();
    try {
      const result = await testConnection(ws.baseUrl);
      setOutput({ type: "success", text: result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput({ type: "error", text: `连接失败: ${msg}` });
    }
  }, [activeId, workspaces, testConnection]);

  // Splitter
  const onSplitterDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    splitting.current = true;
    const startX = e.clientX;
    const startW = leftWidth;
    const onMove = (ev: MouseEvent) => {
      if (!splitting.current) return;
      setLeftWidth(Math.min(Math.max(startW + ev.clientX - startX, 180), window.innerWidth * 0.6));
    };
    const onUp = () => {
      splitting.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [leftWidth]);

  // Workspace management
  const switchWorkspace = useCallback((id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    resetTree();
    setLogEntries(null);
  }, [activeId, setActiveId, resetTree]);

  const handleDeleteWorkspace = useCallback((id: string) => {
    if (workspaces.length <= 1) return;
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    if (activeId === id) {
      const remaining = workspaces.filter((w) => w.id !== id);
      switchWorkspace(remaining[0]?.id || "default");
    }
  }, [workspaces, activeId, setWorkspaces, switchWorkspace]);

  const openNewWorkspace = useCallback(() => {
    setEditWsId(null);
    setWsForm({ name: "", baseUrl: "", username: "", password: "" });
    setOverlay("workspace");
  }, []);

  const openEditWorkspace = useCallback((id: string) => {
    const ws = workspaces.find((w) => w.id === id);
    if (!ws) return;
    setEditWsId(id);
    setWsForm({ name: ws.name, baseUrl: ws.baseUrl, username: ws.username, password: ws.password });
    setOverlay("workspace");
  }, [workspaces]);

  const handleWsFormChange = useCallback((field: string, value: string) => {
    if (field === "baseUrl") { try { value = decodeURI(value); } catch { /* ignore */ } }
    setWsForm((f) => ({ ...f, [field]: value }));
  }, []);

  const saveWorkspace = useCallback(() => {
    const url = (() => { try { return decodeURI(wsForm.baseUrl.trim()); } catch { return wsForm.baseUrl.trim(); } })();
    if (!url) return;
    if (editWsId) {
      setWorkspaces((prev) => prev.map((w) =>
        w.id === editWsId ? { ...w, name: wsForm.name || "工作空间", baseUrl: url, username: wsForm.username, password: wsForm.password } : w
      ));
    } else {
      const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setWorkspaces((prev) => [...prev, {
        id, name: wsForm.name || `工作空间 ${workspaces.length + 1}`, baseUrl: url,
        username: wsForm.username, password: wsForm.password,
        sourcePath: "", commitMsg: "update shj-fxc", filterExt: "", sortByDate: false,
      }]);
      setActiveId(id);
    }
    closeOverlay();
  }, [editWsId, wsForm, workspaces.length, setWorkspaces, setActiveId, closeOverlay]);

  // Drag-drop listener
  useEffect(() => {
    const unlisten = getCurrentWindow().onDragDropEvent((e) => {
      switch (e.payload.type) {
        case "enter": dragCounter.current += 1; break;
        case "leave":
          dragCounter.current -= 1;
          if (dragCounter.current <= 0) { dragCounter.current = 0; }
          break;
        case "over": break;
        case "drop":
          dragCounter.current = 0;
          if (e.payload.paths.length > 0) setWsField("sourcePath", e.payload.paths[0]);
          break;
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setWsField]);

  // Window drag region (panel-drag in left panel)
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.buttons === 1) {
        e.detail === 2 ? appWindow.toggleMaximize() : appWindow.startDragging();
      }
    };
    dragRegionRef.current?.addEventListener("mousedown", onMouseDown);
    return () => dragRegionRef.current?.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div className="app">
      <div className="top-bar" ref={dragRegionRef}>
        <button className="top-bar-settings" onClick={() => setOverlay("settings")} title="设置">
          <Settings size={16} />
        </button>
      </div>
      <div className="layout">
        <WorkspaceBar
          workspaces={workspaces}
          activeId={activeId}
          onSwitch={switchWorkspace}
          onAdd={openNewWorkspace}
          onEdit={openEditWorkspace}
          onDelete={handleDeleteWorkspace}
        />

        <div className="panel-left" style={{ width: leftWidth }}>
          <TreePanel
            treeRoot={treeRoot}
            treeLoading={treeLoading}
            selectedUrl={selectedUrl}
            filterOpen={filterOpen}
            searchText={searchText}
            workspace={activeWorkspace}
            onLoadTree={handleLoadTree}
            onSelect={onSelect}
            onSearchChange={setSearchText}
            onFilterOpenChange={setFilterOpen}
            onFilterExtChange={(ext) => setWsField("filterExt", ext)}
            onSortToggle={() => setWsField("sortByDate", !activeWorkspace?.sortByDate)}
            svnLs={svnLs}
            sortEntries={sortEntries}
            isFiltered={isFiltered}
            matchesSearch={matchesSearch}
            onContextAction={handleContextAction}
            statusMap={statusMap}
            localMode={localMode}
            onToggleTreeMode={handleToggleTreeMode}
            readLocalDir={readLocalDir}
            onRefreshTree={handleRefreshTree}
            localPath={localPath}
          />
        </div>

        <div className="panel-right">
          {overlay ? (
            overlay === "settings" ? (
              <SettingsPanel theme={theme} onThemeChange={setTheme} onClose={closeOverlay} onTestConnection={handleTestConnection} />
            ) : (
              <WorkspacePanel
                editWsId={editWsId}
                wsForm={wsForm}
                onFormChange={handleWsFormChange}
                onSave={saveWorkspace}
                onCancel={closeOverlay}
              />
            )
          ) : (
            <>
              <TabBar activeTab={activeTab} onTabChange={(t) => setActiveTab(t as typeof activeTab)} />
              <Toolbar actions={toolbarActions} onAction={handleToolbarAction} />
              {activeTab === "status" && (
                <StatusPanel
                  svnStatus={svnStatus}
                  defaultPath={activeWorkspace?.sourcePath}
                  onPickDirectory={pickStatusDir}
                  onOutput={addMessage}
                  selectedPaths={statusSelectedPaths}
                  onSelectionChange={setStatusSelectedPaths}
                />
              )}
              {activeTab === "log" && <LogPanel selectedUrl={selectedUrl} logEntries={logEntries} loadingLog={loadingLog} />}
              {activeTab === "commit" && (
                <CommitPanel
                  workspace={activeWorkspace}
                  committing={committing}
                  onCommit={handleCommit}
                  onPickSource={pickSource}
                  onSetWsField={setWsField}
                />
              )}
              {activeTab === "diff" && (
                <DiffPanel
                  selectedUrl={selectedUrl}
                  selectedName={selectedName}
                  diffContent={diffContent}
                  loadingDiff={loadingDiff}
                  onRefresh={selectedUrl ? () => loadDiff(selectedUrl) : undefined}
                />
              )}
            </>
          )}

          <TerminalPanel messages={messages} onClear={() => setMessages([])} />
        </div>

        <div className="splitter" style={{ left: 52 + leftWidth - 3 }} onMouseDown={onSplitterDown} />
      </div>

      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="modal-message">{confirmDialog.message}</p>
            <div className="modal-buttons">
              <button className="btn" onClick={() => setConfirmDialog(null)}>取消</button>
              <button className="btn btn-primary" onClick={confirmDialog.onConfirm}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
