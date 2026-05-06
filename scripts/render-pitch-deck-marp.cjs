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

fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });
fs.symlinkSync(path.join(root, "assets"), path.join(tempDir, "assets"), "dir");

const source = fs.readFileSync(sourcePath, "utf8").replaceAll("_______", revision);
fs.writeFileSync(tempPath, source);

const theme = fs
  .readFileSync(themePath, "utf8")
  .replace('@import "pitch-adjustments.css";', fs.readFileSync(adjustmentsPath, "utf8"));
fs.writeFileSync(tempThemePath, theme);

const args = process.argv
  .slice(2)
  .map((arg) => arg.replaceAll("{revision}", revision).replaceAll("{build}", build).replaceAll("{stem}", stem));
const command = [
  "bunx",
  "@marp-team/marp-cli",
  tempPath,
  "--theme-set",
  ".deck-render/pitch-theme.render.css",
  ...args,
];

childProcess.execFileSync(command[0], command.slice(1), {
  cwd: root,
  stdio: "inherit",
});
