---
command: release-plugin-pipeline
description: 按插件执行发布一条龙流程，自动处理常见失败场景并完成 commit/push/tag。
tags:
  - release
  - git
  - obsidian
---

# Release Plugin Pipeline

## 用途

用于 Obsidian monorepo 的单插件自动发布。只需输入 `project-name` 和 `version`，命令会自动完成预检、版本冲突处理、发布构建、提交推送、打 tag 与结果汇总。

## 指令内容

你是一个专业的发布工程助手，负责按仓库规范执行可恢复的发布流程。遇到已知错误要自动修复并重试，避免中途停在人工介入步骤。

## 历史问题复盘（必须覆盖）

以下问题在历史执行中出现过，后续流程必须内置兜底：

1. 远程仓库名不是 `origin`（实际是 `github`），导致远程校验失败。
2. 工作区不干净导致流水线中断。
3. 首次发布无历史 tag 且未传 `from-ref` 导致中断。
4. 目标版本已存在于 `CHANGELOG`/`tag`，重复版本发布失败。
5. CI 干净环境缺少 workspace 包产物，`@repo/core`/`@repo/ui` 解析失败。

## 输入参数

- **project-name**（必填）：插件目录名，如 `template-plugin`（对应 `apps/template-plugin`）。
- **version**（必填）：期望语义化版本号，如 `0.2.0`。
- **remote**（可选）：远程名；默认自动选择（优先 `origin`，否则唯一远程）。
- **from-ref**（可选）：显式基线；默认自动推导。

## 任务

### 1. 参数与仓库预检

- 校验 `project-name` 存在且 `version` 符合 SemVer。
- 校验当前分支不是 detached HEAD。
- 自动确定远程：
  - 若存在 `origin`，使用 `origin`。
  - 若无 `origin` 但仅有一个远程，使用该远程。
  - 若有多个远程且无 `origin`，使用用户传入的 `remote`，否则失败并列出可选远程。

### 2. 自动清理发布前阻塞（脏工作区）

- 若 `git status --porcelain` 非空，自动提交一次预发布快照后继续，不允许使用 `stash`。
- 提交信息格式：
  - `chore(release): preflight snapshot before <project-name> v<version>`

### 3. 自动确定有效发布版本

- 先用输入版本作为候选版本。
- 若候选版本已存在于任一位置：
  - `git tag`（本地或远程）中存在 `v-<project-name>-<version>`
  - `apps/<project-name>/CHANGELOG.md` 已存在该版本标题
  - `apps/<project-name>/versions.json` 已存在该 key
- 则自动将 patch +1，直到找到可发布版本，并记录“请求版本 -> 实际版本”。

### 4. 自动确定基线（无需强制输入 from-ref）

- 若传入 `from-ref`，直接使用并校验。
- 否则按优先级自动推导：
  1. 最新本地 tag：`v-<project-name>-*`
  2. 最新远程 tag：`v-<project-name>-*`
  3. 插件目录首个提交：`git rev-list --reverse HEAD -- apps/<project-name>` 的第一条

### 5. 执行发布编排并自动重试

执行：

```bash
pnpm release:pipeline --app <project-name> --version <effective-version> [--remote <remote>] [--from-ref <baseline-if-needed>]
```

若命中以下已知错误，按规则自动修复并重试一次：

- `Working tree must be clean`：
  - 执行第 2 步预发布快照提交后重试。
- `already contains version` 或 `Tag already exists`：
  - 执行第 3 步版本递增后重试。
- `Could not resolve "@repo/core"` / `@repo/ui`：
  - 先执行依赖构建：
    - `pnpm --filter "<project-name>^..." -r build`
  - 再重试发布。

### 6. 解析并输出发布摘要

- 从输出中提取 `RELEASE_SUMMARY_START/END` JSON。
- 若缺失该区块，命令视为失败并输出原始错误。

## 约束

- 禁止使用破坏性命令：`git push --force`、`git reset --hard`、`git checkout --`。
- 仅允许发布脚本更新以下范围：
  - `apps/<project-name>/package.json`
  - `apps/<project-name>/manifest.json`
  - `apps/<project-name>/versions.json`
  - `apps/<project-name>/CHANGELOG.md`
  - `apps/<project-name>/README.md`
  - 根 `README.md`
- tag 格式必须为：`v-<project-name>-<version>`。
- 任一步骤失败时，必须停止并输出可执行修复建议。

## 输出格式

```
🚀 发布摘要
-----------
插件: <project-name>
请求版本: <input-version>
实际版本: <effective-version>
基线: <baseline>
远程: <remote>
标签: <tag>

📝 变更文件
-----------
- <file1>
- <file2>

✅ 操作结果
-----------
- [x] 预检通过（远程/分支/工作区）
- [x] 版本与文档已更新
- [x] 构建与校验已通过
- [x] 已提交并推送分支
- [x] 已创建并推送 tag
```

## 注意事项

- 默认以“自动修复并继续”为目标，只在不可恢复错误时停止。
- 若请求版本被自动递增，必须在摘要中明确显示映射关系。
- 若远程推送失败（权限、网络、保护分支），直接失败并返回原始错误信息。
