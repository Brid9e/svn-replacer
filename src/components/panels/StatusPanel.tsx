import { useTranslation } from "react-i18next";
import { useState, useMemo, useCallback } from "react";
import { Folder, RefreshCw } from "lucide-react";
import type { SvnStatusEntry } from "../../types";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  modified:    { label: "M",  color: "var(--status-modified, #f0ad4e)" },
  added:       { label: "A",  color: "var(--status-added, #5cb85c)" },
  deleted:     { label: "D",  color: "var(--status-deleted, #d9534f)" },
  unversioned: { label: "?",  color: "var(--status-unversioned, #999)" },
  missing:     { label: "!",  color: "var(--status-missing, #d9534f)" },
  conflicted:  { label: "C",  color: "var(--status-conflicted, #d9534f)" },
  obstructed:  { label: "~",  color: "var(--status-obstructed, #f0ad4e)" },
  replaced:    { label: "R",  color: "var(--status-replaced, #5cb85c)" },
  ignored:     { label: "I",  color: "var(--status-ignored, #777)" },
};

function statusColor(item: string): string {
  return STATUS_LABELS[item]?.color || "var(--text-muted, #999)";
}

function statusLabel(item: string): string {
  return STATUS_LABELS[item]?.label || item[0]?.toUpperCase() || "?";
}

export interface StatusPanelHandle {
  wcPath: string;
  selectedPaths: string[];
}

export function StatusPanel({
  svnStatus,
  defaultPath,
  onPickDirectory,
  onOutput,
  selectedPaths,
  onSelectionChange,
}: {
  svnStatus: (path: string) => Promise<SvnStatusEntry[]>;
  defaultPath?: string;
  onPickDirectory: () => Promise<string | null>;
  onOutput: (type: string, text: string) => void;
  selectedPaths: string[];
  onSelectionChange: (paths: string[]) => void;
}) {
  const { t } = useTranslation();
  const [wcPath, setWcPath] = useState(defaultPath || "");
  const [entries, setEntries] = useState<SvnStatusEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const summary = useMemo(() => {
    if (!entries) return null;
    const counts: Record<string, number> = {};
    for (const e of entries) {
      counts[e.item] = (counts[e.item] || 0) + 1;
    }
    return Object.entries(counts).map(([k, v]) => `${k} ${v}`);
  }, [entries]);

  const checkStatus = useCallback(async () => {
    if (!wcPath.trim()) return;
    setLoading(true);
    await new Promise<void>((r) => setTimeout(r, 0));
    onSelectionChange([]);
    try {
      const result = await svnStatus(wcPath.trim());
      setEntries(result);
      onOutput("success", result.length === 0 ? t("status.empty") : t("status.selectedCount", { count: result.length }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      onOutput("error", t("status.statusFailed", { msg }));
      setEntries(null);
    } finally {
      setLoading(false);
    }
  }, [wcPath, svnStatus, onOutput, onSelectionChange, t]);

  const handleBrowse = useCallback(async () => {
    const p = await onPickDirectory();
    if (p) setWcPath(p);
  }, [onPickDirectory]);

  const handleEntryClick = useCallback((e: React.MouseEvent, entryPath: string) => {
    const fullPath = wcPath.trim().replace(/\/$/, "") + "/" + entryPath;
    if (e.ctrlKey || e.metaKey) {
      // Toggle multi-select
      const idx = selectedPaths.indexOf(fullPath);
      if (idx >= 0) {
        onSelectionChange(selectedPaths.filter((_, i) => i !== idx));
      } else {
        onSelectionChange([...selectedPaths, fullPath]);
      }
    } else {
      // Single-select
      if (selectedPaths.length === 1 && selectedPaths[0] === fullPath) {
        onSelectionChange([]);
      } else {
        onSelectionChange([fullPath]);
      }
    }
  }, [wcPath, selectedPaths, onSelectionChange]);

  return (
    <div className="main">
      <div className="field">
        <label>{t("status.wcPath")}</label>
        <div className="file-input-row">
          <input
            value={wcPath}
            onChange={(e) => setWcPath(e.target.value)}
            placeholder={t("status.wcPlaceholder")}
          />
          <button className="btn" onClick={handleBrowse}>
            <Folder size={14} /> {t("common.browse")}
          </button>
        </div>
      </div>

      <div className="status-actions">
        <button className="btn btn-primary" onClick={checkStatus} disabled={loading || !wcPath.trim()}>
          {loading ? <span className="spinner" /> : <RefreshCw size={14} />}
          {loading ? t("status.checking") : t("status.checkStatus")}
        </button>
      </div>

      {entries && summary && summary.length > 0 && (
        <div className="status-summary">
          {summary.map((s) => (
            <span key={s} className="status-summary-item" style={{ borderLeftColor: statusColor(s.split(" ")[0]) }}>
              {s}
            </span>
          ))}
        </div>
      )}

      {selectedPaths.length > 0 && (
        <div className="status-selection-info">
          {t("status.selectedCount", { count: selectedPaths.length })}
        </div>
      )}

      {entries && entries.length === 0 && (
        <div className="tree-empty">✓ {t("status.clean")}</div>
      )}

      {entries && entries.length > 0 && (
        <div className="status-list">
          {entries.map((entry, i) => {
            const fullPath = wcPath.trim().replace(/\/$/, "") + "/" + entry.path;
            const isSelected = selectedPaths.includes(fullPath);
            return (
              <div
                key={`${entry.path}-${i}`}
                className={`status-entry${isSelected ? " status-entry-selected" : ""}`}
                onClick={(e) => handleEntryClick(e, entry.path)}
              >
                <span className="status-badge" style={{ backgroundColor: statusColor(entry.item) }}>
                  {statusLabel(entry.item)}
                </span>
                <span className="status-path">{entry.path}</span>
                {entry.revision && <span className="status-revision">r{entry.revision}</span>}
                {entry.author && <span className="status-author">{entry.author}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
