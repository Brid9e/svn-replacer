import { useState, useEffect, useRef } from "react";
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
        <div className="ws-bar-item ws-bar-add" onClick={onAdd} title="新建工作空间">
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
            编辑工作空间
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
                删除工作空间
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
