import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { Workspace } from "../types";

export function WorkspaceBar({
  workspaces,
  activeId,
  onSwitch,
  onAdd,
  onEdit,
  onDelete,
}: {
  workspaces: Workspace[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; wsId: string } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctxMenu]);

  return (
    <>
      <div className="workspace-bar">
        {workspaces.map((w) => (
          <div
            key={w.id}
            className={`ws-bar-item${w.id === activeId ? " ws-bar-active" : ""}`}
            onClick={() => onSwitch(w.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCtxMenu({ x: e.clientX, y: e.clientY, wsId: w.id });
            }}
            title={w.name}
          >
            {w.name.charAt(0)}
          </div>
        ))}
        <div className="ws-bar-spacer" />
        <div className="ws-bar-item ws-bar-add" onClick={onAdd} title={t("workspace.add")}>
          <Plus size={16} />
        </div>
      </div>

      {ctxMenu && (
        <div ref={ctxRef} className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          <div
            className="ctx-menu-item"
            onMouseDown={() => {
              onEdit(ctxMenu.wsId);
              setCtxMenu(null);
            }}
          >
            {t("workspace.edit")}
          </div>
          {workspaces.length > 1 && (
            <>
              <div className="ctx-divider" />
              <div
                className="ctx-menu-item ctx-menu-danger"
                onMouseDown={() => {
                  onDelete(ctxMenu.wsId);
                  setCtxMenu(null);
                }}
              >
                {t("workspace.delete")}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
