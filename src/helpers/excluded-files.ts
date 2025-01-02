import { readFile } from "fs/promises";

interface GitAttributes {
  pattern: string;
  attributes: { [key: string]: string | boolean };
}

async function parseGitAttributes(content: string): Promise<GitAttributes[]> {
  const lines = content.split("\n");
  return lines
    .map((line) => {
      line = line.trim();
      if (!line || line.startsWith("#")) return null;

      const parts = line.split(/\s+/);
      if (parts.length < 2) return null;

      const pattern = parts[0];
      const attributes: { [key: string]: string | boolean } = {};

      for (let i = 1; i < parts.length; i++) {
        const attr = parts[i];
        if (attr.includes("=")) {
          const [key, value] = attr.split("=");
          attributes[key.trim()] = value.trim();
        } else {
          attributes[attr.trim()] = true;
        }
      }

      return { pattern, attributes };
    })
    .filter((item): item is GitAttributes => item !== null);
}

export async function getExcludedFiles() {
  const gitAttributesContent = await readFile(".gitattributes", "utf-8");
  const gitAttributesLinguistGenerated = (await parseGitAttributes(gitAttributesContent))
    .filter((v) => v.attributes["linguist-generated"])
    .map((v) => v.pattern);
  return gitAttributesLinguistGenerated;
}
