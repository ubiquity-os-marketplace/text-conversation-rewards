import { config } from "dotenv";
import { IssueParams, parseGitHubUrl } from "../start";
import linkPulls from "./link-pulls";

import ISSUE_CROSS_REPO_LINK from "./fixtures/issue-89.json"; // pr188 is linked to this issue
import ISSUE_SAME_REPO_LINK from "./fixtures/issue-90.json"; // pr91 is linked to this issue
import ISSUE_NO_LINK from "./fixtures/issue-92.json"; // no link

import pr21 from "./fixtures/pr-21.json";

import PR_CROSS_REPO_LINK from "./fixtures/pr-188.json";
import PR_SAME_REPO_LINK from "./fixtures/pr-91.json";

const PARAMS_ISSUE_CROSS_REPO_LINK: IssueParams = parseGitHubUrl(ISSUE_CROSS_REPO_LINK.html_url); // cross repo link
const PARAMS_ISSUE_SAME_REPO_LINK: IssueParams = parseGitHubUrl(ISSUE_SAME_REPO_LINK.html_url); // same repo link
const PARAMS_ISSUE_NO_LINK: IssueParams = parseGitHubUrl(ISSUE_NO_LINK.html_url); // no link
// const PARAMS_PR_CROSS_REPO_LINK: IssueParams = parseGitHubUrl(PR_CROSS_REPO_LINK.html_url);
// const PARAMS_PR_SAME_REPO_LINK: IssueParams = parseGitHubUrl(PR_SAME_REPO_LINK.html_url);

config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.warn("GITHUB_TOKEN is not set");
}
// Mock process.argv
process.argv = ["path/to/node", "path/to/script", `--auth=${GITHUB_TOKEN}`];

describe("linkPulls", () => {
  it("should return null if there is no link event on the issue", async () => {
    const result = await linkPulls(PARAMS_ISSUE_NO_LINK);
    expect(result).toBeNull();
  });

  it("should find the linked PULL REQUEST, starting from the ISSUE, in the SAME REPOSITORY", async () => {
    const result = await linkPulls(PARAMS_ISSUE_SAME_REPO_LINK);
    const expected = { issue: { html_url: PR_SAME_REPO_LINK.html_url } };
    expect(result).toMatchObject(expected);
  });

  it("should find the linked PULL REQUEST, starting from the ISSUE, across ANY REPOSITORY (within the organization)", async () => {
    const result = await linkPulls(PARAMS_ISSUE_CROSS_REPO_LINK);
    const expected = { issue: { html_url: PR_CROSS_REPO_LINK.html_url } };
    expect(result).toMatchObject(expected);
  });

  it("ubiquibot/comment-incentives/issues/22: should find the linked PULL REQUEST, starting from the ISSUE, in the SAME REPOSITORY", async () => {
    const result = await linkPulls(parseGitHubUrl("https://github.com/ubiquibot/comment-incentives/issues/22"));
    const expected = { issue: { html_url: expect.stringMatching(/\/pull\/\d+$/) } };
    expect(result).toMatchObject(expected);
  });

  it("ubiquibot/comment-incentives/issues/3: should find the linked PULL REQUEST, starting from the ISSUE, in the SAME REPOSITORY", async () => {
    const result = await linkPulls(parseGitHubUrl("https://github.com/ubiquibot/comment-incentives/issues/3"));
    const expected = { issue: { html_url: expect.stringMatching(/\/pull\/\d+$/) } };
    expect(result).toMatchObject(expected);
  });

  it("ubiquibot/comment-incentives/issues/15: should find the linked PULL REQUEST, starting from the ISSUE, in the SAME REPOSITORY", async () => {
    const result = await linkPulls(parseGitHubUrl("https://github.com/ubiquibot/comment-incentives/issues/15"));
    const expected = { issue: { html_url: expect.stringMatching(/\/pull\/\d+$/) } };
    expect(result).toMatchObject(expected);
  });

  it("ubiquibot/comment-incentives/issues/19: should find the linked PULL REQUEST, starting from the ISSUE, in the SAME REPOSITORY", async () => {
    const result = await linkPulls(parseGitHubUrl("https://github.com/ubiquibot/comment-incentives/issues/19"));

    // console.dir(result, { depth: null });

    const expected = { issue: { html_url: pr21.html_url } };
    expect(result).toMatchObject(expected);
  });

  // @DEV: no need to over-engineer. We only need to link the pull request from the issue, not the other way around.

  // it("should find the linked ISSUE, starting from the PULL REQUEST, in the SAME REPOSITORY", async () => {
  //   const result = await linkPulls(PARAMS_PR_SAME_REPO_LINK);

  //   const expected = { issue: { node_id: ISSUE_SAME_REPO_LINK.node_id } };
  //   expect(result).toMatchObject(expected);
  // });

  // it("should find the linked ISSUE, starting from the PULL REQUEST, across ANY REPOSITORY (within the organization)", async () => {
  //   const result = await linkPulls(PARAMS_PR_CROSS_REPO_LINK);
  //   const expected = { issue: { node_id: ISSUE_CROSS_REPO_LINK.node_id } };
  //   expect(result).toMatchObject(expected);
  // });
});
