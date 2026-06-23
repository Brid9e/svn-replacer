import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Search, ArrowUpDown, Filter, RefreshCw, FolderPlus, Link, Copy, Pencil, History, ArrowDownToLine, Trash2, MoveRight, Download, Code2, Info, FileText } from "lucide-react";
import type { TreeNode, Workspace, SvnEntry } from "../types";
import { TreeItem } from "./TreeItem";

export function TreePanel({
  treeRoot,
  treeLoading,
  selectedUrl,
  filterOpen,
  searchText,
  workspace,
  onLoadTree,
  onSelect,
  onSearchChange,
  onFilterOpenChange,
  onFilterExtChange,
  onSortToggle,
  svnLs,
  sortEntries,
  isFiltered,
  matchesSearch,
  onContextAction,
  statusMap,
  localMode,
  onToggleTreeMode,
  readLocalDir,
  onRefreshTree,
  localPath,
}: {
  treeRoot: TreeNode | null;
  treeLoading: boolean;
  selectedUrl: string | null;
  filterOpen: boolean;
  searchText: string;
  workspace: Workspace | undefined;
  onLoadTree: () => void;
  onSelect: (url: string, name: string) => void;
  onSearchChange: (text: string) => void;
  onFilterOpenChange: (open: boolean) => void;
  onFilterExtChange: (ext: string) => void;
  onSortToggle: () => void;
  svnLs: (url: string) => Promise<SvnEntry[]>;
  sortEntries: (entries: TreeNode[]) => TreeNode[];
  isFiltered: (name: string, kind: string) => boolean;
  matchesSearch: (node: TreeNode, text: string) => boolean;
  onContextAction?: (action: string, url: string, name: string) => void;
  statusMap?: Record<string, string>;
  localMode?: boolean;
  onToggleTreeMode?: () => void;
  readLocalDir?: (path: string) => Promise<SvnEntry[]>;
  onRefreshTree?: () => void;
  localPath?: string;
}) {
  const { t } = useTranslation();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; url: string; name: string; kind: string } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctxMenu]);

  const handleContextMenu = (e: React.MouseEvent, url: string, name: string, kind: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, url, name, kind });
  };

  return (
    <>
      <div className="tree-toolbar">
        {!treeRoot && (
          <button className="btn" onClick={onLoadTree} disabled={treeLoading || !workspace?.baseUrl} style={{ flex: 1 }}>
            {treeLoading ? <span className="spinner" /> : t("tree.loadTree")}
          </button>
        )}
        {treeRoot && (
          <button className="btn btn-icon" onClick={onSortToggle} title={workspace?.sortByDate ? t("workspace.sortByName") : t("workspace.sortByDate")}>
            <ArrowUpDown size={14} className={workspace?.sortByDate ? "text-primary" : ""} />
          </button>
        )}
        {treeRoot && (
          <button className="btn btn-small" onClick={onToggleTreeMode} title={localMode ? t("workspace.switchRemote") : t("workspace.switchLocal")}>
            {localMode ? t("workspace.remote") : t("workspace.local")}
          </button>
        )}
        {treeRoot && (
          <button className="btn btn-icon" onClick={() => onFilterOpenChange(!filterOpen)} title={t("common.filter")}>
            <Filter size={14} className={filterOpen ? "text-primary" : ""} />
          </button>
        )}
        {treeRoot && (
          <button className="btn btn-icon" onClick={onRefreshTree} disabled={treeLoading} title={t("common.refresh")}>
            <RefreshCw size={14} className={treeLoading ? "spin" : ""} />
          </button>
        )}
      </div>
      <div className="tree-search">
        <Search size={12} className="tree-search-icon" />
        <input
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("common.search")}
        />
      </div>
      {filterOpen && (
        <div className="tree-filter">
          <input
            value={workspace?.filterExt || ""}
            onChange={(e) => onFilterExtChange(e.target.value)}
            placeholder={t("workspace.filterExt")}
          />
        </div>
      )}
      <div className="tree-container">
        {!workspace?.baseUrl && !localMode ? (
          <div className="tree-empty">{t("tree.noUrl")}</div>
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
            svnLs={localMode && readLocalDir ? readLocalDir : svnLs}
            onContextMenu={handleContextMenu}
            statusMap={statusMap}
            baseUrl={localMode && localPath ? localPath : workspace?.baseUrl}
          />
        ) : localMode ? (
          <div className="tree-empty">{t("tree.loadFirst")}</div>
        ) : (
          <div className="tree-empty">{t("tree.clickLoad")}</div>
        )}
      </div>

      {ctxMenu && createPortal(
        <div ref={ctxRef} className="ctx-menu" style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999 }}>
          {ctxMenu.kind === "dir" && (
            <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("mkdir", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
              <FolderPlus size={14} /> {t("common.createDir")}
            </div>
          )}
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("copy-url", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            <Link size={14} /> {t("common.copyUrl")}
          </div>
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("copy-name", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            <Copy size={14} /> {t("common.copyName")}
          </div>
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("rename", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            <Pencil size={14} /> {t("common.rename")}
          </div>
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("view-log", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            <History size={14} /> {t("common.viewLog")}
          </div>
          <div className="ctx-divider" />
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("checkout", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            <ArrowDownToLine size={14} /> {t("common.checkout")}
          </div>
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("delete", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            <Trash2 size={14} /> {t("common.delete")}
          </div>
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("copy-to", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            <Copy size={14} /> {t("common.copyTo")}
          </div>
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("move-to", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            <MoveRight size={14} /> {t("common.moveTo")}
          </div>
          <div className="ctx-divider" />
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("export", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            <Download size={14} /> {t("common.export")}
          </div>
          <div className="ctx-divider" />
          {ctxMenu.kind !== "dir" && (
            <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("diff", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
              <Code2 size={14} /> {t("common.diff")}
            </div>
          )}
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("info", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            <Info size={14} /> {t("common.info")}
          </div>
          {ctxMenu.kind !== "dir" && (
            <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("blame", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
              <FileText size={14} /> {t("common.blame")}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
