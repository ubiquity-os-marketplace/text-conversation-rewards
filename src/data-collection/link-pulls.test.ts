import { config } from "dotenv";
import { parseGitHubUrl } from "../start";
import linkPulls from "./link-pulls";

// import issueNoLink from "./fixtures/issue-92.json"; // no link

import issueCrossRepoLink from "./fixtures/issue-89.json"; // pr188 is linked to this issue
import prCrossRepo from "./fixtures/pr-188.json";

import issueSameRepoLink from "./fixtures/issue-90.json"; // pr91 is linked to this issue
import prSameRepo from "./fixtures/pr-91.json";

config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.warn("GITHUB_TOKEN is not set");
}
// Mock process.argv
process.argv = ["path/to/node", "path/to/script", `--auth=${GITHUB_TOKEN}`];

// const issueNoLinkParams = parseGitHubUrl(issueNoLink.html_url); // no link
const issueCrossRepoLinkParams = parseGitHubUrl(issueCrossRepoLink.html_url); // cross repo link
const issueSameRepoLinkParams = parseGitHubUrl(issueSameRepoLink.html_url); // same repo link

// const prCrossRepoLink = parseGitHubUrl(prCrossRepo.html_url);
// const prSameRepoLink = parseGitHubUrl(prSameRepo.html_url);

describe("linkPulls", () => {
  // it("should return null if there is no link event on the issue", async () => {
  //   const result = await linkPulls(issueNoLink);
  //   expect(result).toBeNull();
  // });

  it("should find the linked pull request in the current repository", async () => {
    const result = await linkPulls(issueSameRepoLinkParams);
    const expected = { issue: { node_id: prSameRepo.node_id } };
    expect(result).toMatchObject(expected);
  });

  it("should search across other repositories if linked pull request is not found in the current repository", async () => {
    const result = await linkPulls(issueCrossRepoLinkParams);
    const expected = { issue: { node_id: prCrossRepo.node_id } };
    expect(result).toMatchObject(expected);
  });
});
