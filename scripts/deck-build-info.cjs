const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const exportsDir = path.join(root, "exports");
const buildFile = path.join(exportsDir, ".build-number");

function getRevision() {
  return childProcess.execSync("git rev-parse --short=7 HEAD", { cwd: root }).toString().trim();
}

function formatBuildNumber(value) {
  return String(value).padStart(4, "0");
}

function readBuildNumber() {
  if (!fs.existsSync(buildFile)) {
    return 0;
  }
  const parsed = Number.parseInt(fs.readFileSync(buildFile, "utf8").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function allocateBuildNumber() {
  fs.mkdirSync(exportsDir, { recursive: true });
  const next = readBuildNumber() + 1;
  fs.writeFileSync(buildFile, `${next}\n`);
  return formatBuildNumber(next);
}

function resolveBuildNumber() {
  if (process.env.DECK_BUILD_NUMBER) {
    return process.env.DECK_BUILD_NUMBER;
  }
  return allocateBuildNumber();
}

function getBuildInfo() {
  const revision = process.env.DECK_REVISION || getRevision();
  const build = resolveBuildNumber();
  return {
    root,
    exportsDir,
    revision,
    build,
    stem: `ubiquity-os-${revision}-${build}`,
  };
}

if (require.main === module) {
  const info = getBuildInfo();
  const shell = process.argv.includes("--shell");
  if (shell) {
    process.stdout.write(`export DECK_REVISION=${info.revision}\n`);
    process.stdout.write(`export DECK_BUILD_NUMBER=${info.build}\n`);
    process.stdout.write(`export DECK_EXPORT_STEM=${info.stem}\n`);
  } else {
    process.stdout.write(`${info.stem}\n`);
  }
}

module.exports = { getBuildInfo };
