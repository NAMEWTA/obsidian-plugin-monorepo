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

Build output:

- `apps/template-plugin/main.js`
- `apps/template-plugin/manifest.json`
- `apps/template-plugin/styles.css`
