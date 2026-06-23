import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Settings } from "lucide-react";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { useTerminal } from "./hooks/useTerminal";
import { useSvnCommands } from "./hooks/useSvnCommands";
import { useTree } from "./hooks/useTree";
import { useSvnOperations } from "./hooks/useSvnOperations";
import { WorkspaceBar } from "./components/WorkspaceBar";
import { TreePanel } from "./components/TreePanel";
import { TabBar } from "./components/TabBar";
import { Toolbar } from "./components/Toolbar";
import { TerminalPanel } from "./components/TerminalPanel";
import { LogPanel } from "./components/panels/LogPanel";
import { CommitPanel } from "./components/panels/CommitPanel";
import { ReplacePanel } from "./components/panels/ReplacePanel";
import { StatusPanel } from "./components/panels/StatusPanel";
import { DiffPanel } from "./components/panels/DiffPanel";
import { SettingsPanel } from "./components/panels/SettingsPanel";
import { WorkspacePanel } from "./components/panels/WorkspacePanel";
import { ConfirmDialog } from "./components/dialogs/ConfirmDialog";
import { SvnOperationDialog } from "./components/dialogs/SvnOperationDialog";
import { useSvnActions } from "./hooks/useSvnActions";
import type { SvnLogEntry } from "./types";
import "./index.css";

const appWindow = getCurrentWindow();

