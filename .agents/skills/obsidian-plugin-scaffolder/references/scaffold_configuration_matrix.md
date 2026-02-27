# Scaffold Configuration Matrix

## Scope

Initialize a new plugin app by reusing `apps/template-plugin` architecture while resetting project-specific metadata.

## Copy and Rewrite Rules

| Category | Action | Notes |
| --- | --- | --- |
| Directory layout | Copy | Keep `src/`, `esbuild.mjs`, `tsconfig.json`, `styles.css`, script conventions |
| Build artifacts | Exclude | Skip `.turbo/`, `dist/`, `release/`, `node_modules/`, `main.js` |
| `package.json` | Rewrite | Set `name=<plugin-name>`, `version=0.0.1`; keep scripts/dependencies unless explicitly changed |
| `manifest.json` | Rewrite | Set `id/name/version/minAppVersion/description/author/authorUrl` for the new plugin |
| `versions.json` | Rewrite | Reset to `{ \"0.0.1\": \"<minAppVersion>\" }` |
| `README.md` | Rewrite | Replace template references and release metadata with new plugin values |
| `CHANGELOG.md` | Rewrite | Reset to initial `0.0.1` entry for the new plugin |
| Source identifiers | Rewrite | Replace `template-plugin`, `TemplatePlugin`, related labels/classes/command ids |

## Mandatory Metadata Reset

Do not copy these fields verbatim from template values:

- Plugin name fields: `package.json.name`, `manifest.json.id`, `manifest.json.name`
- Version fields: `package.json.version`, `manifest.json.version`, `versions.json`
- Author fields: `manifest.json.author`, `manifest.json.authorUrl`
- Human-readable text containing old template identity

Default values can be used when appropriate, but values must be explicitly set for the new project.

## Script Entry

Use `scripts/init_obsidian_plugin.py` as the deterministic initializer to apply all rewrite rules in one run.
