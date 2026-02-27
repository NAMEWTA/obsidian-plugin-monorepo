import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const ERROR_PREFIX = "RELEASE_ERROR";

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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertSemver(version) {
  return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version);
}

function fail(message) {
  console.error(`${ERROR_PREFIX}: ${message}`);
  process.exit(1);
}

function quoteValue(value) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function checkRequiredFiles(directory, fileNames) {
  const missing = fileNames.filter((fileName) => !existsSync(join(directory, fileName)));
  if (missing.length > 0) {
    fail(`Missing release artifacts in ${directory}: ${missing.join(", ")}`);
  }
}

const app = getArgValue("--app");
const version = getArgValue("--version");

if (!app || !version) {
  fail("Usage: node scripts/release-plugin.mjs --app <name> --version <x.y.z>");
}

if (!assertSemver(version)) {
  fail(`Invalid semver version: ${version}`);
}

const rootDir = resolve(process.cwd());
const appDir = join(rootDir, "apps", app);
const manifestPath = join(appDir, "manifest.json");
const versionsPath = join(appDir, "versions.json");
const packagePath = join(appDir, "package.json");

if (!existsSync(appDir)) {
  fail(`App "${app}" does not exist under apps/.`);
}

if (!existsSync(packagePath)) {
  fail(`App "${app}" is missing package.json.`);
}

if (!existsSync(manifestPath)) {
  fail(`App "${app}" is missing manifest.json.`);
}

if (!existsSync(versionsPath)) {
  fail(`App "${app}" is missing versions.json.`);
}

const manifest = readJson(manifestPath);
const versions = readJson(versionsPath);
const packageJson = readJson(packagePath);

const errors = [];

if (manifest.id !== app) {
  errors.push(`manifest.id "${manifest.id}" must match folder "${app}"`);
}

if (packageJson.version !== version) {
  errors.push(
    `package.json version mismatch. expected "${version}", got "${packageJson.version}"`
  );
}

if (manifest.version !== version) {
  errors.push(
    `manifest.json version mismatch. expected "${version}", got "${manifest.version}"`
  );
}

if (!Object.prototype.hasOwnProperty.call(versions, version)) {
  errors.push(`versions.json is missing key "${version}"`);
} else if (versions[version] !== manifest.minAppVersion) {
  errors.push(
    `versions.json["${version}"] must equal manifest.minAppVersion "${manifest.minAppVersion}", got "${versions[version]}"`
  );
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`${ERROR_PREFIX}: ${error}`);
  }
  process.exit(1);
}

execSync(`node scripts/verify-plugin.mjs --app ${quoteValue(app)} --version ${quoteValue(version)}`, {
  stdio: "inherit",
  cwd: rootDir
});

execSync(
  `pnpm --filter ${quoteValue(`./apps/${app}`)} build:release`,
  {
    stdio: "inherit",
    cwd: rootDir,
    env: {
      ...process.env,
      RELEASE_VERSION: version
    }
  }
);

const releaseDir = join(appDir, "release", `v${version}`);
checkRequiredFiles(releaseDir, ["main.js", "manifest.json", "styles.css"]);

console.log(`release-plugin succeeded for ${app}@${version}.`);
console.log(`release directory: ${releaseDir}`);
