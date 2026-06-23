import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { RefreshCw, Download, FilePlus, Trash2, RotateCcw, Wrench, ArrowDownToLine } from "lucide-react";
import type { ActionPayload } from "../types/actions";
import type { ToolbarAction } from "../components/Toolbar";
import type { ConfirmDialogState } from "./useSvnOperations";
import type { Workspace } from "../types";

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export interface SvnActionsCallbacks {
  setOutput: (msg: { type: string; text: string } | null) => void;
  setSelectedUrl: (url: string) => void;
  setSelectedName: (name: string) => void;
  loadTree: () => Promise<string | undefined>;
  loadLocalTree: (path: string) => Promise<string | undefined>;
  localMode: boolean;
  localPath?: string;
  setDiffContent: (content: string | null) => void;
  loadDiff: (url: string) => Promise<void>;
  loadLog: (url: string) => Promise<void>;
  setActiveTab: (tab: string) => void;
  svnCheckout: (url: string, dest: string) => Promise<string>;
  svnDelete: (path: string) => Promise<string>;
  svnRemoteDelete: (url: string, msg: string) => Promise<string>;
  svnInfo: (url: string) => Promise<string>;
  svnBlame: (url: string) => Promise<string>;
  svnExport: (url: string, dest: string) => Promise<string>;
  svnUpdate: (path: string, kind: string) => Promise<string>;
  svnAdd: (path: string) => Promise<string>;
  svnRevert: (path: string) => Promise<string>;
  svnCleanup: (path: string) => Promise<string>;
  setRenameDialog: (d: { url: string; name: string } | null) => void;
  setRenameNewName: (v: string) => void;
  setRenameMsg: (v: string) => void;
  setMkdirParentUrl: (v: string | null) => void;
  setMkdirName: (v: string) => void;
  setMkdirMsg: (v: string) => void;
  setCopyDialog: (d: { sourceUrl: string; name: string } | null) => void;
  setCopyDestUrl: (v: string) => void;
  setCopyMsg: (v: string) => void;
  setMoveDialog: (d: { sourceUrl: string; name: string } | null) => void;
  setMoveDestUrl: (v: string) => void;
  setMoveMsg: (v: string) => void;
  setConfirmDialog: (d: ConfirmDialogState | null) => void;
  setCheckingOut: (v: boolean) => void;
  setUpdating: (v: boolean) => void;
  setAdding: (v: boolean) => void;
  setDeleting: (v: boolean) => void;
  setReverting: (v: boolean) => void;
  setCleaning: (v: boolean) => void;
  statusSelectedPaths: string[];
  setStatusSelectedPaths: (v: string[]) => void;
  activeWorkspace?: Workspace;
  setWsField: (field: string, value: string) => void;
  pickFile: () => Promise<string | null>;
  setOverlay: (v: "settings" | "workspace" | null) => void;
  activeTab: string;
  selectedUrl: string | null;
  checkingOut: boolean;
  updating: boolean;
  adding: boolean;
  deleting: boolean;
  reverting: boolean;
  cleaning: boolean;
  loadingLog: boolean;
  loadingDiff: boolean;
}

