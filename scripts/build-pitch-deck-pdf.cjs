const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const { getBuildInfo } = require("./deck-build-info.cjs");

const { root, exportsDir, stem } = getBuildInfo();
const inputPattern = path.join(root, ".deck-pages", `${stem}.*.png`);
const renderDir = path.join(root, ".deck-render");
const rawOutputPath = path.join(renderDir, `${stem}.raw.pdf`);
const outputPath = path.join(exportsDir, `${stem}.pdf`);
const quartzFilterPath = "/System/Library/Filters/Reduce File Size.qfilter";
const quartzScriptPath = path.join(root, "scripts", "apply-quartz-filter.swift");

fs.mkdirSync(renderDir, { recursive: true });

childProcess.execFileSync("magick", [inputPattern, rawOutputPath], {
  cwd: root,
  stdio: "inherit",
});

childProcess.execFileSync("swift", [quartzScriptPath, rawOutputPath, outputPath, quartzFilterPath], {
  cwd: root,
  stdio: "inherit",
});

fs.rmSync(rawOutputPath, { force: true });
