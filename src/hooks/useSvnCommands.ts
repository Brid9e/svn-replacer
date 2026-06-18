import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Workspace, SvnEntry, SvnLogEntry, ReplaceResult, SvnStatusEntry } from "../types";

function creds(ws: Workspace | undefined) {
  return { username: ws?.username || undefined, password: ws?.password || undefined };
}

export function useSvnCommands(workspaces: Workspace[], activeId: string) {
  const svnLs = useCallback(async (url: string): Promise<SvnEntry[]> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_ls", { url, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnLog = useCallback(async (url: string, limit = 50): Promise<SvnLogEntry[]> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_log", { url, limit, ...creds(ws) });
  }, [workspaces, activeId]);

  const doReplace = useCallback(async (
    source: string,
    targetUrl: string,
    commitMsg: string,
  ): Promise<ReplaceResult> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("do_replace", { source, targetUrl, commitMsg, ...creds(ws) });
  }, [workspaces, activeId]);

  const testConnection = useCallback(async (url: string): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("test_connection", { url, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnStatus = useCallback(async (path: string): Promise<SvnStatusEntry[]> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_status", { path, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnUpdate = useCallback(async (path: string, accept?: string): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_update", { path, accept: accept || null, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnCheckout = useCallback(async (url: string, path: string): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_checkout", { url, path, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnAdd = useCallback(async (path: string): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_add", { path, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnDelete = useCallback(async (path: string): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_delete", { path, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnDiff = useCallback(async (url: string): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_diff", { url, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnRevert = useCallback(async (path: string): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_revert", { path, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnCleanup = useCallback(async (path: string): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_cleanup", { path, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnResolve = useCallback(async (path: string, accept: string, recursive: boolean): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_resolve", { path, accept, recursive, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnCommit = useCallback(async (path: string, message: string): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_commit", { path, message, ...creds(ws) });
  }, [workspaces, activeId]);

  const svnRemoteDelete = useCallback(async (url: string, message: string): Promise<string> => {
    const ws = workspaces.find((w) => w.id === activeId);
    return invoke("svn_remote_delete", { url, message, ...creds(ws) });
  }, [workspaces, activeId]);

  const readLocalDir = useCallback(async (path: string): Promise<SvnEntry[]> => {
    return invoke("read_local_dir", { path });
  }, []);

  return { svnLs, svnLog, doReplace, testConnection, svnStatus, svnUpdate, svnCheckout, svnAdd, svnDelete, svnDiff, svnRevert, svnCleanup, svnResolve, svnCommit, svnRemoteDelete, readLocalDir };
}
