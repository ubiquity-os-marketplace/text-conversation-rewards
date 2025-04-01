import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ContextPlugin } from "../types/plugin-input";

const INVALID_ISSUES_PATH = path.resolve(__dirname, "../../invalid-issues.json");

export async function logInvalidIssue(logger: ContextPlugin["logger"], issueUrl: string) {
  let invalidIssues: string[] = [];

  try {
    if (existsSync(INVALID_ISSUES_PATH)) {
      const fileContent = readFileSync(INVALID_ISSUES_PATH, "utf-8");
      const parsedContent = JSON.parse(fileContent);
      if (Array.isArray(parsedContent) && parsedContent.every((item) => typeof item === "string")) {
        invalidIssues = parsedContent;
      } else {
        logger.error("invalid-issues.json does not contain a valid string array. Initializing with an empty array.");
      }
    }
  } catch (error) {
    logger.error("Error reading or parsing invalid-issues.json", { error: error as Error });
  }

  if (!invalidIssues.includes(issueUrl)) {
    invalidIssues.push(issueUrl);
    try {
      writeFileSync(INVALID_ISSUES_PATH, JSON.stringify(invalidIssues, null, 2));
    } catch (error) {
      logger.error("Error writing to invalid-issues.json", { error: error as Error });
    }
  }
}
