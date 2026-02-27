import esbuild from "esbuild";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(appDir, "manifest.json");
const stylesPath = join(appDir, "styles.css");
const outFile = join(appDir, "main.js");
const isWatch = process.argv.includes("--watch");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pluginId = manifest.id;

function copyToVault() {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;

  if (!vaultPath) {
    return;
  }

  const targetDir = join(vaultPath, ".obsidian", "plugins", pluginId);
  mkdirSync(targetDir, { recursive: true });

  copyFileSync(outFile, join(targetDir, "main.js"));
  copyFileSync(manifestPath, join(targetDir, "manifest.json"));

  if (existsSync(stylesPath)) {
    copyFileSync(stylesPath, join(targetDir, "styles.css"));
  }
}

const syncPlugin = {
  name: "sync-to-obsidian-vault",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length === 0) {
        copyToVault();
      }
    });
  }
};

const ctx = await esbuild.context({
  entryPoints: [join(appDir, "src", "main.ts")],
  outfile: outFile,
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  sourcemap: isWatch ? "inline" : false,
  logLevel: "info",
  external: [
    "obsidian",
    "electron",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common"
  ],
  plugins: [syncPlugin]
});

if (isWatch) {
  await ctx.watch();
  copyToVault();
  console.log("watch mode started for template-plugin");
} else {
  await ctx.rebuild();
  copyToVault();
  await ctx.dispose();
}

