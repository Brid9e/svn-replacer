import type { SvnLogEntry } from "../../types";

function fmtDate(d: string) {
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export function LogPanel({
  selectedUrl,
  logEntries,
  loadingLog,
}: {
  selectedUrl: string | null;
  logEntries: SvnLogEntry[] | null;
  loadingLog: boolean;
}) {
  return (
    <div className="main log-view">
      <div className="field">
        <label>History</label>
        <div className="target-display">
          <span className="target-path">{selectedUrl}</span>
        </div>
      </div>
      {loadingLog ? (
        <div style={{ textAlign: "center", padding: 24 }}><span className="spinner" /></div>
      ) : logEntries === null ? (
        <div className="log-empty">请选择目标后查看</div>
      ) : logEntries.length === 0 ? (
        <div className="log-empty">暂无提交记录</div>
      ) : (
        <div className="timeline-container">
          {logEntries.map((entry, i) => (
            <div key={i} className="timeline-item">
              <div className="timeline-item-meta">
                <span className="timeline-item-author">{entry.author}</span>
                <span>{fmtDate(entry.date)}</span>
              </div>
              <div className="timeline-item-msg">{entry.message || <span className="log-empty-msg">(no message)</span>}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
