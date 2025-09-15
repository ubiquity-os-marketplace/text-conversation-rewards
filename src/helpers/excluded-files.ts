import { ContextPlugin } from "../types/plugin-input";
import { minimatch } from "minimatch";
import { basename } from "path";

interface GitAttributes {
  pattern: string;
  attributes: { [key: string]: string | boolean };
}

function parseGitAttributes(content: string): GitAttributes[] {
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
        let attr = parts[i].trim();
        if (!attr) continue;

        let isNegated = false;
        if (attr.startsWith("!") || attr.startsWith("-")) {
          isNegated = true;
          attr = attr.slice(1);
        }

        if (attr.includes("=")) {
          const [rawKey, rawValue] = attr.split("=");
          const key = rawKey.trim();
          attributes[key] = rawValue.trim();
        } else {
          const key = attr.trim();
          attributes[key] = !isNegated;
        }
      }

      return { pattern, attributes };
    })
    .filter((item): item is GitAttributes => item !== null);
}

const DEFAULT_GITATTRIBUTES = `
* linguist-generated
*.ts !linguist-generated
`;

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

function matchesGitPattern(filePath: string, pattern: string): boolean {
  if (!pattern) return false;

  if (pattern.includes("/")) {
    return minimatch(filePath, pattern, { matchBase: false });
  } else {
    return minimatch(basename(filePath), pattern) || minimatch(filePath, `**/${pattern}`);
  }
}

export async function getExcludedFiles(
  context: ContextPlugin,
  owner: string,
  repo: string,
  ref?: string
): Promise<string[]> {
  const allPatterns: string[] = [];

  const [gitAttributesContent, prettierIgnoreContent, tsConfigContent] = await Promise.all([
    getFileContent(context, owner, repo, ".gitattributes", ref),
    getFileContent(context, owner, repo, ".prettierignore", ref),
    getFileContent(context, owner, repo, "tsconfig.json", ref),
  ]);

  const parsed = [
    ...parseGitAttributes(DEFAULT_GITATTRIBUTES),
    ...(gitAttributesContent ? parseGitAttributes(gitAttributesContent) : []),
  ];
  for (const entry of parsed) {
    if (Object.prototype.hasOwnProperty.call(entry.attributes, "linguist-generated")) {
      const val = entry.attributes["linguist-generated"];
      const isTrue = typeof val === "boolean" ? val : String(val).toLowerCase() === "true";
      allPatterns.push(isTrue ? entry.pattern : `!${entry.pattern}`);
    }
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
      context.logger.info(`[${path}] was not found for ${owner}/${repo}`, { err });
      return null;
    }
    throw context.logger.error(`Could not fetch the list of files to be excluded.`, {
      err,
    });
  }
}

export function isExcluded(filePath: string, patterns?: string[] | null): boolean {
  if (!patterns?.length) return false;
  let isExcluded = false;

  for (const originalPattern of patterns) {
    if (!originalPattern) continue;
    const isNeg = originalPattern.startsWith("!");
    let pattern = isNeg ? originalPattern.slice(1) : originalPattern;

    if (pattern.endsWith("/")) {
      pattern = `${pattern}**`;
    }

    if (matchesGitPattern(filePath, pattern)) {
      isExcluded = !isNeg;
    }
  }

  return isExcluded;
}
