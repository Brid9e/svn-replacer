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
  return (
    <div className="main">
      <div className="settings-section" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <button className="btn-icon" onClick={onCancel} title="返回"><ArrowLeft size={16} /></button>
        <label style={{ fontSize: 14, textTransform: "none", color: "var(--text)", fontWeight: 600 }}>{editWsId ? "编辑工作空间" : "新建工作空间"}</label>
      </div>
      <div className="settings-section">
        <label>名称</label>
        <input
          value={wsForm.name}
          onChange={(e) => onFormChange("name", e.target.value)}
          placeholder="工作空间名称（可选）"
        />
      </div>
      <div className="settings-section">
        <label>SVN 地址</label>
        <input
          value={wsForm.baseUrl}
          onChange={(e) => onFormChange("baseUrl", e.target.value)}
          placeholder="https://svn.example.com/svn/project/"
        />
      </div>
      <div className="settings-section">
        <label>用户名</label>
        <input
          value={wsForm.username}
          onChange={(e) => onFormChange("username", e.target.value)}
          placeholder="svn 用户名（可选）"
        />
      </div>
      <div className="settings-section">
        <label>密码</label>
        <input
          type="password"
          value={wsForm.password}
          onChange={(e) => onFormChange("password", e.target.value)}
          placeholder="svn 密码（可选）"
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={onCancel}>取消</button>
        <button className="btn btn-primary" onClick={onSave}>保存</button>
      </div>
    </div>
  );
}
