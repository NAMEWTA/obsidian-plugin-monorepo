import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

function getArgValue(flagName) {
  const args = process.argv.slice(2);
  const index = args.indexOf(flagName);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function assertSemver(version) {
  return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version);
}

const app = getArgValue("--app");
const version = getArgValue("--version");

if (!app || !version) {
  console.error("Usage: node scripts/release-plugin.mjs --app <name> --version <x.y.z>");
  process.exit(1);
}

if (!assertSemver(version)) {
  console.error(`Invalid semver version: ${version}`);
  process.exit(1);
}

const rootDir = resolve(process.cwd());
const appDir = join(rootDir, "apps", app);
const manifestPath = join(appDir, "manifest.json");
const versionsPath = join(appDir, "versions.json");
const packagePath = join(appDir, "package.json");

if (!existsSync(appDir)) {
  console.error(`App "${app}" does not exist under apps/.`);
  process.exit(1);
}

if (!existsSync(manifestPath) || !existsSync(versionsPath)) {
  console.error(`App "${app}" is missing manifest.json or versions.json.`);
  process.exit(1);
}

if (!existsSync(packagePath)) {
  console.error(`App "${app}" is missing package.json.`);
  process.exit(1);
}

const manifest = readJson(manifestPath);
const versions = readJson(versionsPath);
const packageJson = readJson(packagePath);

manifest.version = version;
versions[version] = manifest.minAppVersion;
packageJson.version = version;

writeJson(manifestPath, manifest);
writeJson(versionsPath, versions);
writeJson(packagePath, packageJson);

execSync(`node scripts/verify-plugin.mjs --app ${app}`, {
  stdio: "inherit",
  cwd: rootDir
});

execSync(`pnpm build --filter ${app}`, {
  stdio: "inherit",
  cwd: rootDir
});

console.log(`Release prep completed for ${app}@${version}.`);
