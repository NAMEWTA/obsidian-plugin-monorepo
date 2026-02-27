#!/usr/bin/env python3
"""
Initialize a new Obsidian plugin app from apps/template-plugin.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from datetime import date
from pathlib import Path
from typing import Any


DEFAULT_VERSION = "0.0.1"
DEFAULT_AUTHOR = "namewta"
DEFAULT_AUTHOR_URL = "https://github.com/NAMEWTA"
PLUGIN_NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
IGNORED_NAMES = {".turbo", "dist", "release", "node_modules", "main.js"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create apps/<plugin-name> by copying apps/template-plugin structure "
            "and resetting project metadata."
        )
    )
    parser.add_argument("plugin_name", help="Plugin id in hyphen-case (example: daily-notes-helper)")
    parser.add_argument(
        "--template-dir",
        default="apps/template-plugin",
        help="Template app directory, relative to repo root",
    )
    parser.add_argument(
        "--apps-dir",
        default="apps",
        help="Apps root directory, relative to repo root",
    )
    parser.add_argument("--display-name", help="Manifest display name")
    parser.add_argument("--description", help="Manifest description")
    parser.add_argument("--author", default=DEFAULT_AUTHOR, help="manifest.json author")
    parser.add_argument("--author-url", default=DEFAULT_AUTHOR_URL, help="manifest.json authorUrl")
    parser.add_argument("--min-app-version", help="manifest.json minAppVersion")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate inputs and print plan without writing files",
    )
    return parser.parse_args()


def fail(message: str) -> None:
    print(f"Error: {message}", file=sys.stderr)
    raise SystemExit(1)


def find_repo_root() -> Path:
    candidates = [Path.cwd().resolve(), Path(__file__).resolve()]

    for start in candidates:
        for candidate in (start, *start.parents):
            if (candidate / "pnpm-workspace.yaml").exists() and (candidate / "apps").exists():
                return candidate

    fail("Cannot locate repository root (missing pnpm-workspace.yaml and apps/).")
    raise AssertionError("unreachable")


def to_title_case(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.split("-"))


def to_pascal_case(slug: str) -> str:
    return "".join(part.capitalize() for part in slug.split("-"))


def derive_plugin_class_name(plugin_name: str) -> str:
    pascal = to_pascal_case(plugin_name)
    return pascal if pascal.endswith("Plugin") else f"{pascal}Plugin"


def derive_app_component_prefix(plugin_class_name: str) -> str:
    return plugin_class_name[:-6] if plugin_class_name.endswith("Plugin") else plugin_class_name


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"Missing file: {path}")
    except json.JSONDecodeError as exc:
        fail(f"Invalid JSON at {path}: {exc}")
    raise AssertionError("unreachable")


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def copy_template(template_dir: Path, target_dir: Path) -> None:
    if target_dir.exists():
        fail(f"Target already exists: {target_dir}")

    def ignore_names(_dir: str, names: list[str]) -> set[str]:
        return {name for name in names if name in IGNORED_NAMES}

    shutil.copytree(template_dir, target_dir, ignore=ignore_names)


def replace_tokens(path: Path, replacements: list[tuple[str, str]]) -> None:
    text = path.read_text(encoding="utf-8")
    updated = text
    for old, new in replacements:
        updated = updated.replace(old, new)
    path.write_text(updated, encoding="utf-8")


def build_readme(plugin_name: str, version: str, today: str) -> str:
    return f"""# {plugin_name}

Obsidian plugin scaffold in this monorepo.

## Features

- Registers commands and opens plugin settings
- Renders React 19 + Ant Design UI in setting tab
- Persists settings via `this.loadData()` / `this.saveData()` (stored as `data.json`)
- Includes migration hook `migrateData(raw)` in `src/data/schema.ts`

## Development

```bash
pnpm dev --filter {plugin_name}
```

Set `OBSIDIAN_VAULT_PATH` to auto-copy `main.js`, `manifest.json`, `styles.css` into:

```text
<vault>/.obsidian/plugins/{plugin_name}/
```

## Build

```bash
pnpm build --filter {plugin_name}
```

Release build output:

- `apps/{plugin_name}/release/v{version}/main.js`
- `apps/{plugin_name}/release/v{version}/manifest.json`
- `apps/{plugin_name}/release/v{version}/styles.css`

Explicit release build:

```bash
pnpm --filter ./apps/{plugin_name} build:release -- --version {version}
```

<!-- RELEASE_META:START -->
## Release Meta

- Latest Version: `{version}`
- Latest Tag: `v-{plugin_name}-{version}`
- Release Directory: `apps/{plugin_name}/release/v{version}/`
- Updated At: `{today}`
<!-- RELEASE_META:END -->
"""


def build_changelog(version: str, today: str) -> str:
    return f"""# Changelog

## {version} - {today}

