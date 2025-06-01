import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Reassemble the file parts
(function reassembleParts(dir) {
  if (!fs.existsSync(dir)) return;
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
    parts.forEach((part) => {
      const partPath = path.join(dir, part.file);
      const data = fs.readFileSync(partPath);
      writeStream.write(data);
    });
    writeStream.end();
    parts.forEach((part) => fs.unlinkSync(path.join(dir, part.file)));
    console.log(`Reassembled ${outPath}`);
  }
})(path.join(__dirname, "./plugin"));

// Execute the main script
import "./plugin/index.js";
