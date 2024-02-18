import { config } from "dotenv";
import { parseGitHubUrl } from "../start";
import issue84 from "./fixtures/issue-84.json";
import issue89 from "./fixtures/issue-89.json";
import pr188 from "./fixtures/pr-188.json";
import pr88 from "./fixtures/pr-88.json";
import linkPulls from "./link-pulls";
config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.warn("GITHUB_TOKEN is not set");
}

const i84Params = parseGitHubUrl(issue84.html_url);
const i89Params = parseGitHubUrl(issue89.html_url);

// Mock process.argv
process.argv = ["path/to/node", "path/to/script", `--auth=${GITHUB_TOKEN}`];

describe("linkPulls", () => {
  it("should return null if there is no link event on the issue", async () => {
    const result = await linkPulls(i84Params);
    expect(result).toBeNull();
  });

  it("should find the linked pull request in the current repository", async () => {
    const result = await linkPulls(i84Params);
    expect(result).toEqual(pr88);
  });

  it("should search across other repositories if linked pull request is not found in the current repository", async () => {
    const result = await linkPulls(i89Params);
    expect(result).toEqual(pr188);
  });
});
