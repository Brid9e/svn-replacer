# 架构说明

## 项目定位

Tauri v2 + React 19 + TypeScript 桌面 SVN 客户端。当前阶段是从单一"替换提交"工具向通用 SVN 客户端演进。

- **Phase 1**: 拆分单体 App.tsx → hooks + components
- **Phase 2**: TabBar + Toolbar 导航架构

## 文件结构

```
src/
├── main.tsx                          # 入口，不变
├── index.css                         # 所有样式，变量系统 + 组件样式
├── types.ts                          # 所有接口定义
├── App.tsx                           # 布局协调器，~200 行 (原 ~850 行)
├── hooks/
│   ├── useWorkspaces.ts              # 工作空间 CRUD + localStorage 持久化
│   ├── useSvnCommands.ts             # Tauri invoke 封装 + 凭证注入
│   └── useTree.ts                    # 树加载/缓存/搜索/筛选/排序
└── components/
    ├── WorkspaceBar.tsx              # 左侧工作空间栏 + 右键菜单
    ├── TreePanel.tsx                 # 树容器（工具栏 + 搜索 + 筛选 + 树）
    ├── TreeItem.tsx                  # 递归树节点
    ├── OutputPanel.tsx               # 可关闭的输出信息框
    ├── Toolbar.tsx                   # 顶部动作工具栏（上下文相关按钮）
    ├── TabBar.tsx                    # 标签栏（Status / Log / Commit / Diff）
    └── panels/
        ├── StatusPanel.tsx           # Status 面板（占位）
        ├── LogPanel.tsx              # 提交历史时间线
        ├── ReplacePanel.tsx          # 标准 Commit 表单
        ├── DiffPanel.tsx             # Diff 面板（占位）
        ├── SettingsPanel.tsx         # 主题设置（覆盖层）
        └── WorkspacePanel.tsx        # 工作空间编辑表单（覆盖层）
```

## 数据流

```
┌──────────────┐
│ useWorkspaces │─── workspaces[], activeId, activeWorkspace
└──────┬───────┘
       │ setWsField / switchWorkspace / deleteWorkspace
       ▼
┌──────────────────┐
│  useSvnCommands   │─── svnLs, svnLog, doReplace (自动注入凭证)
│  (workspaces,     │
│   activeId)       │
└──────┬───────────┘
       │ svnLs
       ▼
┌──────────┐
│ useTree  │─── treeRoot, selectedUrl/Name, sortEntries, isFiltered, matchesSearch
│ (active  │    loadTree, resetTree
│ Workspace│
│ , svnLs) │
└──────────┘
```

### 关键原则

1. **App.tsx 是状态协调器**，不直接渲染大量 JSX。所有面板内容在独立组件中渲染。
2. **工作空间是顶层数据**，驱动所有子组件。切换工作空间时重置树、日志、输出。
3. **凭证自动注入**：useSvnCommands 内部通过 `activeId` 查找当前工作空间的凭证，外部无需关注。
4. **useCallback 稳定性**：所有回调使用 `[activeId, workspaces]` 模式，避免对象引用变化导致的不必要重创建。

## 状态分布

### App.tsx 管理的状态（跨组件共享）
| 状态 | 用途 | 传递给 |
|------|------|--------|
| theme | 暗色/亮色主题 | SettingsPanel |
| activeTab | 当前标签页 (status/log/commit/diff) | TabBar, Toolbar |
| overlay | 覆盖层 (settings/workspace/null) | 决定是否覆盖内容区 |
| editWsId/wsForm | 编辑工作空间表单 | WorkspacePanel |
| replacing | 替换操作进行中 | ReplacePanel |
| output | 操作结果信息 | OutputPanel (全局底部) |
| logEntries | 提交历史数据 | LogPanel |
| loadingLog | 日志加载中 | LogPanel |
| dragOver | 文件拖拽状态 | ReplacePanel |
| leftWidth | 左侧树面板宽度 | TreePanel + Splitter |

### useTree 管理的状态（树专属）
| 状态 | 用途 |
|------|------|
| treeRoot | 树根节点 |
| treeLoading | 树加载中 |
| selectedUrl/Name | 当前选中节点 |
| filterOpen | 筛选栏展开 |
| searchText | 搜索文本 |

## 组件职责

