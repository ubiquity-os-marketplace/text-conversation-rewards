import { IssueParams, parseGitHubUrl } from "../start";

import ISSUE_CROSS_REPO_LINK from "./fixtures/issue-89.json"; // pr188 is linked to this issue
import ISSUE_SAME_REPO_LINK from "./fixtures/issue-90.json"; // pr91 is linked to this issue
import ISSUE_NO_LINK from "./fixtures/issue-92.json"; // no link

import { collectLinkedMergedPulls, collectLinkedPulls } from "./collect-linked-pulls";
import PR_CROSS_REPO_LINK from "./fixtures/pr-188.json";
import PR_SAME_REPO_LINK from "./fixtures/pr-91.json";

const PARAMS_ISSUE_CROSS_REPO_LINK: IssueParams = parseGitHubUrl(ISSUE_CROSS_REPO_LINK.html_url); // cross repo link
const PARAMS_ISSUE_SAME_REPO_LINK: IssueParams = parseGitHubUrl(ISSUE_SAME_REPO_LINK.html_url); // same repo link
const PARAMS_ISSUE_NO_LINK: IssueParams = parseGitHubUrl(ISSUE_NO_LINK.html_url); // no link
// const PARAMS_PR_CROSS_REPO_LINK: IssueParams = parseGitHubUrl(PR_CROSS_REPO_LINK.html_url);
// const PARAMS_PR_SAME_REPO_LINK: IssueParams = parseGitHubUrl(PR_SAME_REPO_LINK.html_url);

describe("Artificial scenarios for linking pull requests to issues", () => {
  it("should return an empty array when the issue does not have any associated link events", async () => {
    const result = await collectLinkedMergedPulls(PARAMS_ISSUE_NO_LINK);
    expect(result).toEqual([]);
  });

  it("should identify and return the merged, linked pull requests that originate from the same issue within the same repository", async () => {
    const result = await collectLinkedMergedPulls(PARAMS_ISSUE_SAME_REPO_LINK);
    const expectedUrl = PR_SAME_REPO_LINK.html_url;
    const matchingLinks = result.filter((link) => link.source.issue.html_url === expectedUrl);
    expect(matchingLinks.length).toBe(1);
  });

  it("should identify and return the merged, linked pull requests that originate from a specific issue, regardless of the repository they are located in within the organization", async () => {
    const result = await collectLinkedMergedPulls(PARAMS_ISSUE_CROSS_REPO_LINK);
    const expectedUrl = PR_CROSS_REPO_LINK.html_url;
    const matchingLinks = result.filter((link) => link.source.issue.html_url === expectedUrl);
    expect(matchingLinks.length).toBe(1);
  });
});

describe("Real-world scenarios for linking pull requests to issues", () => {
  it("For the issue 'ubiquibot/comment-incentives/issues/22', the test should identify and return all the merged, linked pull requests that originate from this issue within the same repository 'ubiquibot/comment-incentives'", async () => {
    const result = await collectLinkedMergedPulls(
      parseGitHubUrl("https://github.com/ubiquibot/comment-incentives/issues/22")
    );
    const expectedUrl = "https://github.com/ubiquibot/comment-incentives/pull/25";
    result.forEach((res) => expect(res.source.issue.html_url).toMatch(/\/pull\/\d+$/));
    const matchingLinks = result.filter((res) => res.source.issue.html_url === expectedUrl);
    expect(matchingLinks.length).toBeGreaterThan(0);
  });

  it("For the issue 'ubiquity/pay.ubq.fi/issues/138', the test should identify and return all the linked pull requests that originate from this issue within the same repository 'ubiquity/pay.ubq.fi'", async () => {
    const result = await collectLinkedPulls(parseGitHubUrl("https://github.com/ubiquity/pay.ubq.fi/issues/138"));
    const expectedUrl = "https://github.com/ubiquity/pay.ubq.fi/pull/173";
    result.forEach((res) => expect(res.source.issue.html_url).toMatch(/\/pull\/\d+$/));
    const matchingLinks = result.filter((res) => res.source.issue.html_url === expectedUrl);
    expect(matchingLinks.length).toBeGreaterThan(0);
  });

  it("For the issue 'ubiquibot/comment-incentives/issues/3', the test should identify and return all the merged, linked pull requests that originate from this issue within the same repository 'ubiquibot/comment-incentives'", async () => {
    const result = await collectLinkedMergedPulls(
      parseGitHubUrl("https://github.com/ubiquibot/comment-incentives/issues/3")
    );
    const expectedUrl = "https://github.com/ubiquibot/comment-incentives/pull/4";
    result.forEach((res) => expect(res.source.issue.html_url).toMatch(/\/pull\/\d+$/));
    const matchingLinks = result.filter((res) => res.source.issue.html_url === expectedUrl);
    expect(matchingLinks.length).toBeGreaterThan(0);
  });

  it("For the issue 'ubiquibot/comment-incentives/issues/15', the test should identify and return all the merged, linked pull requests that originate from this issue within the same repository 'ubiquibot/comment-incentives'", async () => {
    const result = await collectLinkedMergedPulls(
      parseGitHubUrl("https://github.com/ubiquibot/comment-incentives/issues/15")
    );
    const expectedUrl = "https://github.com/ubiquibot/comment-incentives/pull/16";
    result.forEach((res) => expect(res.source.issue.html_url).toMatch(/\/pull\/\d+$/));
    const matchingLinks = result.filter((res) => res.source.issue.html_url === expectedUrl);
    expect(matchingLinks.length).toBeGreaterThan(0);
  });

  it("For the issue 'ubiquibot/comment-incentives/issues/19', the test should identify and return all the merged, linked pull requests that originate from this issue within the same repository 'ubiquibot/comment-incentives'", async () => {
    const result = await collectLinkedMergedPulls(
      parseGitHubUrl("https://github.com/ubiquibot/comment-incentives/issues/19")
    );
    const expectedUrls = [
      "https://github.com/ubiquibot/comment-incentives/pull/21",
      "https://github.com/ubiquibot/comment-incentives/pull/23",
    ];
    expectedUrls.forEach((url) => {
      const matchingLinks = result.filter((res) => res.source.issue.html_url === url);
      expect(matchingLinks.length).toBeGreaterThan(0);
    });
  });
});

