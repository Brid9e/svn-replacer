import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

export interface SvnOperationCallbacks {
  svnDelete: (path: string) => Promise<string>;
  svnRemoteDelete: (url: string, msg: string) => Promise<string>;
  svnRename: (url: string, newName: string, msg: string) => Promise<string>;
  svnMkdir: (url: string, msg: string) => Promise<string>;
  svnRemoteCopy: (src: string, dst: string, msg: string) => Promise<string>;
  svnRemoteMove: (src: string, dst: string, msg: string) => Promise<string>;
  loadTree: () => Promise<string | undefined>;
  setOutput: (msg: { type: string; text: string } | null) => void;
}

export interface ConfirmDialogState {
  message: string;
  onConfirm: () => void;
}

export interface CopyMoveDialogState {
  sourceUrl: string;
  name: string;
}

export function useSvnOperations(cbs: SvnOperationCallbacks) {
  const { t } = useTranslation();

  // Busy flags
  const [committing, setCommitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  // Rename dialog
  const [renameDialog, setRenameDialog] = useState<{ url: string; name: string } | null>(null);
  const [renameNewName, setRenameNewName] = useState("");
  const [renameMsg, setRenameMsg] = useState("");

  // Mkdir dialog
  const [mkdirParentUrl, setMkdirParentUrl] = useState<string | null>(null);
  const [mkdirName, setMkdirName] = useState("");
  const [mkdirMsg, setMkdirMsg] = useState("");

  // Copy dialog
  const [copyDialog, setCopyDialog] = useState<CopyMoveDialogState | null>(null);
  const [copyDestUrl, setCopyDestUrl] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  // Move dialog
  const [moveDialog, setMoveDialog] = useState<CopyMoveDialogState | null>(null);
  const [moveDestUrl, setMoveDestUrl] = useState("");
  const [moveMsg, setMoveMsg] = useState("");

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // Status selection
  const [statusSelectedPaths, setStatusSelectedPaths] = useState<string[]>([]);

  // Handlers

  const handleRename = useCallback(async () => {
    if (!renameDialog || !renameNewName.trim()) return;
    const dialog = renameDialog;
    setRenameDialog(null);
    try {
      const result = await cbs.svnRename(dialog.url, renameNewName.trim(), renameMsg.trim() || t("dialog.renameCommitMsg", { name: dialog.name, newName: renameNewName.trim() }));
      cbs.setOutput({ type: "success", text: result });
      await cbs.loadTree();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      cbs.setOutput({ type: "error", text: t("action.renameFailed", { msg }) });
    }
  }, [renameDialog, renameNewName, renameMsg, cbs, t]);

  const handleMkdir = useCallback(async () => {
    if (!mkdirParentUrl || !mkdirName.trim()) return;
    const parent = mkdirParentUrl;
    setMkdirParentUrl(null);
    try {
      const dirUrl = `${parent.replace(/\/?$/, "/")}${mkdirName.trim()}`;
      const result = await cbs.svnMkdir(dirUrl, mkdirMsg.trim() || t("dialog.mkdirCommitMsg", { name: mkdirName.trim() }));
      cbs.setOutput({ type: "success", text: t("action.mkdirSuccess", { result }) });
      await cbs.loadTree();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      cbs.setOutput({ type: "error", text: t("action.mkdirFailed", { msg }) });
    }
  }, [mkdirParentUrl, mkdirName, mkdirMsg, cbs, t]);

  const handleCopy = useCallback(async () => {
    if (!copyDialog || !copyDestUrl.trim()) return;
    const dialog = copyDialog;
    setCopyDialog(null);
    try {
      const result = await cbs.svnRemoteCopy(dialog.sourceUrl, copyDestUrl.trim(), copyMsg.trim() || t("dialog.copyCommitMsg", { name: dialog.name, dest: copyDestUrl.trim() }));
      cbs.setOutput({ type: "success", text: t("action.copySuccess", { result }) });
      await cbs.loadTree();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      cbs.setOutput({ type: "error", text: t("action.copyFailed", { msg }) });
    }
  }, [copyDialog, copyDestUrl, copyMsg, cbs, t]);

  const handleMove = useCallback(async () => {
    if (!moveDialog || !moveDestUrl.trim()) return;
    const dialog = moveDialog;
    setMoveDialog(null);
    try {
      const result = await cbs.svnRemoteMove(dialog.sourceUrl, moveDestUrl.trim(), moveMsg.trim() || t("dialog.moveCommitMsg", { name: dialog.name, dest: moveDestUrl.trim() }));
      cbs.setOutput({ type: "success", text: t("action.moveSuccess", { result }) });
      await cbs.loadTree();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      cbs.setOutput({ type: "error", text: t("action.moveFailed", { msg }) });
    }
  }, [moveDialog, moveDestUrl, moveMsg, cbs, t]);

  return {
    committing, setCommitting,
    updating, setUpdating,
    adding, setAdding,
    replacing, setReplacing,
    deleting, setDeleting,
    reverting, setReverting,
    cleaning, setCleaning,
    checkingOut, setCheckingOut,
    renameDialog, setRenameDialog, renameNewName, setRenameNewName, renameMsg, setRenameMsg, handleRename,
    mkdirParentUrl, setMkdirParentUrl, mkdirName, setMkdirName, mkdirMsg, setMkdirMsg, handleMkdir,
    copyDialog, setCopyDialog, copyDestUrl, setCopyDestUrl, copyMsg, setCopyMsg, handleCopy,
    moveDialog, setMoveDialog, moveDestUrl, setMoveDestUrl, moveMsg, setMoveMsg, handleMove,
    confirmDialog, setConfirmDialog,
    statusSelectedPaths, setStatusSelectedPaths,
  };
}
