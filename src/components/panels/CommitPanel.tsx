import { Folder } from "lucide-react";
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
  return (
    <div className="main">
      <div className="field">
        <label>Working Copy</label>
        <div className="file-input-row">
          <input
            value={workspace?.sourcePath || ""}
            onChange={(e) => onSetWsField("sourcePath", e.target.value)}
            placeholder="选择 SVN 工作副本目录"
          />
          <button className="btn" onClick={onPickSource}>
            <Folder size={14} /> Browse
          </button>
        </div>
      </div>

      <div className="field">
        <label>Commit Message</label>
        <input
          value={workspace?.commitMsg || ""}
          onChange={(e) => onSetWsField("commitMsg", e.target.value)}
          placeholder="输入提交信息"
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={onCommit}
        disabled={committing || !workspace?.sourcePath?.trim() || !workspace?.commitMsg?.trim()}
      >
        {committing ? <span className="spinner" /> : "Commit"}
      </button>
    </div>
  );
}
