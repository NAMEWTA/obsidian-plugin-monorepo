import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const ERROR_PREFIX = "PIPELINE_ERROR";
const SUMMARY_START = "RELEASE_SUMMARY_START";
const SUMMARY_END = "RELEASE_SUMMARY_END";

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

function assertSemver(version) {
  return /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version);
}

function parseSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    return undefined;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ? match[4].split(".") : []
  };
}

function comparePreIdentifier(a, b) {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);

  if (aNumeric && bNumeric) {
    return Number(a) - Number(b);
  }

  if (aNumeric && !bNumeric) {
    return -1;
  }

  if (!aNumeric && bNumeric) {
    return 1;
  }

  return a.localeCompare(b);
}

function compareSemver(a, b) {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);

  if (!parsedA || !parsedB) {
    return a.localeCompare(b);
  }

  if (parsedA.major !== parsedB.major) {
    return parsedA.major - parsedB.major;
  }

  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor - parsedB.minor;
  }

  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch - parsedB.patch;
  }

  if (parsedA.pre.length === 0 && parsedB.pre.length === 0) {
    return 0;
  }

  if (parsedA.pre.length === 0) {
    return 1;
  }

  if (parsedB.pre.length === 0) {
    return -1;
  }

  const maxLength = Math.max(parsedA.pre.length, parsedB.pre.length);
  for (let idx = 0; idx < maxLength; idx += 1) {
    const aId = parsedA.pre[idx];
    const bId = parsedB.pre[idx];

    if (!aId && bId) {
      return -1;
    }

    if (aId && !bId) {
      return 1;
    }

    if (aId && bId) {
      const compared = comparePreIdentifier(aId, bId);
      if (compared !== 0) {
        return compared;
      }
    }
  }

  return 0;
}

function fail(message) {
  console.error(`${ERROR_PREFIX}: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8"
  });

  if (result.error) {
    fail(`Failed to execute ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    const stdout = (result.stdout ?? "").trim();
    const commandLine = [command, ...args].join(" ");
    fail(`Command failed (${commandLine})\n${stderr || stdout || "Unknown error"}`);
  }

  return (result.stdout ?? "").trim();
}

