import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixNodeImports(content) {
  let fixed = content;

  builtinModules.forEach((module) => {
    const escapedModule = module.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const patterns = [
      new RegExp(`require\\s*\\(\\s*["']${escapedModule}["']\\s*\\)`, "g"),
      new RegExp(`require\\s*\\(\\s*["']${escapedModule}/`, "g"),
      new RegExp(`from\\s+["']${escapedModule}["']`, "g"),
      new RegExp(`from\\s+["']${escapedModule}/`, "g"),
      new RegExp(`import\\s*\\(\\s*["']${escapedModule}["']\\s*\\)`, "g"),
      new RegExp(`import\\s*\\(\\s*["']${escapedModule}/`, "g"),
      new RegExp(`(\\}|\\s)from\\s*["']${escapedModule}["']`, "g"),
      new RegExp(`(\\}|\\s)from\\s*["']${escapedModule}/`, "g"),
    ];

    patterns.forEach((pattern) => {
      fixed = fixed.replace(pattern, (match) => {
        return match.replace(
          new RegExp(`["']${escapedModule}`, "g"),
          (quoteMatch) => {
            const quote = quoteMatch[0];
            return `${quote}node:${module}`;
          },
        );
      });
    });
  });

  return fixed;
}

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

  const generatedFiles = fs.readdirSync(dir);
  generatedFiles.forEach((file) => {
    console.log("[POST GENERATION] Checking file: " + file);
    if (file.endsWith(".js") || file.endsWith(".mjs")) {
      const filePath = path.join(dir, file);
      console.log(`Fixing Node.js imports in ${filePath}`);
      const content = fs.readFileSync(filePath, "utf8");
      const fixedContent = fixNodeImports(content);
      fs.writeFileSync(filePath, fixedContent, "utf8");
      console.log(`Fixed Node.js imports in ${file}`);
    }
  });

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
