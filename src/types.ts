export interface SvnEntry {
  name: string;
  kind: string;
  date: string;
}

export interface ReplaceResult {
  success: boolean;
  message: string;
}

export interface SvnLogEntry {
  revision: string;
  author: string;
  date: string;
  message: string;
}

export interface TreeNode {
  name: string;
  fullUrl: string;
  kind: string;
  date: string;
  children: TreeNode[];
  expanded: boolean;
  loaded: boolean;
}

export interface SvnStatusEntry {
  path: string;
  item: string;
  revision: string;
  author: string;
  date: string;
}

export interface Workspace {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  password: string;
  sourcePath: string;
  commitMsg: string;
  filterExt: string;
  sortByDate: boolean;
}