### WorkspaceBar
- 渲染左侧竖向工作空间按钮列表
- 处理右键上下文菜单（编辑/删除）
- 上下文菜单状态（ctxMenu）为组件内部状态，不提升到 App

### TreePanel
- 渲染树工具栏（Load Tree、排序、筛选、刷新按钮）
- 渲染搜索输入框
- 渲染筛选输入框
- 渲染树容器（TreeItem 递归组件）

### TreeItem
- 递归渲染树节点
- 管理节点展开/折叠/懒加载状态
- 接收 svnLs 函数用于懒加载子节点（不再直接调用 invoke）

### CommitPanel
- 工作副本路径输入 + Browse 按钮
- 提交信息输入
- Commit 按钮（标准 svn commit）
- 操作结果输出

### LogPanel
- 显示选中目标的提交历史（时间线样式）
- 加载状态/空状态/错误状态

### SettingsPanel
- 主题切换（亮色/暗色）

### WorkspacePanel
- 工作空间添加/编辑表单
- 名称、SVN 地址、用户名、密码

### OutputPanel
- 通用的输出信息框（成功/错误样式）
- 可关闭
- 在 `panel-right` 底部全局渲染，跨标签页可见

### Toolbar
- 根据 `activeTab` 显示上下文相关的操作按钮
- 通过 `actions` prop 接收按钮列表，`onAction` 回调处理点击
- 始终在右侧显示设置齿轮图标
- 目前支持的按钮：
  - **Status 标签**: Update, Add, Delete（占位，提示"尚未实现"）
  - **Log 标签**: Refresh（刷新当前日志）
  - **Commit/Diff 标签**: 无额外按钮

### TabBar
- 四个固定标签：Status、Log、Commit、Diff
- 每个标签有对应的 lucide 图标
- 激活标签有蓝色下划线指示

### StatusPanel
- 显示指定工作副本的 SVN 状态变更
- 带有工作副本路径输入 + Browse 按钮
- 彩色状态徽章（M=modified, A=added, D=deleted, ?=unversioned, !=missing, C=conflicted）
- 变更摘要栏（按状态分组计数）
- 显示关联的修订号和作者（版本化文件）
- 自包含状态管理（path/loading/entries 均在组件内部）
- 通过 `svnStatus` 函数间接调用后端 svn status --xml

### DiffPanel
- 占位组件，显示"功能开发中"

## 导航架构

Phase 2 引入了两级导航代替原来的 `view` 字面量：

```
activeTab: "status" | "log" | "commit" | "diff"    ← 标签导航
overlay: "settings" | "workspace" | null            ← 覆盖层（设置/编辑工作空间）
```

- 标签切换：TabBar → `setActiveTab()` → 对应面板渲染
- 覆盖层：点击 Toolbar 齿轮图标 → `setOverlay("settings")` → 内容区显示设置
- 覆盖层关闭：点击关闭按钮 → `setOverlay(null)` → 恢复标签面板

### 面板渲染逻辑

```tsx
{overlay === "settings"  → SettingsPanel}
{overlay === "workspace" → WorkspacePanel}
{!overlay && activeTab === "status" → StatusPanel}
{!overlay && activeTab === "log"    → LogPanel}
{!overlay && activeTab === "commit" → ReplacePanel}
{!overlay && activeTab === "diff"   → DiffPanel}
{output → OutputPanel (always at bottom)}
```

## panel-right 布局

```
┌──────────────────────────────────────┐
│ Toolbar (actions + gear icon)        │  flex-shrink: 0
├──────────────────────────────────────┤
│ TabBar (Status | Log | Commit | Diff)│  flex-shrink: 0
├──────────────────────────────────────┤
│                                      │
│ Content Area (.main)                 │  flex: 1 (scrollable)
│                                      │
├──────────────────────────────────────┤
│ OutputPanel (if output exists)       │  auto-height
└──────────────────────────────────────┘
```

## 后端 Tauri 命令（Rust）

| 命令 | 用途 | 参数 | 返回 |
|------|------|------|------|
| svn_ls | 列出目录 | url, username?, password? | SvnEntry[] |
| svn_log | 查看提交历史 | url, limit, username?, password? | SvnLogEntry[] |
| do_replace | 替换并提交 | source, targetUrl, commitMsg, username?, password? | ReplaceResult |
| test_connection | 测试连接 | url, username?, password? | string |
| svn_status | 查看工作副本状态 | path, username?, password? | SvnStatusEntry[] |
| svn_update | 更新工作副本 | path, username?, password? | string |
| svn_add | 添加文件到版本控制 | path, username?, password? | string |
| svn_delete | 从版本控制删除文件 | path, username?, password? | string |
| svn_diff | 查看文件差异 | url, username?, password? | string |
| svn_revert | 还原本地修改 | path, username?, password? | string |
| svn_cleanup | 清理工作副本锁 | path, username?, password? | string |

