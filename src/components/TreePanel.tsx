import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, ArrowUpDown, Filter, RefreshCw } from "lucide-react";
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
            {treeLoading ? <span className="spinner" /> : "Load Tree"}
          </button>
        )}
        {treeRoot && (
          <button className="btn btn-icon" onClick={onSortToggle} title={workspace?.sortByDate ? "按名称排序" : "按日期排序"}>
            <ArrowUpDown size={14} className={workspace?.sortByDate ? "text-primary" : ""} />
          </button>
        )}
        {treeRoot && (
          <button className="btn btn-small" onClick={onToggleTreeMode} title={localMode ? "切换到远程" : "浏览本地目录"}>
            {localMode ? "远程" : "本地"}
          </button>
        )}
        {treeRoot && (
          <button className="btn btn-icon" onClick={() => onFilterOpenChange(!filterOpen)} title="筛选">
            <Filter size={14} className={filterOpen ? "text-primary" : ""} />
          </button>
        )}
        {treeRoot && (
          <button className="btn btn-icon" onClick={onRefreshTree} disabled={treeLoading} title="刷新">
            <RefreshCw size={14} className={treeLoading ? "spin" : ""} />
          </button>
        )}
      </div>
      <div className="tree-search">
        <Search size={12} className="tree-search-icon" />
        <input
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索..."
        />
      </div>
      {filterOpen && (
        <div className="tree-filter">
          <input
            value={workspace?.filterExt || ""}
            onChange={(e) => onFilterExtChange(e.target.value)}
            placeholder="扩展名, 逗号隔开, 如: .jar,.class"
          />
        </div>
      )}
      <div className="tree-container">
        {!workspace?.baseUrl && !localMode ? (
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
            svnLs={localMode && readLocalDir ? readLocalDir : svnLs}
            onContextMenu={handleContextMenu}
            statusMap={statusMap}
            baseUrl={localMode && localPath ? localPath : workspace?.baseUrl}
          />
        ) : localMode ? (
          <div className="tree-empty">点击"远程"加载目录</div>
        ) : (
          <div className="tree-empty">点击 Load Tree</div>
        )}
      </div>

      {ctxMenu && createPortal(
        <div ref={ctxRef} className="ctx-menu" style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999 }}>
          {ctxMenu.kind === "dir" && (
            <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("mkdir", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
              新建文件夹
            </div>
          )}
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("copy-url", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            复制 URL
          </div>
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("rename", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            重命名
          </div>
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("view-log", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            查看提交历史
          </div>
          <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("delete", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
            删除
          </div>
          {ctxMenu.kind !== "dir" && (
            <>
              <div className="ctx-divider" />
              <div className="ctx-menu-item" onMouseDown={() => { onContextAction?.("diff", ctxMenu.url, ctxMenu.name); setCtxMenu(null); }}>
                Diff
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
