import { Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Workspace } from "../../types";

export function CommitPanel({
  workspace,
  committing,
  onCommit,
  onPickSource,
  onSetWsField,
}: {
  workspace: Workspace | undefined;
  committing: boolean;
  onCommit: () => void;
  onPickSource: () => void;
  onSetWsField: <K extends keyof Workspace>(field: K, value: Workspace[K]) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="main">
      <div className="field">
        <label>{t("workspace.sourcePath")}</label>
        <div className="file-input-row">
          <input
            value={workspace?.sourcePath || ""}
            onChange={(e) => onSetWsField("sourcePath", e.target.value)}
            placeholder={t("commit.pickSourceDir")}
          />
          <button className="btn" onClick={onPickSource}>
            <Folder size={14} /> {t("common.browse")}
          </button>
        </div>
      </div>

      <div className="field">
        <label>{t("workspace.commitMsg")}</label>
        <input
          value={workspace?.commitMsg || ""}
          onChange={(e) => onSetWsField("commitMsg", e.target.value)}
          placeholder={t("commit.msgPlaceholder")}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={onCommit}
        disabled={committing || !workspace?.sourcePath?.trim() || !workspace?.commitMsg?.trim()}
      >
        {committing ? <><span className="spinner" /> {t("commit.committing")}</> : t("commit.commit")}
      </button>
    </div>
  );
}