凭证参数为可选：当为空时 SVN 使用本地缓存的认证信息。

## 主题系统

使用 `data-theme` 属性切换暗色/亮色。`index.css` 中定义了 CSS 变量：

```css
:root { /* 亮色主题变量 */ }
[data-theme="dark"] { /* 暗色主题变量 */ }
```

背景使用 `radial-gradient` 营造微弱的 `spotlight` 效果。面板使用 `backdrop-filter: blur()` 实现毛玻璃效果。

## 布局计算

| 区域 | 宽度 | 说明 |
|------|------|------|
| workspace-bar | 52px | 左侧工作空间按钮栏 |
| panel-left | leftWidth (默认 280px) | 树面板，可拖拽调整 |
| splitter | 6px | 位于 52 + leftWidth - 3 |
| panel-right | 剩余 | 右侧内容区域 |

Splitter 位置：`left: 52 + leftWidth - 3`（-3 将中点对齐到分割线）。

## 历史决策/注意事项

### useSvnCommands 稳定性
- **问题**：原实现 `const ws = workspaces.find(...)` 在 hook 顶层执行，`ws` 作为 useCallback 依赖。每次任一工作空间编辑导致 `ws` 新引用，所有回调重建。
- **解决**：将查找移到回调内部，依赖改为 `[workspaces, activeId]`。

### 右键菜单关闭时序
- **问题**：`useEffect` mousedown 关闭监听器在 `click` 事件之前触发，导致菜单项 `onClick` 从未执行。
- **解决**：菜单项使用 `onMouseDown` 替代 `onClick`。

### 工作空间切换卡顿
- **问题**：`activeWorkspace` 和 `currentCreds` 是派生对象，每次渲染新引用，导致 loadTree 等回调重建。
- **解决**：回调使用 `[activeId, workspaces]` 模式，对象查找在回调内部进行。

### WorkspaceBar 上下文菜单
- **上下文菜单的状态（位置、目标工作空间ID）完全在 WorkspaceBar 内部管理**，不提升到 App。因为只有 WorkspaceBar 需要这些状态。

### TreeItem 的 invoke 调用
- 重构前：TreeItem 直接调用 `invoke("svn_ls", { url, username, password })`，通过 props 接收 `creds`。
- 重构后：TreeItem 接收 `svnLs` 函数（来自 useSvnCommands），不再关心凭证。这是为了统一 invoke 调用入口，确保凭证注入的一致性。

## Phase 3 已完成

| 功能 | 状态 | 说明 |
|------|------|------|
| 树节点右键菜单 | ✅ | 复制 URL、查看提交历史、Diff（占位） |
| 测试连接按钮 | ✅ | 设置在设置面板，调用已存在的 test_connection 命令 |
| Status Panel | ✅ | svn status --xml 解析，彩色状态指示器 |
| Update | ✅ | svn update 命令，通过 Status tab Toolbar 按钮触发 |
| Add/Delete | 🔲 | Toolbar 占位按钮 |
| Add/Delete | ✅ | svn add / svn delete 命令，通过文件选择器对话框 |
| Diff Panel | ✅ | svn diff -r PREV:HEAD URL，语法高亮 pre 显示 |

### 树节点右键菜单

实现位置：`TreePanel.tsx`（非 TreeItem）。

**设计选择**：上下文菜单状态在 TreePanel 中统一管理，而不是分散在每个 TreeItem 中。这避免了多个 TreeItem 实例各自维护自身菜单的复杂性。

- `ctxMenu` 状态：`{ x, y, url, name, kind } | null`
- 关闭逻辑：document mousedown 监听（与 WorkspaceBar 相同模式）
- 操作通过 `onContextAction` 回调冒泡到 App

### 测试连接

- 按钮位于设置面板的"连接"区域
- 调用 `testConnection`（来自 `useSvnCommands`）
- 结果显示在全局 OutputPanel（面板底部）
- 按钮在测试期间显示 spinner 并禁用