function runInherit(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: "inherit",
    encoding: "utf8"
  });

  if (result.error) {
    fail(`Failed to execute ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const commandLine = [command, ...args].join(" ");
    fail(`Command failed (${commandLine})`);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(path, content) {
  writeFileSync(path, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function ensureGitPrechecks(repoRoot) {
  run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: repoRoot });

  const currentBranch = run("git", ["branch", "--show-current"], { cwd: repoRoot });
  if (!currentBranch) {
    fail("Detached HEAD is not supported for release pipeline.");
  }

  const status = run("git", ["status", "--porcelain"], { cwd: repoRoot });
  if (status) {
    fail("Working tree must be clean before running release pipeline.");
  }

  run("git", ["remote", "get-url", "origin"], { cwd: repoRoot });

  return currentBranch;
}

function resolveBaseline(repoRoot, app, fromRef) {
  const tagPrefix = `v-${app}-`;
  const rawTags = run("git", ["tag", "--list", `${tagPrefix}*`], { cwd: repoRoot });
  const tags = rawTags
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((tag) => ({
      tag,
      version: tag.slice(tagPrefix.length)
    }))
    .filter((entry) => assertSemver(entry.version))
    .sort((a, b) => compareSemver(b.version, a.version));

  if (tags.length > 0) {
    return tags[0].tag;
  }

  if (!fromRef) {
    fail(`No historical tag found for ${app}. Provide --from-ref for first release.`);
  }

  run("git", ["rev-parse", "--verify", `${fromRef}^{commit}`], { cwd: repoRoot });
  return fromRef;
}

function collectDiffSummary(repoRoot, app, baseline) {
  const appPath = `apps/${app}`;
  const commitsRaw = run(
    "git",
    ["log", "--pretty=format:%h%x09%s", `${baseline}..HEAD`, "--", appPath],
    { cwd: repoRoot }
  );
  const filesRaw = run("git", ["diff", "--name-status", `${baseline}..HEAD`, "--", appPath], {
    cwd: repoRoot
  });

  const commits = commitsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [hash, ...subjectParts] = line.split("\t");
      return {
        hash,
        subject: subjectParts.join("\t").trim()
      };
    });

  const files = filesRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [status, ...pathParts] = line.split("\t");
      return {
        status,
        path: pathParts.join("\t").trim()
      };
    });

  const categories = {
    Added: new Set(),
    Changed: new Set(),
    Fixed: new Set(),
    Docs: new Set(),
    Build: new Set()
  };

  for (const commit of commits) {
    const subject = commit.subject;
    if (/^(feat|feature)(\(.+\))?:/i.test(subject) || /\b新增\b/.test(subject)) {
      categories.Added.add(subject);
    } else if (/^(fix|bugfix)(\(.+\))?:/i.test(subject) || /\b修复\b/.test(subject)) {
      categories.Fixed.add(subject);
    } else if (/^(docs?)(\(.+\))?:/i.test(subject) || /readme|changelog/i.test(subject)) {
      categories.Docs.add(subject);
    } else if (/^(build|ci|chore)(\(.+\))?:/i.test(subject) || /release/i.test(subject)) {
      categories.Build.add(subject);
    } else {
      categories.Changed.add(subject);
    }
  }

  for (const file of files) {
    const normalizedPath = file.path.toLowerCase();
    const line = `${file.status} ${file.path}`;
    if (normalizedPath.endsWith("readme.md") || normalizedPath.endsWith("changelog.md")) {
      categories.Docs.add(line);
    } else if (normalizedPath.includes(".github/workflows") || normalizedPath.includes("scripts/")) {
      categories.Build.add(line);
    } else if (file.status === "A") {
      categories.Added.add(line);
    } else if (file.status === "M" || file.status === "R" || file.status === "D") {
      categories.Changed.add(line);
    }
  }

  const summary = {
    Added: [...categories.Added],
    Changed: [...categories.Changed],
    Fixed: [...categories.Fixed],
    Docs: [...categories.Docs],
    Build: [...categories.Build]
  };

  if (
    summary.Added.length === 0 &&
    summary.Changed.length === 0 &&
    summary.Fixed.length === 0 &&
    summary.Docs.length === 0 &&
    summary.Build.length === 0
  ) {
    summary.Changed.push("Internal maintenance updates.");
  }

  return {
    commits,
    files,
    summary
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function updateVersionFiles(appDir, app, version) {
  const packagePath = join(appDir, "package.json");
  const manifestPath = join(appDir, "manifest.json");
  const versionsPath = join(appDir, "versions.json");

  if (!existsSync(packagePath) || !existsSync(manifestPath) || !existsSync(versionsPath)) {
    fail(`Missing required release files under apps/${app}`);
  }

  const packageJson = readJson(packagePath);
  const manifest = readJson(manifestPath);
  const versions = readJson(versionsPath);

  packageJson.version = version;
  manifest.version = version;
  versions[version] = manifest.minAppVersion;

  writeJson(packagePath, packageJson);
  writeJson(manifestPath, manifest);
  writeJson(versionsPath, versions);

  return {
    packagePath,
    manifestPath,
    versionsPath
  };
}

function renderChangelogSection(version, dateLabel, baseline, summary) {
  const categories = ["Added", "Changed", "Fixed", "Docs", "Build"];
  const lines = [
    `## ${version} - ${dateLabel}`,
    "",
    `- Baseline: \`${baseline}\``,
    ""
  ];

  for (const category of categories) {
    lines.push(`### ${category}`);
    const items = summary[category] ?? [];
    if (items.length === 0) {
      lines.push("- None.");
    } else {
      for (const item of items) {
        lines.push(`- ${item}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function updateChangelog(appDir, app, version, baseline, summary) {
  const changelogPath = join(appDir, "CHANGELOG.md");
  const dateLabel = new Date().toISOString().slice(0, 10);
  let current = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : "";

  if (new RegExp(`^##\\s+${escapeRegExp(version)}\\b`, "m").test(current)) {
    fail(`apps/${app}/CHANGELOG.md already contains version ${version}`);
  }

  if (!current.trim()) {
    current = "# Changelog\n\n";
  }

  if (!current.startsWith("# Changelog")) {
    current = `# Changelog\n\n${current.trimStart()}`;
  }

  const body = current.replace(/^# Changelog\s*/m, "").trimStart();
  const section = renderChangelogSection(version, dateLabel, baseline, summary);
  const merged = `# Changelog\n\n${section}\n\n${body}`.trimEnd();

  writeText(changelogPath, merged);
  return changelogPath;
}

function replaceManagedBlock(content, startMarker, endMarker, block) {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = content.slice(0, startIndex).trimEnd();
    const after = content.slice(endIndex + endMarker.length).trimStart();
    return `${before}\n\n${block}\n\n${after}`.trimEnd();
  }

  const base = content.trimEnd();
  return `${base}\n\n${block}`.trimEnd();
}

function updatePluginReadme(appDir, app, version) {
  const readmePath = join(appDir, "README.md");
  if (!existsSync(readmePath)) {
    fail(`Missing plugin README: ${readmePath}`);
  }

  const dateLabel = new Date().toISOString().slice(0, 10);
  const tag = `v-${app}-${version}`;
  const block = [
    "<!-- RELEASE_META:START -->",
    "## Release Meta",
    "",
    `- Latest Version: \`${version}\``,
    `- Latest Tag: \`${tag}\``,
    `- Release Directory: \`apps/${app}/release/v${version}/\``,
    `- Updated At: \`${dateLabel}\``,
    "<!-- RELEASE_META:END -->"
  ].join("\n");

  const current = readFileSync(readmePath, "utf8");
  const next = replaceManagedBlock(current, "<!-- RELEASE_META:START -->", "<!-- RELEASE_META:END -->", block);
  writeText(readmePath, next);
  return readmePath;
}

function parseReleaseTableRows(block) {
  const rows = new Map();
  const lines = block.split("\n");

  for (const line of lines) {
    if (!line.startsWith("|")) {
      continue;
    }

    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    if (cells.length !== 5) {
      continue;
    }

    if (cells[0] === "Plugin" || cells[0] === "---") {
      continue;
    }

    rows.set(cells[0], {
      plugin: cells[0],
      version: cells[1],
      tag: cells[2],
      releaseDir: cells[3],
      updated: cells[4]
    });
  }

  return rows;
}

function updateRootReadme(repoRoot, app, version) {
  const rootReadmePath = join(repoRoot, "README.md");
  if (!existsSync(rootReadmePath)) {
    fail(`Missing root README: ${rootReadmePath}`);
  }

  const tag = `v-${app}-${version}`;
  const dateLabel = new Date().toISOString().slice(0, 10);
  const startMarker = "<!-- RELEASE_TABLE:START -->";
  const endMarker = "<!-- RELEASE_TABLE:END -->";
  const current = readFileSync(rootReadmePath, "utf8");
  const blockRegex = new RegExp(
    `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`,
    "m"
  );
  const matchedBlock = current.match(blockRegex)?.[0] ?? "";
  const rows = parseReleaseTableRows(matchedBlock);

  rows.set(app, {
    plugin: app,
    version,
    tag,
    releaseDir: `apps/${app}/release/v${version}/`,
    updated: dateLabel
  });

  const sortedRows = [...rows.values()].sort((a, b) => a.plugin.localeCompare(b.plugin));
  const tableLines = [
    startMarker,
    "## Plugin Release Index",
    "",
    "| Plugin | Version | Tag | Release Dir | Updated |",
    "| --- | --- | --- | --- | --- |"
  ];

  for (const row of sortedRows) {
    tableLines.push(
      `| ${row.plugin} | ${row.version} | ${row.tag} | ${row.releaseDir} | ${row.updated} |`
    );
  }

  tableLines.push(endMarker);
  const block = tableLines.join("\n");
  const next = replaceManagedBlock(current, startMarker, endMarker, block);
  writeText(rootReadmePath, next);
  return rootReadmePath;
}

function checkRequiredFiles(directory, fileNames) {
  const missing = fileNames.filter((fileName) => !existsSync(join(directory, fileName)));
  if (missing.length > 0) {
    fail(`Missing release artifacts in ${directory}: ${missing.join(", ")}`);
  }
}

function generateCommitMessage(app, version, summary) {
  const highlights = [];
  for (const category of ["Added", "Changed", "Fixed", "Docs", "Build"]) {
    for (const item of summary[category] ?? []) {
      if (highlights.length >= 2) {
        break;
      }
      highlights.push(item.replace(/^([A-Z]\s+)/, ""));
    }
    if (highlights.length >= 2) {
      break;
    }
  }

  if (highlights.length === 0) {
    return `release(${app}): prepare v${version}`;
  }

  return `release(${app}): v${version} - ${highlights.join("; ")}`;
}

function verifyTagNotExists(repoRoot, tagName) {
  const localTag = spawnSync("git", ["rev-parse", "--verify", `refs/tags/${tagName}`], {
    cwd: repoRoot,
    stdio: "ignore",
    encoding: "utf8"
  });
  if (localTag.status === 0) {
    fail(`Tag already exists locally: ${tagName}`);
  }

  const remoteTag = run("git", ["ls-remote", "--tags", "origin", tagName], {
    cwd: repoRoot
  });
  if (remoteTag) {
    fail(`Tag already exists on origin: ${tagName}`);
  }
}

function ensureStagedChanges(repoRoot) {
  const result = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd: repoRoot,
    stdio: "ignore",
    encoding: "utf8"
  });

  return result.status !== 0;
}

const app = getArgValue("--app");
const version = getArgValue("--version");
const fromRef = getArgValue("--from-ref");

if (!app || !version) {
  fail("Usage: node scripts/release-orchestrator.mjs --app <project-name> --version <x.y.z> [--from-ref <ref>]");
}

if (!assertSemver(version)) {
  fail(`Invalid semver version: ${version}`);
}

const repoRoot = resolve(process.cwd());
const appDir = join(repoRoot, "apps", app);
if (!existsSync(appDir)) {
  fail(`App does not exist: apps/${app}`);
}

const branch = ensureGitPrechecks(repoRoot);
const tagName = `v-${app}-${version}`;
verifyTagNotExists(repoRoot, tagName);

const baseline = resolveBaseline(repoRoot, app, fromRef);
const diff = collectDiffSummary(repoRoot, app, baseline);
const versionFiles = updateVersionFiles(appDir, app, version);
const changelogPath = updateChangelog(appDir, app, version, baseline, diff.summary);
const pluginReadmePath = updatePluginReadme(appDir, app, version);
const rootReadmePath = updateRootReadme(repoRoot, app, version);

runInherit("node", ["scripts/verify-plugin.mjs", "--app", app, "--version", version], {
  cwd: repoRoot
});
runInherit("pnpm", ["release:plugin", "--app", app, "--version", version], {
  cwd: repoRoot
});

const releaseDir = join(appDir, "release", `v${version}`);
checkRequiredFiles(releaseDir, ["main.js", "manifest.json", "styles.css"]);

const filesToStage = [
  versionFiles.packagePath,
  versionFiles.manifestPath,
  versionFiles.versionsPath,
  changelogPath,
  pluginReadmePath,
  rootReadmePath
].map((filePath) => relative(repoRoot, filePath).replace(/\\/g, "/"));

runInherit("git", ["add", "--", ...filesToStage], { cwd: repoRoot });

if (!ensureStagedChanges(repoRoot)) {
  fail("No staged changes found after pipeline updates.");
}

const commitMessage = generateCommitMessage(app, version, diff.summary);
const tagMessageLines = [
  `${app} v${version}`,
  "",
  `Baseline: ${baseline}`,
  "",
  "Summary:",
  ...["Added", "Changed", "Fixed", "Docs", "Build"].flatMap((category) => {
    const items = diff.summary[category] ?? [];
    if (items.length === 0) {
      return [];
    }
    return [`- ${category}: ${items[0]}`];
  })
];

runInherit("git", ["commit", "-m", commitMessage], { cwd: repoRoot });
runInherit("git", ["push", "origin", branch], { cwd: repoRoot });
runInherit("git", ["tag", "-a", tagName, "-m", tagMessageLines.join("\n")], {
  cwd: repoRoot
});
runInherit("git", ["push", "origin", tagName], { cwd: repoRoot });

const summary = {
  app,
  version,
  tag: tagName,
  branch,
  baseline,
  releaseDir: releaseDir.replace(/\\/g, "/"),
  commitMessage,
  categories: {
    Added: diff.summary.Added.length,
    Changed: diff.summary.Changed.length,
    Fixed: diff.summary.Fixed.length,
    Docs: diff.summary.Docs.length,
    Build: diff.summary.Build.length
  },
  stagedFiles: filesToStage
};

console.log(SUMMARY_START);
console.log(JSON.stringify(summary, null, 2));
console.log(SUMMARY_END);
