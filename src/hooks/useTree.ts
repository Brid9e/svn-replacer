import { useState, useCallback, useEffect } from "react";
import type { TreeNode, SvnEntry, Workspace } from "../types";

export function useTree(
  workspace: Workspace | undefined,
  svnLs: (url: string) => Promise<SvnEntry[]>,
  readLocalDir?: (path: string) => Promise<SvnEntry[]>,
) {
  const [treeRoot, setTreeRoot] = useState<TreeNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [localMode, setLocalMode] = useState(false);
  const [localPath, setLocalPath] = useState("");

  const resetTree = useCallback(() => {
    setTreeRoot(null);
    setSelectedUrl(null);
    setSelectedName(null);
    setSearchText("");
    setFilterOpen(false);
    setStatusMap({});
    setLocalMode(false);
    setLocalPath("");
  }, []);

  // Sort helper
  const sortEntries = useCallback((entries: TreeNode[]) => {
    if (!workspace?.sortByDate) return entries;
    return [...entries].sort((a, b) => {
      if (a.date < b.date) return 1;
      if (a.date > b.date) return -1;
      return 0;
    });
  }, [workspace?.sortByDate]);

  // Filter helper
  const isFiltered = useCallback((name: string, kind: string) => {
    const ext = workspace?.filterExt || "";
    if (kind === "dir" || !ext.trim()) return false;
    const exts = ext.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (exts.length === 0) return false;
    const lower = name.toLowerCase();
    return exts.some((e) => lower.endsWith(e));
  }, [workspace?.filterExt]);

  const matchesSearch = useCallback((node: TreeNode, text: string): boolean => {
    if (!text.trim()) return true;
    const lower = text.toLowerCase();
    if (node.name.toLowerCase().includes(lower)) return true;
    return node.children.some((c) => matchesSearch(c, text));
  }, []);

  // Load remote tree (SVN)
  const loadTree = useCallback(async () => {
    if (!workspace?.baseUrl.trim()) return;
    setTreeLoading(true);
    await new Promise<void>((r) => setTimeout(r, 0));
    try {
      const url = workspace.baseUrl.trim().replace(/\/?$/, "/");
      const entries = await svnLs(url);
      const root: TreeNode = {
        name: workspace.baseUrl.split("/").filter(Boolean).pop() || "root",
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
      try { localStorage.setItem(`treeCache_${workspace.id}`, JSON.stringify(root)); } catch { /* ignore */ }
      setTreeRoot(root);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return msg;
    } finally {
      setTreeLoading(false);
    }
    return undefined;
  }, [workspace, svnLs]);

  // Load local tree (filesystem)
  const loadLocalTree = useCallback(async (path: string) => {
    if (!path.trim() || !readLocalDir) return "No path or readLocalDir";
    setTreeLoading(true);
    await new Promise<void>((r) => setTimeout(r, 0));
    try {
      const entries = await readLocalDir(path);
      const name = path.split("/").filter(Boolean).pop() || "root";
      const root: TreeNode = {
        name,
        fullUrl: path.replace(/\/?$/, "/"),
        kind: "dir",
        date: "",
        children: entries
          .filter((e) => e.name)
          .map((e) => ({
            name: e.name,
            fullUrl: `${path.replace(/\/?$/, "/")}${e.name}`,
            kind: e.kind,
            date: "",
            children: [],
            expanded: false,
            loaded: false,
          })),
        expanded: true,
        loaded: true,
      };
      setTreeRoot(root);
      setLocalPath(path.replace(/\/?$/, "/"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return msg;
    } finally {
      setTreeLoading(false);
    }
    return undefined;
  }, [readLocalDir]);

  // Restore cached tree on mount or workspace change
  useEffect(() => {
    if (!workspace?.baseUrl || localMode) return;
    const cacheKey = `treeCache_${workspace.id}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const root = JSON.parse(cached) as TreeNode;
        const reset = (n: TreeNode) => {
          n.expanded = n.kind === "dir" && n.children.length > 0 && n.name === (workspace.baseUrl.split("/").filter(Boolean).pop() || "root");
          n.loaded = n === root;
          n.children.forEach(reset);
        };
        reset(root);
        setTreeRoot(root);
      }
    } catch { /* ignore */ }
  }, [workspace?.id, localMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    treeRoot, setTreeRoot,
    treeLoading, setTreeLoading,
    selectedUrl, setSelectedUrl,
    selectedName, setSelectedName,
    filterOpen, setFilterOpen,
    searchText, setSearchText,
    statusMap, setStatusMap,
    localMode, setLocalMode,
    localPath,
    resetTree,
    loadTree,
    loadLocalTree,
    sortEntries,
    isFiltered,
    matchesSearch,
  };
}
