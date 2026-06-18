export interface ToolbarAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  disabled?: boolean;
}

export function Toolbar({
  actions,
  onAction,
}: {
  actions: ToolbarAction[];
  onAction: (action: string) => void;
}) {
  return (
    <div className="toolbar">
      {actions.map(({ id, label, icon: Icon, disabled }) => (
        <button key={id} className="btn btn-sm" disabled={disabled} onClick={() => onAction(id)}>
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );
}
