import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function getArgValue(flagName) {
  const args = process.argv.slice(2);
  const index = args.indexOf(flagName);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function verifyApp(appsRoot, appName) {
  const appDir = join(appsRoot, appName);
  const manifestPath = join(appDir, "manifest.json");
  const versionsPath = join(appDir, "versions.json");

  const errors = [];

  if (!existsSync(manifestPath)) {
    errors.push(`[${appName}] missing manifest.json`);
    return errors;
  }

  if (!existsSync(versionsPath)) {
    errors.push(`[${appName}] missing versions.json`);
    return errors;
  }

  const manifest = readJson(manifestPath);
  const versions = readJson(versionsPath);

  const requiredFields = ["id", "name", "version", "minAppVersion"];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      errors.push(`[${appName}] manifest.json missing required field: ${field}`);
    }
  }

  if (manifest.id !== appName) {
    errors.push(`[${appName}] manifest.id must match folder name. got "${manifest.id}"`);
  }

  if (versions[manifest.version] !== manifest.minAppVersion) {
    errors.push(
      `[${appName}] versions.json must map manifest.version "${manifest.version}" to minAppVersion "${manifest.minAppVersion}"`
    );
  }

  return errors;
}

const repoRoot = resolve(process.cwd());
const appsRoot = join(repoRoot, "apps");
const appFromArgs = getArgValue("--app");

const apps = appFromArgs
  ? [appFromArgs]
  : readdirSync(appsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

const allErrors = [];

for (const appName of apps) {
  allErrors.push(...verifyApp(appsRoot, appName));
}

if (allErrors.length > 0) {
  for (const err of allErrors) {
    console.error(`ERROR: ${err}`);
  }
  process.exit(1);
}

console.log(`verify-plugin passed for ${apps.length} app(s).`);

