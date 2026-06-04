const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const { getBuildInfo } = require("./deck-build-info.cjs");

const { root, revision, build, stem } = getBuildInfo();
const sourcePath = path.join(root, "pitch-deck.md");
const themePath = path.join(root, "assets", "pitch", "pitch-theme.css");
const adjustmentsPath = path.join(root, "assets", "pitch", "pitch-adjustments.css");
const tempDir = path.join(root, ".deck-render");
const tempPath = path.join(tempDir, "pitch-deck.md");
const tempThemePath = path.join(tempDir, "pitch-theme.render.css");
const cliArgs = process.argv.slice(2);
const isWatchMode = cliArgs.includes("--watch");
const isPreviewMode = cliArgs.includes("--preview");
let renderTimeout = null;

fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });
fs.symlinkSync(path.join(root, "assets"), path.join(tempDir, "assets"), "dir");

function buildDeckFiles() {
  const source = fs.readFileSync(sourcePath, "utf8").replaceAll("_______", revision);
  fs.writeFileSync(tempPath, source);

  const theme = fs
    .readFileSync(themePath, "utf8")
    .replace('@import "pitch-adjustments.css";', fs.readFileSync(adjustmentsPath, "utf8"));
  fs.writeFileSync(tempThemePath, theme);
}

function scheduleRenderUpdate() {
  if (!isWatchMode) return;
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    try {
      buildDeckFiles();
    } catch (error) {
      process.stderr.write(`[deck] failed to rebuild temp deck files: ${error.message}\n`);
    }
  }, 120);
}

buildDeckFiles();

if (isWatchMode) {
  const watchTargets = [sourcePath, themePath, adjustmentsPath];
  watchTargets.forEach((target) => {
    fs.watchFile(target, { persistent: true, interval: 250 }, scheduleRenderUpdate);
  });
}

const args = cliArgs.map((arg) => arg.replaceAll("{revision}", revision).replaceAll("{build}", build).replaceAll("{stem}", stem));
const useServerWatchMode = isWatchMode && isPreviewMode;
const inputPath = useServerWatchMode ? path.basename(tempPath) : tempPath;
const themeSetPath = useServerWatchMode ? path.basename(tempThemePath) : ".deck-render/pitch-theme.render.css";
if (useServerWatchMode) {
  args.forEach((arg, index) => {
    if (arg === "--theme-set" && index + 1 < args.length) {
      args[index + 1] = themeSetPath;
    }
  });
}

const inputDirArgs = useServerWatchMode ? ["-I", tempDir, inputPath] : [tempPath];
const command = [
  "bunx",
  "@marp-team/marp-cli",
  ...inputDirArgs,
  "--theme-set",
  themeSetPath,
  ...(useServerWatchMode ? ["--server"] : []),
  ...args,
];

const marp = childProcess.spawn(command[0], command.slice(1), {
  cwd: root,
  stdio: "inherit",
});

marp.on("exit", (code, signal) => {
  if (!isWatchMode) {
    process.exitCode = signal ? 1 : code;
    return;
  }
  process.exitCode = signal ? 1 : code;
});
