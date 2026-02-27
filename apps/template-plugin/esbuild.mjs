import esbuild from "esbuild";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function getArgValue(flagName) {
  const args = process.argv.slice(2);
  const directPrefix = `${flagName}=`;
  const directMatch = args.find((arg) => arg.startsWith(directPrefix));

  if (directMatch) {
    return directMatch.slice(directPrefix.length);
  }

  const index = args.indexOf(flagName);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function hasArg(flagName) {
  return process.argv.slice(2).includes(flagName);
}

function assertSemver(version) {
  return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version);
}

const appDir = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(appDir, "manifest.json");
const packagePath = join(appDir, "package.json");
const stylesPath = join(appDir, "styles.css");
const isWatch = hasArg("--watch");
const mode = getArgValue("--mode") ?? (isWatch ? "dev" : "release");

if (!["dev", "build", "release"].includes(mode)) {
  throw new Error(`Unknown build mode "${mode}". Use one of: dev, build, release.`);
}

if (isWatch && mode !== "dev") {
  throw new Error(`--watch is only supported in dev mode. Received mode "${mode}".`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const pluginId = manifest.id;
const requestedVersion = getArgValue("--version") ?? process.env.RELEASE_VERSION;
const releaseVersion = requestedVersion ?? packageJson.version;

if (mode === "release" && !assertSemver(releaseVersion)) {
  throw new Error(`Invalid release version "${releaseVersion}".`);
}

if (mode === "release" && requestedVersion && requestedVersion !== packageJson.version) {
  throw new Error(
    `Release version mismatch: --version is "${requestedVersion}" but package.json is "${packageJson.version}".`
  );
}

const releaseDir = join(appDir, "release", `v${releaseVersion}`);
const outFile = mode === "release" ? join(releaseDir, "main.js") : join(appDir, "main.js");

function copyToVault(bundlePath) {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;

  if (!vaultPath) {
    return;
  }

  const targetDir = join(vaultPath, ".obsidian", "plugins", pluginId);
  mkdirSync(targetDir, { recursive: true });

  copyFileSync(bundlePath, join(targetDir, "main.js"));
  copyFileSync(manifestPath, join(targetDir, "manifest.json"));

  if (existsSync(stylesPath)) {
    copyFileSync(stylesPath, join(targetDir, "styles.css"));
  }
}

function writeReleaseArtifacts() {
  mkdirSync(releaseDir, { recursive: true });
  copyFileSync(manifestPath, join(releaseDir, "manifest.json"));

  if (!existsSync(stylesPath)) {
    throw new Error(`Missing required styles.css for release mode at ${stylesPath}`);
  }

  copyFileSync(stylesPath, join(releaseDir, "styles.css"));
}

const buildOptions = {
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
  ]
};

if (isWatch) {
  const syncPlugin = {
    name: "sync-to-obsidian-vault",
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length === 0) {
          copyToVault(outFile);
        }
      });
    }
  };

  const ctx = await esbuild.context({
    ...buildOptions,
    plugins: [syncPlugin]
  });

  await ctx.watch();
  console.log(`watch mode started for ${pluginId}`);
} else {
  await esbuild.build(buildOptions);

  if (mode === "release") {
    writeReleaseArtifacts();
    console.log(`release artifacts generated at ${releaseDir}`);
  } else {
    copyToVault(outFile);
  }
}
