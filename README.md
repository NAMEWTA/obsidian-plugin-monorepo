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

- Node.js `24.13.0+`
- pnpm `10.29.2+`

## Commands

- `pnpm install`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm verify`
- `pnpm release:plugin --app template-plugin --version 0.1.0`
- `pnpm release:pipeline --app <project-name> --version <x.y.z> [--from-ref <ref>]`

If pnpm warns that `esbuild` build scripts are blocked, run `pnpm approve-builds` once and allow `esbuild`.

## Release Artifact Layout

Every plugin release build writes artifacts to:

```text
apps/<project-name>/release/v<version>/
  main.js
  manifest.json
  styles.css
```

## Local sideload flow

1. Set environment variable `OBSIDIAN_VAULT_PATH` to your target vault path.
2. Run `pnpm dev --filter template-plugin` (or `pnpm dev` for whole monorepo).
3. Enable developer mode in Obsidian and reload plugin.

## Community release flow

1. Update `apps/<project>/package.json`, `apps/<project>/manifest.json`, and `apps/<project>/versions.json` with the same release version.
2. Run `pnpm verify` locally.
3. Push a tag with this format: `v-<project-name>-<x.y.z>`.
4. GitHub Actions builds only that project and publishes `<project-name>-v<x.y.z>.zip`.

Release guardrails:

- Tag must strictly match `v-<project-name>-<version>`.
- `version` in tag must match `package.json` and `manifest.json`.
- `versions.json` must contain the release key and map to `manifest.minAppVersion`.
- CI never auto-bumps versions.

<!-- RELEASE_TABLE:START -->
## Plugin Release Index

| Plugin | Version | Tag | Release Dir | Updated |
| --- | --- | --- | --- | --- |
| template-plugin | 0.1.2 | v-template-plugin-0.1.2 | apps/template-plugin/release/v0.1.2/ | 2026-02-27 |
<!-- RELEASE_TABLE:END -->
