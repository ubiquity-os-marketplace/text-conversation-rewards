import { ContextPlugin } from "../types/plugin-input";

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

const DEFAULT_EXCLUDED_PATTERNS = ["dist/**", "*.lockb", "*.lock", "tests/__mocks__/", "bin/"];

function parsePrettierIgnore(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function parseTsConfigExclude(content: string): string[] {
  const patterns: string[] = [];
  try {
    const excludeRegex = /"exclude"\s*:\s*\[([^\]]*)\]/;
    const match = RegExp(excludeRegex).exec(content);
    if (match && match[1]) {
      const excludeContent = match[1];
      const stringLiteralRegex = /"([^"]*)"/g;
      let stringMatch;
      while ((stringMatch = stringLiteralRegex.exec(excludeContent)) !== null) {
        if (stringMatch[1]) {
          patterns.push(stringMatch[1]);
        }
      }
    }
  } catch {
    // Silently ignore parsing errors, returning patterns found so far
  }
  return patterns;
}

export async function getExcludedFiles(
  context: ContextPlugin,
  owner: string,
  repo: string,
  ref?: string
): Promise<string[]> {
  const allPatterns = [...DEFAULT_EXCLUDED_PATTERNS];

  const [gitAttributesContent, prettierIgnoreContent, tsConfigContent] = await Promise.all([
    getFileContent(context, owner, repo, ".gitattributes", ref),
    getFileContent(context, owner, repo, ".prettierignore", ref),
    getFileContent(context, owner, repo, "tsconfig.json", ref),
  ]);

  if (gitAttributesContent) {
    const gitAttributesLinguistGenerated = (await parseGitAttributes(gitAttributesContent))
      .filter((v) => v.attributes["linguist-generated"])
      .map((v) => v.pattern);
    allPatterns.push(...gitAttributesLinguistGenerated);
  }

  if (prettierIgnoreContent) {
    const prettierPatterns = parsePrettierIgnore(prettierIgnoreContent);
    allPatterns.push(...prettierPatterns);
  }

  if (tsConfigContent) {
    const tsConfigPatterns = parseTsConfigExclude(tsConfigContent);
    allPatterns.push(...tsConfigPatterns);
  }

  return [...new Set(allPatterns)];
}

async function getFileContent(
  context: ContextPlugin,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<string | null> {
  try {
    const response = await context.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    // GitHub API returns content as base64
    if ("content" in response.data && !Array.isArray(response.data)) {
      return Buffer.from(response.data.content, "base64").toString("utf-8");
    }
    return null;
  } catch (err) {
    if (err instanceof Error && "status" in err && err.status === 404) {
      context.logger.info(
        `.gitattributes was not found for ${context.payload.repository.owner.login}/${context.payload.repository.name}`
      );
      return null;
    }
    throw context.logger.error(`Error fetching files to be excluded ${err}`);
  }
}
