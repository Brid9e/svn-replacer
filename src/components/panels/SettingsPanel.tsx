import { useState } from "react";
import { Sun, Moon, ArrowLeft, PlugZap } from "lucide-react";

export function SettingsPanel({
  theme,
  onThemeChange,
  onClose,
  onTestConnection,
}: {
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
  onClose: () => void;
  onTestConnection?: () => Promise<void>;
}) {
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    try { await onTestConnection?.(); } finally { setTesting(false); }
  };

  return (
    <div className="main">
      <div className="settings-section" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <button className="btn-icon" onClick={onClose} title="返回"><ArrowLeft size={16} /></button>
        <label style={{ fontSize: 14, textTransform: "none", color: "var(--text)", fontWeight: 600 }}>设置</label>
      </div>
      <div className="settings-section">
        <label>主题</label>
        <div className="theme-toggle">
          <button
            className={`theme-opt${theme === "light" ? " active" : ""}`}
            onClick={() => onThemeChange("light")}
          >
            <Sun size={14} /> 亮色
          </button>
          <button
            className={`theme-opt${theme === "dark" ? " active" : ""}`}
            onClick={() => onThemeChange("dark")}
          >
            <Moon size={14} /> 暗色
          </button>
        </div>
      </div>
      <div className="settings-section">
        <label>连接</label>
        <button className="btn" onClick={handleTest} disabled={testing}>
          {testing ? <><span className="spinner" /> 测试中...</> : <><PlugZap size={14} /> 测试连接</>}
        </button>
      </div>
    </div>
  );
}
