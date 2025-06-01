import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function reassembleParts(dir) {
  console.log("Reassembling parts in: " + dir);
  if (!fs.existsSync(dir)) {
    console.log("No files to reassemble.");
    return;
  }
  const files = fs.readdirSync(dir);
  const partGroups = {};
  files.forEach((file) => {
    console.log("Checking file: " + file);
    const match = file.match(/^(.*)\.part(\d+)$/);
    if (match) {
      const base = match[1];
      if (!partGroups[base]) partGroups[base] = [];
      partGroups[base].push({ file, index: parseInt(match[2], 10) });
    }
  });

  for (const base in partGroups) {
    const parts = partGroups[base].sort((a, b) => a.index - b.index);
    const outPath = path.join(dir, base);
    const writeStream = fs.createWriteStream(outPath);

    for (const part of parts) {
      const partPath = path.join(dir, part.file);
      const data = fs.readFileSync(partPath);
      writeStream.write(data);
    }
    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    parts.forEach((part) => fs.unlinkSync(path.join(dir, part.file)));
    console.log(`Reassembled ${outPath}`);
  }

  try {
    await import("./plugin/index.js");
    console.log("Plugin loaded successfully");
  } catch (err) {
    console.error("Failed to load plugin:", err);
  }
}

reassembleParts(path.join(__dirname, "./plugin")).catch((err) => {
  console.error("Error during reassembly:", err);
});
