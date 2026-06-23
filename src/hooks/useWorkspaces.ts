import { useState, useEffect, useCallback } from "react";
import i18n from "../i18n";
import type { Workspace } from "../types";

const DEFAULT_COMMIT_MSG = "update shj-fxc";

function migrateLegacy(): Workspace[] {
  const oldUrl = (localStorage.getItem("baseUrl") || "").trim();
  const oldSource = localStorage.getItem("sourcePath") || "";
  const oldCommitMsg = localStorage.getItem("commitMsg") || DEFAULT_COMMIT_MSG;
  const oldFilter = localStorage.getItem("filterExt") || "";
  const oldSort = localStorage.getItem("sortByDate") === "true";
  let oldUsername = "";
  let oldPassword = "";
  try {
    const creds = JSON.parse(localStorage.getItem("credentials") || "{}");
    const entry = Object.entries(creds)[0];
    if (entry) {
      oldUsername = (entry[1] as { username: string }).username || "";
      oldPassword = (entry[1] as { password: string }).password || "";
    }
  } catch { /* ignore */ }
  return [{
    id: "default",
    name: i18n.t("workspace.defaultName"),
    baseUrl: (() => { try { return decodeURI(oldUrl); } catch { return oldUrl; } })(),
    username: oldUsername,
    password: oldPassword,
    sourcePath: oldSource,
    commitMsg: oldCommitMsg,
    filterExt: oldFilter,
    sortByDate: oldSort,
  }];
}

function loadWorkspaces(): Workspace[] {
  try {
    const saved = JSON.parse(localStorage.getItem("workspaces") || "[]");
    if (saved.length > 0) return saved;
  } catch { /* ignore */ }
  return migrateLegacy();
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(loadWorkspaces);
  const [activeId, setActiveId] = useState(() => {
    return localStorage.getItem("activeWorkspaceId") || "default";
  });

  const activeWorkspace = workspaces.find((w) => w.id === activeId) || workspaces[0];

  // Persistence
  useEffect(() => {
    localStorage.setItem("workspaces", JSON.stringify(workspaces));
  }, [workspaces]);

  useEffect(() => {
    localStorage.setItem("activeWorkspaceId", activeId);
  }, [activeId]);

  const setWsField = useCallback(<K extends keyof Workspace>(field: K, value: Workspace[K]) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === activeId ? { ...w, [field]: value } : w)));
  }, [activeId]);

  const switchWorkspace = useCallback((id: string) => {
    if (id === activeId) return;
    setActiveId(id);
  }, [activeId]);

  const deleteWorkspace = useCallback((id: string) => {
    if (workspaces.length <= 1) return;
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    if (activeId === id) {
      const remaining = workspaces.filter((w) => w.id !== id);
      setActiveId(remaining[0]?.id || "default");
    }
  }, [workspaces, activeId]);

  return {
    workspaces,
    activeId,
    activeWorkspace,
    setWorkspaces,
    setActiveId,
    setWsField,
    switchWorkspace,
    deleteWorkspace,
  };
}
