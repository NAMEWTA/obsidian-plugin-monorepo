import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const ERROR_PREFIX = "VERIFY_ERROR";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

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

function verifyApp(appsRoot, appName, expectedVersion) {
  const appDir = join(appsRoot, appName);
  const manifestPath = join(appDir, "manifest.json");
  const versionsPath = join(appDir, "versions.json");
  const packagePath = join(appDir, "package.json");
  const errors = [];

  if (!existsSync(appDir)) {
    errors.push(`[${appName}] app folder does not exist`);
    return errors;
  }

  if (!existsSync(manifestPath)) {
    errors.push(`[${appName}] missing manifest.json`);
    return errors;
  }

  if (!existsSync(versionsPath)) {
    errors.push(`[${appName}] missing versions.json`);
    return errors;
  }

  if (!existsSync(packagePath)) {
    errors.push(`[${appName}] missing package.json`);
    return errors;
  }

  const manifest = readJson(manifestPath);
  const versions = readJson(versionsPath);
  const packageJson = readJson(packagePath);

  const requiredFields = ["id", "name", "version", "minAppVersion"];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      errors.push(`[${appName}] manifest.json missing required field: ${field}`);
    }
  }

  if (manifest.id !== appName) {
    errors.push(`[${appName}] manifest.id must match folder name. got "${manifest.id}"`);
  }

  if (packageJson.version !== manifest.version) {
    errors.push(
      `[${appName}] package.json version "${packageJson.version}" must match manifest.version "${manifest.version}"`
    );
  }

  if (versions[manifest.version] !== manifest.minAppVersion) {
    errors.push(
      `[${appName}] versions.json must map manifest.version "${manifest.version}" to minAppVersion "${manifest.minAppVersion}"`
    );
  }

  if (expectedVersion) {
    if (manifest.version !== expectedVersion) {
      errors.push(
        `[${appName}] manifest.version "${manifest.version}" must match expected "${expectedVersion}"`
      );
    }

    if (packageJson.version !== expectedVersion) {
      errors.push(
        `[${appName}] package.json version "${packageJson.version}" must match expected "${expectedVersion}"`
      );
    }

    if (!Object.prototype.hasOwnProperty.call(versions, expectedVersion)) {
      errors.push(`[${appName}] versions.json missing expected key "${expectedVersion}"`);
    } else if (versions[expectedVersion] !== manifest.minAppVersion) {
      errors.push(
        `[${appName}] versions.json["${expectedVersion}"] must equal manifest.minAppVersion "${manifest.minAppVersion}"`
      );
    }
  }

  return errors;
}

const repoRoot = resolve(process.cwd());
const appsRoot = join(repoRoot, "apps");
const appFromArgs = getArgValue("--app");
const expectedVersion = getArgValue("--version");

if (!existsSync(appsRoot)) {
  console.error(`${ERROR_PREFIX}: apps directory not found at ${appsRoot}`);
  process.exit(1);
}

const apps = appFromArgs
  ? [appFromArgs]
  : readdirSync(appsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

const allErrors = [];

for (const appName of apps) {
  allErrors.push(...verifyApp(appsRoot, appName, expectedVersion));
}

if (allErrors.length > 0) {
  for (const err of allErrors) {
    console.error(`${ERROR_PREFIX}: ${err}`);
  }
  process.exit(1);
}

console.log(`verify-plugin passed for ${apps.length} app(s).`);

