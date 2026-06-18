import { LayoutList, History, GitCommitHorizontal, Code2 } from "lucide-react";

const TABS = [
  { id: "status", label: "Status", icon: LayoutList },
  { id: "log", label: "Log", icon: History },
  { id: "commit", label: "Commit", icon: GitCommitHorizontal },
  { id: "diff", label: "Diff", icon: Code2 },
] as const;

export function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <div className="tab-bar">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`tab-item${activeTab === id ? " tab-active" : ""}`}
          onClick={() => onTabChange(id)}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
