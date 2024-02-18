import { config } from "dotenv";
import { parseGitHubUrl } from "../start";
import linkPulls from "./link-pulls";

import issue89 from "./fixtures/issue-89.json"; // pr188 is linked to this issue
import issue90 from "./fixtures/issue-90.json"; // pr91 is linked to this issue
import issue92 from "./fixtures/issue-92.json";

import pr188 from "./fixtures/pr-188.json";
import pr91 from "./fixtures/pr-91.json";

config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.warn("GITHUB_TOKEN is not set");
}
// Mock process.argv
process.argv = ["path/to/node", "path/to/script", `--auth=${GITHUB_TOKEN}`];

const issueNoLink = parseGitHubUrl(issue92.html_url); // no link
const issueCrossRepoLink = parseGitHubUrl(issue89.html_url); // cross repo link
const issueSameRepoLink = parseGitHubUrl(issue90.html_url); // same repo link

const prCrossRepoLink = parseGitHubUrl(pr188.html_url);
const prSameRepoLink = parseGitHubUrl(pr91.html_url);

describe("linkPulls", () => {
  it("should return null if there is no link event on the issue", async () => {
    const result = await linkPulls(issueNoLink);
    expect(result).toBeNull();
  });

  it("should find the linked pull request in the current repository", async () => {
    const result = await linkPulls(prSameRepoLink);
    expect(result).toEqual(issue90);
  });

  it("should search across other repositories if linked pull request is not found in the current repository", async () => {
    const result = await linkPulls(issueCrossRepoLink);
    expect(result).toEqual(pr188);
  });
});
