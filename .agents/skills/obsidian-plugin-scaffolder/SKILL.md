---
name: obsidian-plugin-scaffolder
description: 基于 apps/template-plugin 在当前 Obsidian monorepo 中初始化新插件子项目。Use when creating a new plugin app and resetting metadata (name/version/manifest/author fields) instead of copying template values verbatim.
argument-hint: [plugin-name]
---

# Obsidian Plugin Scaffolder

## Overview

根据插件名初始化 `apps/<plugin-name>`，复用 `apps/template-plugin` 的技术架构与目录结构，并自动重置项目元信息为新插件值。保持 monorepo 技术约束（pnpm workspace、turbo task、TypeScript/React 架构）不变，仅替换插件专属配置。

## Trigger Conditions

在以下场景触发本技能：

- 需要在本仓库新增 Obsidian 插件应用
- 需要复用 `apps/template-plugin` 结构但避免“原样复制元信息”
- 用户只提供插件名，希望自动完成脚手架与关键字段替换

## Workflow

### 1. Parse Required Input

读取 `$ARGUMENTS` 作为插件名。插件名必须是 hyphen-case（如 `daily-notes-helper`）。

如果 `$ARGUMENTS` 为空，先要求用户补充插件名，再继续。

### 2. Run Scaffold Script

运行脚本初始化插件目录并完成结构复制与字段重写：

```bash
python scripts/init_obsidian_plugin.py <plugin-name>
```

可选参数（按需）：

```bash
python scripts/init_obsidian_plugin.py <plugin-name> \
  --display-name "Daily Notes Helper" \
  --description "Description for manifest.json" \
  --author "namewta" \
  --author-url "https://github.com/NAMEWTA" \
  --min-app-version 1.5.0
```

### 3. Verify Metadata Reset

重点校验以下文件已从模板值切换为新项目值：

- `apps/<plugin-name>/package.json`
- `apps/<plugin-name>/manifest.json`
- `apps/<plugin-name>/versions.json`
- `apps/<plugin-name>/README.md`
- `apps/<plugin-name>/CHANGELOG.md`

必须满足：

- `name/id` 改为新插件名
- `version` 重置为 `0.0.1`
- `versions.json` 仅保留 `0.0.1`
- `author` 与 `authorUrl` 明确设置为目标项目值（默认可用 `namewta` / `https://github.com/NAMEWTA`，但禁止无脑照抄）

### 4. Run Basic Checks

执行最小验证，确认初始化后可进入开发：

```bash
pnpm --filter <plugin-name> typecheck
```

如依赖未安装或环境受限，明确记录未执行原因。

## Notes

读取 `references/scaffold_configuration_matrix.md` 获取完整的“复制项/重写项”矩阵与字段规则。执行初始化时始终遵循“复制架构，重置项目元信息”的原则。
