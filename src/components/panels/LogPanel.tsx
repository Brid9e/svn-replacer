import { useTranslation } from "react-i18next";
import type { SvnLogEntry } from "../../types";

function fmtDate(d: string) {
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export function LogPanel({
  selectedUrl: _selectedUrl,
  logEntries,
  loadingLog,
}: {
  selectedUrl: string | null;
  logEntries: SvnLogEntry[] | null;
  loadingLog: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="main log-view">
      {loadingLog ? (
        <div style={{ textAlign: "center", padding: 24 }}><span className="spinner" /></div>
      ) : logEntries === null ? (
        <div className="log-empty">{t("log.noSelection")}</div>
      ) : logEntries.length === 0 ? (
        <div className="log-empty">{t("log.empty")}</div>
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
