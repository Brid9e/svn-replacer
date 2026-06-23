import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

export function WorkspacePanel({
  editWsId,
  wsForm,
  onFormChange,
  onSave,
  onCancel,
}: {
  editWsId: string | null;
  wsForm: { name: string; baseUrl: string; username: string; password: string };
  onFormChange: (field: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="main">
      <div className="settings-section" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <button className="btn-icon" onClick={onCancel} title={t("common.cancel")}><ArrowLeft size={16} /></button>
        <label style={{ fontSize: 14, textTransform: "none", color: "var(--text)", fontWeight: 600 }}>{editWsId ? t("workspace.edit") : t("workspace.add")}</label>
      </div>
      <div className="settings-section">
        <label>{t("workspace.name")}</label>
        <input
          value={wsForm.name}
          onChange={(e) => onFormChange("name", e.target.value)}
          placeholder={t("workspace.namePlaceholder")}
        />
      </div>
      <div className="settings-section">
        <label>{t("workspace.svnUrl")}</label>
        <input
          value={wsForm.baseUrl}
          onChange={(e) => onFormChange("baseUrl", e.target.value)}
          placeholder="https://svn.example.com/svn/project/"
        />
      </div>
      <div className="settings-section">
        <label>{t("workspace.username")}</label>
        <input
          value={wsForm.username}
          onChange={(e) => onFormChange("username", e.target.value)}
          placeholder={t("workspace.usernamePlaceholder")}
        />
      </div>
      <div className="settings-section">
        <label>{t("workspace.password")}</label>
        <input
          type="password"
          value={wsForm.password}
          onChange={(e) => onFormChange("password", e.target.value)}
          placeholder={t("workspace.passwordPlaceholder")}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={onCancel}>{t("common.cancel")}</button>
        <button className="btn btn-primary" onClick={onSave}>{t("common.save")}</button>
      </div>
    </div>
  );
}
