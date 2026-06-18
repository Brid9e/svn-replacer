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
        <label>Source（本地文件或目录）</label>
        <div className="file-input-row">
          <input
            value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
            placeholder="选择或输入本地路径"
          />
          <button className="btn" onClick={handlePickSource}>
            <Folder size={14} /> Browse
          </button>
        </div>
      </div>

      <div className="field">
        <label>Target URL</label>
        <div className={`target-display${!targetUrl ? " target-placeholder" : ""}`}>{targetUrl || "请在左侧树中选择目标"}</div>
      </div>

      <div className="field">
        <label>Commit Message</label>
        <input
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="输入提交信息"
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={() => onReplace(sourcePath, targetUrl, commitMsg)}
        disabled={replacing || !sourcePath.trim() || !targetUrl.trim() || !commitMsg.trim()}
      >
        {replacing ? <span className="spinner" /> : <><ArrowUpToLine size={14} /> Replace & Commit</>}
      </button>
    </div>
  );
}
