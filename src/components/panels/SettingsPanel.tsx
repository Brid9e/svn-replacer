import { useTranslation } from "react-i18next";
import { Sun, Moon, ArrowLeft } from "lucide-react";
import i18n from "../../i18n";

const LANGUAGES = [
  { code: "zh-CN", label: "settings.zhCN" },
  { code: "en", label: "settings.en" },
  { code: "zh-TW", label: "settings.zhTW" },
  { code: "ja", label: "settings.ja" },
  { code: "ko", label: "settings.ko" },
] as const;

export function SettingsPanel({
  theme,
  onThemeChange,
  onClose,
}: {
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="main">
      <div className="settings-section" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <button className="btn-icon" onClick={onClose} title={t("common.back") || "Back"}><ArrowLeft size={16} /></button>
        <label style={{ fontSize: 14, textTransform: "none", color: "var(--text)", fontWeight: 600 }}>{t("settings.title")}</label>
      </div>
      <div className="settings-section">
        <label>{t("settings.language")}</label>
        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{t(l.label)}</option>
          ))}
        </select>
      </div>
      <div className="settings-section">
        <label>{t("settings.theme")}</label>
        <div className="theme-toggle">
          <button
            className={`theme-opt${theme === "light" ? " active" : ""}`}
            onClick={() => onThemeChange("light")}
          >
            <Sun size={14} /> {t("settings.light")}
          </button>
          <button
            className={`theme-opt${theme === "dark" ? " active" : ""}`}
            onClick={() => onThemeChange("dark")}
          >
            <Moon size={14} /> {t("settings.dark")}
          </button>
        </div>
      </div>
    </div>
  );
}
