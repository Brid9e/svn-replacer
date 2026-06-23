import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Folder, ArrowUpToLine } from "lucide-react";

export function ReplacePanel({
  selectedUrl,
  replacing,
  onReplace,
  onPickSource,
}: {
  selectedUrl: string | null;
  replacing: boolean;
  onReplace: (source: string, targetUrl: string, commitMsg: string) => void;
  onPickSource: () => Promise<string | null>;
}) {
  const { t } = useTranslation();
  const [sourcePath, setSourcePath] = useState("");
  const [commitMsg, setCommitMsg] = useState("");

  const handlePickSource = async () => {
    const path = await onPickSource();
    if (path) setSourcePath(path);
  };

  const targetUrl = selectedUrl || "";

  return (
    <div className="main">
      <div className="field">
        <label>{t("replace.pickSource")}</label>
        <div className="file-input-row">
          <input
            value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
            placeholder={t("replace.sourcePlaceholder")}
          />
          <button className="btn" onClick={handlePickSource}>
            <Folder size={14} /> {t("common.browse")}
          </button>
        </div>
      </div>

      <div className="field">
        <label>{t("replace.targetUrl")}</label>
        <div className={`target-display${!targetUrl ? " target-placeholder" : ""}`}>{targetUrl || t("replace.noSelection")}</div>
      </div>

      <div className="field">
        <label>{t("replace.commitMsg")}</label>
        <input
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder={t("replace.msgPlaceholder")}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={() => onReplace(sourcePath, targetUrl, commitMsg)}
        disabled={replacing || !sourcePath.trim() || !targetUrl.trim() || !commitMsg.trim()}
      >
        {replacing ? <><span className="spinner" /> {t("replace.replacing")}</> : <><ArrowUpToLine size={14} /> {t("replace.replace")}</>}
      </button>
    </div>
  );
}