- Baseline: `initial-scaffold`

### Added
- Scaffolded from `apps/template-plugin` with monorepo-compatible structure.

### Changed
- Reset project metadata and identifiers for the new plugin.

### Fixed
- None.

### Docs
- Initialized README and release metadata for the new plugin.

### Build
- None.
"""


def main() -> None:
    args = parse_args()
    plugin_name = args.plugin_name.strip()

    if not PLUGIN_NAME_PATTERN.fullmatch(plugin_name):
        fail(
            "Invalid plugin name. Use hyphen-case with lowercase letters and digits only "
            "(example: daily-notes-helper)."
        )

    repo_root = find_repo_root()
    template_dir = repo_root / args.template_dir
    apps_dir = repo_root / args.apps_dir
    target_dir = apps_dir / plugin_name

    if not template_dir.exists():
        fail(f"Template directory not found: {template_dir}")
    if not (template_dir / "manifest.json").exists() or not (template_dir / "package.json").exists():
        fail(f"Template directory is incomplete: {template_dir}")
    if not apps_dir.exists():
        fail(f"Apps directory not found: {apps_dir}")

    template_manifest = load_json(template_dir / "manifest.json")
    display_name = args.display_name.strip() if args.display_name else to_title_case(plugin_name)
    description = (
        args.description.strip()
        if args.description
        else f"{display_name} Obsidian plugin built with pnpm + turbo monorepo, React 19 and Ant Design."
    )
    min_app_version = args.min_app_version or template_manifest.get("minAppVersion", "1.5.0")
    today = date.today().isoformat()

    print(f"Repo root: {repo_root}")
    print(f"Template: {template_dir}")
    print(f"Target: {target_dir}")
    print(f"Plugin name: {plugin_name}")
    print(f"Display name: {display_name}")
    print(f"Version reset: {DEFAULT_VERSION}")

    if args.dry_run:
        print("Dry run mode: no files were written.")
        return

    copy_template(template_dir, target_dir)

    package_path = target_dir / "package.json"
    manifest_path = target_dir / "manifest.json"
    versions_path = target_dir / "versions.json"

    package_json = load_json(package_path)
    package_json["name"] = plugin_name
    package_json["version"] = DEFAULT_VERSION
    write_json(package_path, package_json)

    manifest = load_json(manifest_path)
    manifest["id"] = plugin_name
    manifest["name"] = display_name
    manifest["version"] = DEFAULT_VERSION
    manifest["minAppVersion"] = str(min_app_version)
    manifest["description"] = description
    manifest["author"] = args.author
    manifest["authorUrl"] = args.author_url
    write_json(manifest_path, manifest)

    write_json(versions_path, {DEFAULT_VERSION: str(min_app_version)})

    plugin_class_name = derive_plugin_class_name(plugin_name)
    app_prefix = derive_app_component_prefix(plugin_class_name)
    display_name_lower = display_name.lower()

    replacements = [
        ("TemplatePluginSettingTab", f"{plugin_class_name}SettingTab"),
        ("TemplatePluginData", f"{plugin_class_name}Data"),
        ("mountTemplateApp", f"mount{app_prefix}App"),
        ("TemplateAppProps", f"{app_prefix}AppProps"),
        ("TemplateApp", f"{app_prefix}App"),
        ("updateTemplateText", "updateSampleText"),
        ("getTemplateText", "getSampleText"),
        ("TemplatePlugin", plugin_class_name),
        ("Template Plugin", display_name),
        ("template plugin", display_name_lower),
        ("template-plugin", plugin_name),
    ]

    files_for_replacement = [
        target_dir / "src/main.ts",
        target_dir / "src/settings/SettingTab.tsx",
        target_dir / "src/react/App.tsx",
        target_dir / "src/react/mount.tsx",
        target_dir / "src/data/schema.ts",
        target_dir / "styles.css",
    ]

    for file_path in files_for_replacement:
        if file_path.exists():
            replace_tokens(file_path, replacements)

    (target_dir / "README.md").write_text(
        build_readme(plugin_name=plugin_name, version=DEFAULT_VERSION, today=today),
        encoding="utf-8",
    )
    (target_dir / "CHANGELOG.md").write_text(
        build_changelog(version=DEFAULT_VERSION, today=today),
        encoding="utf-8",
    )

    print("Scaffold created successfully.")
    print("Updated files:")
    print(f"- {package_path.relative_to(repo_root)}")
    print(f"- {manifest_path.relative_to(repo_root)}")
    print(f"- {versions_path.relative_to(repo_root)}")
    print(f"- {(target_dir / 'README.md').relative_to(repo_root)}")
    print(f"- {(target_dir / 'CHANGELOG.md').relative_to(repo_root)}")
    print("Run: pnpm --filter {name} typecheck".format(name=plugin_name))


if __name__ == "__main__":
    main()
