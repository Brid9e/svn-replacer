import { RefreshCw } from "lucide-react";

export function DiffPanel({
  selectedUrl,
  selectedName,
  diffContent,
  loadingDiff,
  onRefresh,
}: {
  selectedUrl: string | null;
  selectedName: string | null;
  diffContent: string | null;
  loadingDiff: boolean;
  onRefresh?: () => void;
}) {
  const isEmptyDiff = diffContent === "" || diffContent === "(empty diff)";

  return (
    <div className="main diff-panel">
      <div className="diff-header">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Diff Target</label>
          <div className="target-display">
            {selectedName ? (
              <span className="target-path">{selectedUrl}</span>
            ) : (
              <span className="target-placeholder">在左侧树中选择文件</span>
            )}
          </div>
        </div>
        {selectedUrl && (
          <button className="btn" onClick={onRefresh} disabled={loadingDiff}>
            {loadingDiff ? <span className="spinner" /> : <RefreshCw size={14} />}
            {loadingDiff ? "加载中..." : "Refresh"}
          </button>
        )}
      </div>

      {!selectedUrl ? (
        <div className="tree-empty">请从左侧树中选择一个文件查看差异</div>
      ) : loadingDiff && !diffContent ? (
        <div className="tree-empty"><span className="spinner" /> 加载差异中...</div>
      ) : isEmptyDiff ? (
        <div className="tree-empty">✓ 该文件在最新提交中无变更</div>
      ) : diffContent?.startsWith("Error:") ? (
        <div className="diff-error">{diffContent}</div>
      ) : diffContent ? (
        <pre className="diff-content">{diffContent}</pre>
      ) : null}
    </div>
  );
}
