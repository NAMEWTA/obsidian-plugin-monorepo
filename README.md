# Obsidian Plugin Monorepo

Monorepo for all personal Obsidian plugins, managed with `pnpm + turbo`.

## Stack

- Workspace: `pnpm` + `turbo`
- Plugin UI: `React 19` + `Ant Design`
- Persistence: Obsidian official `loadData/saveData` -> `data.json`

## Layout

```text
apps/<plugin-name>/      # each plugin app
packages/core            # plugin runtime helpers and data store
packages/ui              # shared React + Antd provider/theme
packages/config          # shared tsconfig/eslint/turbo defaults
scripts/                 # verify/release scripts
```

## Requirements

- Node.js `20+`
- pnpm `10+`

## Commands

- `pnpm install`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm verify`
- `pnpm release:plugin --app template-plugin --version 0.1.0`

If pnpm warns that `esbuild` build scripts are blocked, run `pnpm approve-builds` once and allow `esbuild`.

## Local sideload flow

1. Set environment variable `OBSIDIAN_VAULT_PATH` to your target vault path.
2. Run `pnpm dev --filter template-plugin` (or `pnpm dev` for whole monorepo).
3. Enable developer mode in Obsidian and reload plugin.

## Community release flow

1. Run `pnpm verify`.
2. Run `pnpm release:plugin --app <plugin-name> --version <x.y.z>`.
3. Use GitHub workflow `Release Plugin` to produce `.zip` asset and release.
