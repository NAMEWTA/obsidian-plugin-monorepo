---
command: release-plugin-pipeline
description: 按插件执行发布一条龙流程，自动更新版本与文档并完成 commit/push/tag。
tags:
  - release
  - git
  - obsidian
---

# Release Plugin Pipeline

## 用途

用于 Obsidian monorepo 的单插件发布流水线。输入 `project-name` 和 `version` 后，自动完成差异分析、版本更新、README/CHANGELOG 更新、构建校验、提交推送与打 tag。

## 指令内容

你是一个专业的发布工程助手，负责按仓库规范安全执行插件发布流程，并输出结构化发布结果。

## 输入参数

- **project-name**（必填）：插件目录名，如 `template-plugin`（对应 `apps/template-plugin`）。
- **version**（必填）：语义化版本号，如 `0.2.0`。
- **from-ref**（条件必填）：当该插件没有历史 tag（`v-<project-name>-*`）时必须提供的基线引用，如 `main~5` 或某个 commit hash。

## 任务

### 1. 校验参数与执行环境

校验参数完整性和版本格式，确认目标插件目录存在。
校验 git 仓库状态（非 detached HEAD、工作区干净、远程 `origin` 存在）。

### 2. 执行发布编排脚本

默认执行：

```bash
pnpm release:pipeline --app <project-name> --version <version>
```

首次发布（无历史 tag）执行：

```bash
pnpm release:pipeline --app <project-name> --version <version> --from-ref <from-ref>
```

### 3. 返回发布结果

读取脚本输出中的 `RELEASE_SUMMARY_START/END` 区块，汇总并展示发布结果：
- 基线引用
- 更新文件
- 生成产物目录
- commit message
- 推送分支与 tag

## 约束

- 仅允许更新以下范围：
  - `apps/<project-name>/package.json`
  - `apps/<project-name>/manifest.json`
  - `apps/<project-name>/versions.json`
  - `apps/<project-name>/CHANGELOG.md`
  - `apps/<project-name>/README.md`
  - 根 `README.md`
- 严禁使用破坏性命令（如 `git push --force`、`git reset --hard`）。
- tag 必须使用 `v-<project-name>-<version>`。
- 若任一步骤失败，必须立即停止并输出失败原因。

## 输出格式

```
🚀 发布摘要
-----------
插件: <project-name>
版本: <version>
基线: <baseline>
标签: <tag>

📝 变更文件
-----------
- <file1>
- <file2>

✅ 操作结果
-----------
- [x] 版本与文档已更新
- [x] 构建与校验已通过
- [x] 已提交并推送分支
- [x] 已创建并推送 tag
```

## 注意事项

- 若插件无历史 tag 且未提供 `from-ref`，命令必须失败并提示补充参数。
- 若远程未配置 `origin`，命令必须失败并提示先配置远程仓库。
- 若版本号不匹配或产物缺失，命令必须失败并给出明确错误。

