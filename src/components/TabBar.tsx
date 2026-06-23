import { useTranslation } from "react-i18next";
import { LayoutList, History, GitCommitHorizontal, Code2, ArrowUpToLine } from "lucide-react";

export function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const { t } = useTranslation();
  const tabs = [
    { id: "status", label: t("tab.status"), icon: LayoutList },
    { id: "log", label: t("tab.log"), icon: History },
    { id: "replace", label: t("tab.replace"), icon: ArrowUpToLine },
    { id: "commit", label: t("tab.commit"), icon: GitCommitHorizontal },
    { id: "diff", label: t("tab.diff"), icon: Code2 },
  ] as const;
  return (
    <div className="tab-bar">
      {tabs.map(({ id, label, icon: Icon }) => (
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
