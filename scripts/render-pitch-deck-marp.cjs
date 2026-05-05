const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const { getBuildInfo } = require("./deck-build-info.cjs");

const { root, revision, build, stem } = getBuildInfo();
const sourcePath = path.join(root, "pitch-deck.md");
const tempDir = path.join(root, ".deck-render");
const tempPath = path.join(tempDir, "pitch-deck.md");

fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });
fs.symlinkSync(path.join(root, "assets"), path.join(tempDir, "assets"), "dir");

const source = fs.readFileSync(sourcePath, "utf8").replaceAll("0000000", revision);
fs.writeFileSync(tempPath, source);

const args = process.argv
  .slice(2)
  .map((arg) => arg.replaceAll("{revision}", revision).replaceAll("{build}", build).replaceAll("{stem}", stem));
const command = [
  "bunx",
  "@marp-team/marp-cli",
  tempPath,
  "--theme-set",
  ".deck-render/assets/pitch/pitch-theme.css",
  ...args,
];

childProcess.execFileSync(command[0], command.slice(1), {
  cwd: root,
  stdio: "inherit",
});
