# template-plugin

Minimal Obsidian plugin template in this monorepo.

## Features

- Registers command to open plugin settings
- Renders React 19 + Ant Design UI in setting tab
- Persists settings via `this.loadData()` / `this.saveData()` (stored as `data.json`)
- Includes migration hook `migrateData(raw)` in `src/data/schema.ts`

## Development

```bash
pnpm dev --filter template-plugin
```

Set `OBSIDIAN_VAULT_PATH` to auto-copy `main.js`, `manifest.json`, `styles.css` into:

```text
<vault>/.obsidian/plugins/template-plugin/
```

## Build

```bash
pnpm build --filter template-plugin
```

Release build output:

- `apps/template-plugin/release/v0.1.0/main.js`
- `apps/template-plugin/release/v0.1.0/manifest.json`
- `apps/template-plugin/release/v0.1.0/styles.css`

Explicit release build:

```bash
pnpm --filter ./apps/template-plugin build:release -- --version 0.1.0
```

Template copy checklist for a new plugin:

1. Rename folder under `apps/<new-plugin-name>`.
2. Update `apps/<new-plugin-name>/package.json` name/version.
3. Update `apps/<new-plugin-name>/manifest.json` id/name/version/minAppVersion.
4. Update `apps/<new-plugin-name>/versions.json`.

<!-- RELEASE_META:START -->
## Release Meta

- Latest Version: `0.1.2`
- Latest Tag: `v-template-plugin-0.1.2`
- Release Directory: `apps/template-plugin/release/v0.1.2/`
- Updated At: `2026-02-27`
<!-- RELEASE_META:END -->