// Force React to flush pending state updates before long async operations
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function App() {
  const { t } = useTranslation();

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
  const [activeTab, setActiveTab] = useState<"status" | "log" | "replace" | "commit" | "diff">("commit");
  const [overlay, setOverlay] = useState<"settings" | "workspace" | null>(null);
  const [editWsId, setEditWsId] = useState<string | null>(null);
  const [wsForm, setWsForm] = useState({ name: "", baseUrl: "", username: "", password: "" });

  // Hooks
  const { workspaces, activeId, activeWorkspace, setWorkspaces, setActiveId, setWsField } = useWorkspaces();
  const { svnLs, svnLog, svnStatus, svnUpdate, svnCheckout, svnAdd, svnDelete, svnDiff, svnRevert, svnCleanup, svnResolve, svnCommit, svnRemoteDelete, svnRename, svnMkdir, svnInfo, svnBlame, svnExport, svnRemoteCopy, svnRemoteMove, readLocalDir, doReplace } = useSvnCommands(workspaces, activeId);
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

  const { messages, addMessage, setOutput, onClear } = useTerminal();

  const {
    committing, setCommitting, updating, setUpdating,
    adding, setAdding, replacing, setReplacing,
    deleting, setDeleting, reverting, setReverting,
    cleaning, setCleaning, checkingOut, setCheckingOut,
    renameDialog, setRenameDialog, renameNewName, setRenameNewName, renameMsg, setRenameMsg, handleRename,
    mkdirParentUrl, setMkdirParentUrl, mkdirName, setMkdirName, mkdirMsg, setMkdirMsg, handleMkdir,
    copyDialog, setCopyDialog, copyDestUrl, setCopyDestUrl, copyMsg, setCopyMsg, handleCopy,
    moveDialog, setMoveDialog, moveDestUrl, setMoveDestUrl, moveMsg, setMoveMsg, handleMove,
    confirmDialog, setConfirmDialog,
    statusSelectedPaths, setStatusSelectedPaths,
  } = useSvnOperations({
    svnDelete, svnRemoteDelete, svnRename, svnMkdir, svnRemoteCopy, svnRemoteMove,
    loadTree, setOutput,
  });

  // Log
  const [logEntries, setLogEntries] = useState<SvnLogEntry[] | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);

  // Diff
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

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
    if (err) { setOutput({ type: "error", text: t("action.loadFailed", { err }) }); return; }
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
      if (err) { setOutput({ type: "error", text: t("action.loadFailed", { err }) }); return; }
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
      if (err) { setOutput({ type: "error", text: t("action.loadLocalFailed", { err }) }); }
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
      setDiffContent(content || t("diff.empty"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput({ type: "error", text: t("action.diffFailed", { msg }) });
      setDiffContent(null);
    } finally {
      setLoadingDiff(false);
    }
  }, [svnDiff, t]);

  // Standard Commit
  const handleCommit = useCallback(async () => {
    const ws = workspaces.find((w) => w.id === activeId);
    if (!ws?.sourcePath.trim() || !ws?.commitMsg.trim()) {
      setOutput({ type: "error", text: t("commit.noPathOrMsg") });
      return;
    }
    setCommitting(true);
    await tick();
    try {
      // Auto-update before commit to avoid out-of-date errors (best-effort)
      setOutput({ type: "success", text: t("commit.autoUpdate") });
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
  }, [activeId, workspaces, svnCommit, svnUpdate, svnResolve, t]);

  // Replace (do_replace — upload local directory to remote SVN URL)
  const handleReplace = useCallback(async (source: string, targetUrl: string, commitMsg: string) => {
    setReplacing(true);
    await tick();
    try {
      const result = await doReplace(source, targetUrl, commitMsg);
      setOutput({ type: "success", text: result.message });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput({ type: "error", text: `${t("replace.replaceFailed")}: ${msg}` });
    } finally {
      setReplacing(false);
    }
  }, [doReplace, t]);

  // Load log
  const loadLog = useCallback(async (url: string) => {
    setLoadingLog(true);
    await tick();
    try {
      setLogEntries(await svnLog(url, 50));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput({ type: "error", text: t("action.logFailed", { msg }) });
      setLogEntries(null);
    } finally {
      setLoadingLog(false);
    }
  }, [svnLog, t]);

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

  // Directory picker for Replace source (both files and directories can be replaced)
  const pickReplaceSource = useCallback(async (): Promise<string | null> => {
    const selected = await open({ multiple: false, directory: true });
    return selected || null;
  }, []);

  const { dispatch, toolbarActions } = useSvnActions({
    setOutput,
    setSelectedUrl, setSelectedName, loadTree, loadLocalTree, localMode, localPath,
    setDiffContent, loadDiff, loadLog,
    setActiveTab: setActiveTab as (tab: string) => void,
    svnCheckout, svnDelete, svnRemoteDelete, svnInfo, svnBlame, svnExport,
    svnUpdate, svnAdd, svnRevert, svnCleanup,
    setRenameDialog, setRenameNewName, setRenameMsg,
    setMkdirParentUrl, setMkdirName, setMkdirMsg,
    setCopyDialog, setCopyDestUrl, setCopyMsg,
    setMoveDialog, setMoveDestUrl, setMoveMsg,
    setConfirmDialog,
    setCheckingOut, setUpdating, setAdding, setDeleting, setReverting, setCleaning,
    statusSelectedPaths, setStatusSelectedPaths,
    activeWorkspace, setWsField: setWsField as (field: string, value: string) => void,
    pickFile, setOverlay,
    activeTab, selectedUrl,
    checkingOut, updating, adding, deleting, reverting, cleaning, loadingLog, loadingDiff,
  });

  const handleContextAction = useCallback((action: string, url: string, name: string) => {
    dispatch({ source: "context", action, url, name });
  }, [dispatch]);

  const handleToolbarAction = useCallback((action: string) => {
    dispatch({ source: "toolbar", action });
  }, [dispatch]);

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
        w.id === editWsId ? { ...w, name: wsForm.name || t("workspace.defaultName"), baseUrl: url, username: wsForm.username, password: wsForm.password } : w
      ));
    } else {
      const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setWorkspaces((prev) => [...prev, {
        id, name: wsForm.name || `${t("workspace.defaultName")} ${workspaces.length + 1}`, baseUrl: url,
        username: wsForm.username, password: wsForm.password,
        sourcePath: "", commitMsg: "update shj-fxc", filterExt: "", sortByDate: false,
      }]);
      setActiveId(id);
    }
    closeOverlay();
  }, [editWsId, wsForm, workspaces.length, setWorkspaces, setActiveId, closeOverlay, t]);

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
        <button className="top-bar-settings" onClick={() => setOverlay("settings")} title={t("common.settings")}>
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
              <SettingsPanel theme={theme} onThemeChange={setTheme} onClose={closeOverlay} />
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
              {activeTab === "replace" && (
                <ReplacePanel
                  selectedUrl={selectedUrl}
                  replacing={replacing}
                  onReplace={handleReplace}
                  onPickSource={pickReplaceSource}
                />
              )}
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

          <TerminalPanel messages={messages} onClear={onClear} />
        </div>

        <div className="splitter" style={{ left: 52 + leftWidth - 3 }} onMouseDown={onSplitterDown} />
      </div>

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      <SvnOperationDialog
        open={renameDialog !== null}
        title={<span>{t("dialog.renameTitle", { name: renameDialog?.name ?? "" })}</span>}
        fields={[
          { label: t("dialog.renameNewName"), value: renameNewName, placeholder: t("dialog.renameNewNamePlaceholder"), onChange: setRenameNewName, autoFocus: true },
          { label: t("common.commitOptional"), value: renameMsg, placeholder: t("dialog.renameMsgPlaceholder", { name: renameDialog?.name ?? "", newName: renameNewName || "..." }), onChange: setRenameMsg },
        ]}
        confirmDisabled={!renameNewName.trim()}
        onConfirm={handleRename}
        onCancel={() => setRenameDialog(null)}
      />

      <SvnOperationDialog
        open={mkdirParentUrl !== null}
        title={t("dialog.mkdirTitle")}
        fields={[
          { label: t("dialog.mkdirName"), value: mkdirName, placeholder: t("dialog.mkdirNamePlaceholder"), onChange: setMkdirName, autoFocus: true },
          { label: t("common.commitOptional"), value: mkdirMsg, placeholder: t("dialog.mkdirMsgPlaceholder"), onChange: setMkdirMsg },
        ]}
        confirmDisabled={!mkdirName.trim()}
        onConfirm={handleMkdir}
        onCancel={() => setMkdirParentUrl(null)}
      />
      <SvnOperationDialog
        open={copyDialog !== null}
        title={<span>{t("dialog.copyTitle", { name: copyDialog?.name ?? "" })}</span>}
        fields={[
          { label: t("dialog.copyDestUrl"), value: copyDestUrl, placeholder: t("dialog.copyDestUrlPlaceholder"), onChange: setCopyDestUrl, autoFocus: true },
          { label: t("common.commitOptional"), value: copyMsg, placeholder: t("dialog.copyMsgPlaceholder", { name: copyDialog?.name ?? "" }), onChange: setCopyMsg },
        ]}
        confirmDisabled={!copyDestUrl.trim()}
        onConfirm={handleCopy}
        onCancel={() => setCopyDialog(null)}
      />

      <SvnOperationDialog
        open={moveDialog !== null}
        title={<span>{t("dialog.moveTitle", { name: moveDialog?.name ?? "" })}</span>}
        fields={[
          { label: t("dialog.moveDestUrl"), value: moveDestUrl, placeholder: t("dialog.moveDestUrlPlaceholder"), onChange: setMoveDestUrl, autoFocus: true },
          { label: t("common.commitOptional"), value: moveMsg, placeholder: t("dialog.moveMsgPlaceholder", { name: moveDialog?.name ?? "" }), onChange: setMoveMsg },
        ]}
        confirmDisabled={!moveDestUrl.trim()}
        onConfirm={handleMove}
        onCancel={() => setMoveDialog(null)}
      />
    </div>
  );
}

export default App;
