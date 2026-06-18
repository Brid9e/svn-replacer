import { useState } from "react";
import { Folder, File, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import type { TreeNode, SvnEntry } from "../types";

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  modified:    { label: "M",  color: "#f0ad4e" },
  added:       { label: "A",  color: "#5cb85c" },
  deleted:     { label: "D",  color: "#d9534f" },
  unversioned: { label: "?",  color: "#999" },
  missing:     { label: "!",  color: "#d9534f" },
  conflicted:  { label: "C",  color: "#d9534f" },
  obstructed:  { label: "~",  color: "#f0ad4e" },
  replaced:    { label: "R",  color: "#5cb85c" },
  ignored:     { label: "I",  color: "#777" },
};

function getStatusBadge(node: TreeNode, statusMap: Record<string, string> | undefined, baseUrl: string | undefined): { label: string; color: string } | null {
  if (!statusMap || !baseUrl || node.kind === "dir") return null;
  const relative = node.fullUrl.replace(baseUrl.replace(/\/?$/, "/"), "");
  const item = statusMap[relative];
  return item ? STATUS_BADGE[item] || { label: item, color: "#999" } : null;
}

export function TreeItem({
  node,
  depth,
  onSelect,
  selectedUrl,
  isFiltered,
  sortEntries,
  searchText,
  matchesSearch,
  svnLs,
  onContextMenu,
  statusMap,
  baseUrl,
}: {
  node: TreeNode;
  depth: number;
  onSelect: (url: string, name: string) => void;
  selectedUrl: string | null;
  isFiltered: (name: string, kind: string) => boolean;
  sortEntries: (entries: TreeNode[]) => TreeNode[];
  searchText: string;
  matchesSearch: (node: TreeNode, text: string) => boolean;
  svnLs: (url: string) => Promise<SvnEntry[]>;
  onContextMenu?: (e: React.MouseEvent, url: string, name: string, kind: string) => void;
  statusMap?: Record<string, string>;
  baseUrl?: string;
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
        const entries = await svnLs(node.fullUrl.replace(/\/?$/, "/"));
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
  const badge = getStatusBadge(node, statusMap, baseUrl);

  return (
    <div>
      <div
        className={`tree-node ${isSelected ? "tree-selected" : ""}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={toggle}
        onContextMenu={(e) => onContextMenu?.(e, node.fullUrl, node.name, node.kind)}
      >
        <span className="tree-icon">
          {node.kind === "dir"
            ? loading
              ? <Loader2 size={12} className="spin" />
              : node.expanded
                ? <ChevronDown size={12} />
                : <ChevronRight size={12} />
            : null}
        </span>
        <span className="tree-kind">{node.kind === "dir" ? <Folder size={14} /> : <File size={14} />}</span>
        <span className="tree-name">{node.name}</span>
        {badge && (
          <span className="tree-status-badge" style={{ color: badge.color, borderColor: badge.color }}>
            {badge.label}
          </span>
        )}
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
            svnLs={svnLs}
            onContextMenu={onContextMenu}
            statusMap={statusMap}
            baseUrl={baseUrl}
          />
        ))}
    </div>
  );
}
