#!/usr/bin/env node
import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(projectRoot, "engine", "generated-datasets");
const targetDir = path.join(projectRoot, "public", "engine", "generated-datasets");

function ensureSourceExists() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(
      `Source datasets directory not found: ${sourceDir}. ` +
        "Run your engine generator before syncing."
    );
  }
}

function removeTarget() {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
}

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function syncDatasets() {
  ensureSourceExists();
  removeTarget();
  copyRecursive(sourceDir, targetDir);
  console.log(
    `Copied datasets from ${path.relative(projectRoot, sourceDir)} to ${
      path.relative(projectRoot, targetDir)
    }`
  );
}

try {
  syncDatasets();
} catch (error) {
  console.error("Failed to sync datasets:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