// @DEV: no need to over-engineer. We only need to link the pull request from the issue, not the other way around.

// it("should find the linked ISSUE, starting from the PULL REQUEST, in the SAME REPOSITORY", async () => {
//   const result = await linkPulls(PARAMS_PR_SAME_REPO_LINK);

//   const expected = [{ issue: { node_id: ISSUE_SAME_REPO_LINK.node_id } }];
//   expect(result).toMatchObject(expected);
// });

// it("should find the linked ISSUE, starting from the PULL REQUEST, across ANY REPOSITORY (within the organization)", async () => {
//   const result = await linkPulls(PARAMS_PR_CROSS_REPO_LINK);
//   const expected = [{ issue: { node_id: ISSUE_CROSS_REPO_LINK.node_id } }];
//   expect(result).toMatchObject(expected);
// });

// describe("Collect activity from issue 'https://github.com/ubiquibot/production/issues/92'", () => {
//   const ISSUE_92_URL = "https://github.com/ubiquibot/production/issues/92";

//   // it("should collect all user activity from the issue and linked pull requests", async () => {
//   //   const issueParams = parseGitHubUrl("https://github.com/ubiquibot/production/issues/92");
//   //   const issueEvents = await getIssueEvents(issueParams);
//   //   const userEvents = issueEvents.filter((event) => event.user?.type === "User" || event.actor?.type === "User");
//   //   console.dir(userEvents, { depth: null , colors: true });
//   // });

//   it("should collect the issue", async () => {
//     const issueParams = parseGitHubUrl(ISSUE_92_URL);
//     const issue = await getIssue(issueParams);
//     console.dir(issue, { depth: null, colors: true });
//   });

//   it("should collect the issue events", async () => {
//     const issueParams = parseGitHubUrl(ISSUE_92_URL);
//     const issueEvents = await getIssueEvents(issueParams);
//     console.dir(issueEvents, { depth: null, colors: true });
//   });

//   it("should collect the issue comments", async () => {
//     const issueParams = parseGitHubUrl(ISSUE_92_URL);
//     const issueComments = await getIssueComments(issueParams);
//     console.dir(issueComments, { depth: null, colors: true });
//   });
// });

// describe("Categorize users based on their contributions", () => {
//   const ISSUE_92_URL = "https://github.com/ubiquibot/production/issues/92";

//   it("should categorize users based on their contributions to the issue and linked pull requests", async () => {
//     const issueParams = parseGitHubUrl(ISSUE_92_URL);
//     const issueEvents = await getIssueEvents(issueParams);
//     const userEvents = issueEvents.filter((event) => event.user?.type === "User" || event.actor?.type === "User");
//     console.dir(userEvents, { depth: null, colors: true });
//   });
// });
