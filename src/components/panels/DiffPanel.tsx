import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const isEmptyDiff = diffContent === "" || diffContent === "(empty diff)";

  return (
    <div className="main diff-panel">
      <div className="diff-header">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{t("diff.title")}</label>
          <div className="target-display">
            {selectedName ? (
              <span className="target-path">{selectedUrl}</span>
            ) : (
              <span className="target-placeholder">{t("diff.noSelection")}</span>
            )}
          </div>
        </div>
        {selectedUrl && (
          <button className="btn" onClick={onRefresh} disabled={loadingDiff}>
            {loadingDiff ? <span className="spinner" /> : <RefreshCw size={14} />}
            {loadingDiff ? t("common.loading") : t("common.refresh")}
          </button>
        )}
      </div>

      {!selectedUrl ? (
        <div className="tree-empty">{t("diff.noSelection")}</div>
      ) : loadingDiff && !diffContent ? (
        <div className="tree-empty"><span className="spinner" /> {t("diff.loading")}</div>
      ) : isEmptyDiff ? (
        <div className="tree-empty">{t("diff.empty")}</div>
      ) : diffContent?.startsWith("Error:") ? (
        <div className="diff-error">{diffContent}</div>
      ) : diffContent ? (
        <pre className="diff-content">{diffContent}</pre>
      ) : null}
    </div>
  );
}