export function useSvnActions(cbs: SvnActionsCallbacks) {
  const { t } = useTranslation();

  const dispatch = useCallback(async (payload: ActionPayload) => {
    const { action, source } = payload;
    const url = source === "context" ? payload.url : "";
    const name = source === "context" ? payload.name : "";

    switch (action) {
      case "copy-url":
        if (source !== "context") break;
        navigator.clipboard.writeText(url).catch(() => {});
        cbs.setOutput({ type: "success", text: t("action.copied", { text: url }) });
        break;

      case "copy-name":
        if (source !== "context") break;
        navigator.clipboard.writeText(name).catch(() => {});
        cbs.setOutput({ type: "success", text: t("action.copiedName", { text: name }) });
        break;

      case "view-log":
        if (source !== "context") break;
        cbs.setSelectedUrl(url);
        cbs.setSelectedName(name);
        cbs.setActiveTab("log");
        break;

      case "diff":
        if (source !== "context") break;
        cbs.setDiffContent(null);
        cbs.setActiveTab("diff");
        cbs.loadDiff(url);
        break;

      case "rename":
        if (source !== "context") break;
        cbs.setRenameDialog({ url, name });
        cbs.setRenameNewName(name);
        cbs.setRenameMsg("");
        break;

      case "mkdir":
        if (source !== "context") break;
        cbs.setMkdirParentUrl(url);
        cbs.setMkdirName("");
        cbs.setMkdirMsg("");
        break;

      case "info": {
        if (source !== "context") break;
        cbs.setOutput({ type: "success", text: t("action.fetchingInfo", { name }) });
        try {
          const result = await cbs.svnInfo(url);
          cbs.setOutput({ type: "success", text: result });
        } catch (e: unknown) {
          cbs.setOutput({ type: "error", text: t("action.infoFailed", { msg: e instanceof Error ? e.message : String(e) }) });
        }
        break;
      }

      case "blame": {
        if (source !== "context") break;
        cbs.setOutput({ type: "success", text: t("action.fetchingBlame", { name }) });
        try {
          const result = await cbs.svnBlame(url);
          cbs.setOutput({ type: "success", text: result });
        } catch (e: unknown) {
          cbs.setOutput({ type: "error", text: t("action.blameFailed", { msg: e instanceof Error ? e.message : String(e) }) });
        }
        break;
      }

      case "export": {
        if (source !== "context") break;
        const dest = await open({ multiple: false, directory: true });
        if (!dest) break;
        cbs.setOutput({ type: "success", text: t("action.exportStart", { name, dest }) });
        try {
          const result = await cbs.svnExport(url, dest);
          cbs.setOutput({ type: "success", text: result });
        } catch (e: unknown) {
          cbs.setOutput({ type: "error", text: t("action.exportFailed", { msg: e instanceof Error ? e.message : String(e) }) });
        }
        break;
      }

      case "copy-to":
        if (source !== "context") break;
        cbs.setCopyDialog({ sourceUrl: url, name });
        cbs.setCopyDestUrl(url.replace(/\/?[^/]*$/, "/") + "copy_of_" + name);
        cbs.setCopyMsg("");
        break;

      case "move-to":
        if (source !== "context") break;
        cbs.setMoveDialog({ sourceUrl: url, name });
        cbs.setMoveDestUrl(url.replace(/\/?[^/]*$/, "/") + name);
        cbs.setMoveMsg("");
        break;

      case "delete": {
        if (source === "context") {
          if (cbs.localMode) {
            cbs.setConfirmDialog({
              message: t("action.deleteConfirm", { name }),
              onConfirm: () => {
                cbs.setConfirmDialog(null);
                cbs.svnDelete(url)
                  .then((result) => {
                    cbs.setOutput({ type: "success", text: t("action.deleteSuccess", { result }) });
                    if (cbs.localPath) cbs.loadLocalTree(cbs.localPath);
                  })
                  .catch((e: unknown) => cbs.setOutput({ type: "error", text: t("action.deleteFailed", { msg: e instanceof Error ? e.message : String(e) }) }));
              },
            });
          } else {
            cbs.setConfirmDialog({
              message: t("action.deleteRemoteConfirm", { name }),
              onConfirm: () => {
                cbs.setConfirmDialog(null);
                cbs.setOutput({ type: "success", text: t("action.deleting", { name: url }) });
                cbs.svnRemoteDelete(url, `delete ${name}`)
                  .then(async (result) => {
                    cbs.setOutput({ type: "success", text: t("action.deleteSuccess", { result }) });
                    await cbs.loadTree();
                  })
                  .catch((e: unknown) => cbs.setOutput({ type: "error", text: t("action.deleteFailed", { msg: e instanceof Error ? e.message : String(e) }) }));
              },
            });
          }
        } else {
          const targets = cbs.statusSelectedPaths.length > 0
            ? cbs.statusSelectedPaths
            : await cbs.pickFile().then((f) => (f ? [f] : []));
          if (targets.length === 0) break;
          cbs.setDeleting(true);
          await tick();
          try {
            const results = await Promise.all(targets.map((f) => cbs.svnDelete(f)));
            cbs.setOutput({ type: "success", text: results.join("").trim() || t("action.deletedCount", { count: targets.length }) });
          } catch (e: unknown) {
            cbs.setOutput({ type: "error", text: t("action.deleteFailed", { msg: e instanceof Error ? e.message : String(e) }) });
          } finally {
            cbs.setDeleting(false);
            cbs.setStatusSelectedPaths([]);
          }
        }
        break;
      }

      case "checkout": {
        if (source === "context") {
          const cd = await open({ multiple: false, directory: true });
          if (!cd) break;
          cbs.setOutput({ type: "success", text: t("action.checkoutStart", { name, dest: cd }) });
          try {
            const result = await cbs.svnCheckout(url, cd);
            cbs.setOutput({ type: "success", text: result });
          } catch (e: unknown) {
            cbs.setOutput({ type: "error", text: t("action.checkoutFailed", { msg: e instanceof Error ? e.message : String(e) }) });
          }
        } else {
          if (!cbs.activeWorkspace?.baseUrl?.trim()) {
            cbs.setOutput({ type: "error", text: t("action.noBaseUrl") });
            break;
          }
          const cd = await open({ multiple: false, directory: true });
          if (!cd) break;
          cbs.setCheckingOut(true);
          await tick();
          try {
            const result = await cbs.svnCheckout(cbs.activeWorkspace.baseUrl.trim(), cd);
            cbs.setOutput({ type: "success", text: result });
            cbs.setWsField("sourcePath", cd);
          } catch (e: unknown) {
            cbs.setOutput({ type: "error", text: t("action.checkoutFailed", { msg: e instanceof Error ? e.message : String(e) }) });
          } finally {
            cbs.setCheckingOut(false);
          }
        }
        break;
      }

      case "settings":
        cbs.setOverlay("settings");
        break;

      case "refresh":
        if (!cbs.selectedUrl) break;
        if (cbs.activeTab === "diff") {
          cbs.loadDiff(cbs.selectedUrl);
        } else {
          cbs.loadLog(cbs.selectedUrl);
        }
        break;

      case "update": {
        if (!cbs.activeWorkspace?.sourcePath?.trim()) {
          cbs.setOutput({ type: "error", text: t("action.noSourcePath") });
          break;
        }
        cbs.setUpdating(true);
        await tick();
        try {
          const result = await cbs.svnUpdate(cbs.activeWorkspace.sourcePath.trim(), "working");
          cbs.setOutput({ type: "success", text: result });
        } catch (e: unknown) {
          cbs.setOutput({ type: "error", text: t("action.updateFailed", { msg: e instanceof Error ? e.message : String(e) }) });
        } finally {
          cbs.setUpdating(false);
        }
        break;
      }

      case "add": {
        const targets = cbs.statusSelectedPaths.length > 0
          ? cbs.statusSelectedPaths
          : await cbs.pickFile().then((f) => (f ? [f] : []));
        if (targets.length === 0) break;
        cbs.setAdding(true);
        await tick();
        try {
          const results = await Promise.all(targets.map((f) => cbs.svnAdd(f)));
          cbs.setOutput({ type: "success", text: results.join("").trim() || t("action.addedCount", { count: targets.length }) });
        } catch (e: unknown) {
          cbs.setOutput({ type: "error", text: t("action.addFailed", { msg: e instanceof Error ? e.message : String(e) }) });
        } finally {
          cbs.setAdding(false);
          cbs.setStatusSelectedPaths([]);
        }
        break;
      }

      case "revert": {
        const targetsR = cbs.statusSelectedPaths.length > 0 ? cbs.statusSelectedPaths : [];
        if (targetsR.length === 0) {
          cbs.setOutput({ type: "error", text: t("action.revertNoSelection") });
          break;
        }
        cbs.setReverting(true);
        await tick();
        try {
          const results = await Promise.all(targetsR.map((f) => cbs.svnRevert(f)));
          cbs.setOutput({ type: "success", text: results.join("").trim() || t("action.revertedCount", { count: targetsR.length }) });
        } catch (e: unknown) {
          cbs.setOutput({ type: "error", text: t("action.revertFailed", { msg: e instanceof Error ? e.message : String(e) }) });
        } finally {
          cbs.setReverting(false);
          cbs.setStatusSelectedPaths([]);
        }
        break;
      }

      case "cleanup": {
        if (!cbs.activeWorkspace?.sourcePath?.trim()) {
          cbs.setOutput({ type: "error", text: t("action.cleanupNoPath") });
          break;
        }
        cbs.setCleaning(true);
        await tick();
        try {
          const result = await cbs.svnCleanup(cbs.activeWorkspace.sourcePath.trim());
          cbs.setOutput({ type: "success", text: result || t("action.cleanupDone") });
        } catch (e: unknown) {
          cbs.setOutput({ type: "error", text: t("action.cleanupFailed", { msg: e instanceof Error ? e.message : String(e) }) });
        } finally {
          cbs.setCleaning(false);
        }
        break;
      }

      default:
        cbs.setOutput({ type: "error", text: t("action.notImplemented", { action }) });
    }
  }, [cbs, t]);

  const toolbarActions = useMemo((): ToolbarAction[] => {
    switch (cbs.activeTab) {
      case "log":
        return [{ id: "refresh", label: t("toolbar.refresh"), icon: RefreshCw, disabled: !cbs.selectedUrl || cbs.loadingLog }];
      case "diff":
        return [{ id: "refresh", label: t("toolbar.refresh"), icon: RefreshCw, disabled: !cbs.selectedUrl || cbs.loadingDiff }];
      case "status":
        return [
          { id: "checkout", label: t("toolbar.checkout"), icon: ArrowDownToLine, disabled: cbs.checkingOut || !cbs.activeWorkspace?.baseUrl },
          { id: "update", label: t("toolbar.update"), icon: Download, disabled: cbs.updating || !cbs.activeWorkspace?.sourcePath },
          { id: "add", label: t("toolbar.add"), icon: FilePlus, disabled: cbs.adding || !cbs.activeWorkspace?.sourcePath },
          { id: "delete", label: t("toolbar.delete"), icon: Trash2, disabled: cbs.deleting || !cbs.activeWorkspace?.sourcePath },
          { id: "revert", label: t("toolbar.revert"), icon: RotateCcw, disabled: cbs.reverting || !cbs.activeWorkspace?.sourcePath },
          { id: "cleanup", label: t("toolbar.cleanup"), icon: Wrench, disabled: cbs.cleaning || !cbs.activeWorkspace?.sourcePath },
        ];
      default:
        return [];
    }
  }, [
    cbs.activeTab, cbs.selectedUrl, cbs.loadingLog, cbs.loadingDiff,
    cbs.checkingOut, cbs.updating, cbs.adding, cbs.deleting, cbs.reverting, cbs.cleaning,
    cbs.activeWorkspace?.sourcePath, cbs.activeWorkspace?.baseUrl, t,
  ]);

  return { dispatch, toolbarActions };
}
