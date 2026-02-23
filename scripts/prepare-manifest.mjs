#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const projectRoot = process.cwd();

const localCandidates = [
  resolve(projectRoot, ".github/scripts/update-manifest.js"),
  resolve(projectRoot, "../action-deploy-plugin/.github/scripts/update-manifest.js"),
  resolve(projectRoot, "../_wt/action-deploy-plugin-320/.github/scripts/update-manifest.js"),
];

let scriptPath = localCandidates.find((candidate) => existsSync(candidate));
let cleanupDir = null;

if (!scriptPath) {
  const url =
    "https://raw.githubusercontent.com/ubiquity-os/action-deploy-plugin/feat/320-dist-artifact-branches/.github/scripts/update-manifest.js";
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download manifest generator: ${response.status} ${response.statusText}`);
  }
  cleanupDir = mkdtempSync(join(tmpdir(), "uos-manifest-"));
  scriptPath = join(cleanupDir, "update-manifest.js");
  writeFileSync(scriptPath, await response.text(), "utf8");
}

const result = spawnSync(process.execPath, [scriptPath, projectRoot], {
  stdio: "inherit",
  env: process.env,
});

if (cleanupDir) {
  rmSync(cleanupDir, { recursive: true, force: true });
}

process.exit(result.status ?? 1);
