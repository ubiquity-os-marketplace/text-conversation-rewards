const childProcess = require("child_process");
const path = require("path");
const { getBuildInfo } = require("./deck-build-info.cjs");

const { root, exportsDir, stem } = getBuildInfo();
const inputPattern = path.join(root, ".deck-pages", `${stem}.*.png`);
const outputPath = path.join(exportsDir, `${stem}.pdf`);

childProcess.execFileSync("magick", [inputPattern, outputPath], {
  cwd: root,
  stdio: "inherit",
});

