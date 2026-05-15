import { isCollaborative, nonAssigneeApprovedReviews } from "../../src/helpers/checkers";
import type { GitHubPullRequestReviewState } from "../../src/github-types";
import type { IssueActivity } from "../../src/issue-activity";

type User = {
  id: number;
  login: string;
  type: string;
};

const author = { id: 1, login: "author", type: "User" };
const assignee = { id: 2, login: "assignee", type: "User" };
const reviewer = { id: 3, login: "reviewer", type: "User" };
const issueAuthor = { id: 4, login: "issue-author", type: "User" };
const outsideReviewer = { id: 5, login: "outside-reviewer", type: "User" };
const bot = { id: 99, login: "bot[bot]", type: "Bot" };
const otherHuman = { id: 100, login: "other-human", type: "User" };

function createReview(
  user: User,
  state: GitHubPullRequestReviewState["state"] = "APPROVED",
  authorAssociation: GitHubPullRequestReviewState["author_association"] = "MEMBER"
) {
  return {
    author_association: authorAssociation,
    state,
    user,
  } as GitHubPullRequestReviewState;
}

type ActivityOptions = {
  pullRequestContext?: boolean;
  issueAssignee?: User;
  linkedIssueAuthor?: User;
  reviews?: GitHubPullRequestReviewState[];
  requestedReviewers?: User[];
  closedBy?: User;
  events?: Array<{ event: string; actor: User; label?: { name: string } }>;
};

function createActivity({
  pullRequestContext = false,
  issueAssignee,
  linkedIssueAuthor,
  reviews = [],
  requestedReviewers = [],
  closedBy,
  events = [],
}: ActivityOptions) {
  return {
    self: {
      user: author,
      closed_by: closedBy ?? author,
      assignee: issueAssignee,
      pull_request: pullRequestContext ? { html_url: "https://github.com/owner/repo/pull/1" } : undefined,
    },
    events,
    linkedMergedPullRequests: [
      {
        self: {
          user: author,
          requested_reviewers: requestedReviewers,
        },
        reviews,
      },
    ],
    linkedIssues: linkedIssueAuthor
      ? [
          {
            node: {
              author: linkedIssueAuthor,
            },
          },
        ]
      : [],
  } as unknown as Readonly<IssueActivity>;
}

describe("collaboration checks", () => {
  describe("nonAssigneeApprovedReviews", () => {
    it("uses PR reviews when the reward context is a pull request without assignees", () => {
      const activity = createActivity({
        pullRequestContext: true,
        reviews: [createReview(reviewer)],
      });

      expect(nonAssigneeApprovedReviews(activity)).toBe(true);
      expect(isCollaborative(activity)).toBe(true);
    });

    it("does not count the PR author's own approval in pull request context", () => {
      const activity = createActivity({
        pullRequestContext: true,
        reviews: [createReview(author)],
      });

      expect(nonAssigneeApprovedReviews(activity)).toBe(false);
      expect(isCollaborative(activity)).toBe(false);
    });

    it("does not count non-collaborator approvals in pull request context", () => {
      const activity = createActivity({
        pullRequestContext: true,
        reviews: [createReview(reviewer, "APPROVED", "CONTRIBUTOR"), createReview(outsideReviewer, "APPROVED", "NONE")],
      });

      expect(nonAssigneeApprovedReviews(activity)).toBe(false);
      expect(isCollaborative(activity)).toBe(false);
    });

    it("does not count linked issue author's approval in pull request context", () => {
      const activity = createActivity({
        pullRequestContext: true,
        linkedIssueAuthor: issueAuthor,
        reviews: [createReview(issueAuthor)],
      });

      expect(nonAssigneeApprovedReviews(activity)).toBe(false);
      expect(isCollaborative(activity)).toBe(false);
    });

    it("does not count review comments as approved reviews in pull request context", () => {
      const activity = createActivity({
        pullRequestContext: true,
        reviews: [createReview(reviewer, "COMMENTED"), createReview(author, "COMMENTED")],
      });

      expect(nonAssigneeApprovedReviews(activity)).toBe(false);
      expect(isCollaborative(activity)).toBe(false);
    });

    it("does not treat an empty PR review list as collaborative", () => {
      const activity = createActivity({
        pullRequestContext: true,
      });

      expect(nonAssigneeApprovedReviews(activity)).toBe(false);
      expect(isCollaborative(activity)).toBe(false);
    });

    it("keeps the issue-context assignee behavior", () => {
      const activity = createActivity({
        issueAssignee: assignee,
        reviews: [createReview(reviewer)],
      });

      expect(nonAssigneeApprovedReviews(activity)).toBe(true);
      expect(isCollaborative(activity)).toBe(true);
    });

    it("does not treat an empty issue-context review list as collaborative", () => {
      const activity = createActivity({
        issueAssignee: assignee,
      });

      expect(nonAssigneeApprovedReviews(activity)).toBe(false);
      expect(isCollaborative(activity)).toBe(false);
    });
  });

  describe("isCollaborative - bot closed_by should not count as collaboration", () => {
    it("does not count bot closing the issue as collaborative", () => {
      const activity = createActivity({
        closedBy: bot,
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("counts a different human closing the issue as collaborative", () => {
      const activity = createActivity({
        closedBy: otherHuman,
      });

      expect(isCollaborative(activity)).toBe(true);
    });

    it("counts same-author closing as non-collaborative when no other signals", () => {
      const activity = createActivity({
        closedBy: author,
      });

      expect(isCollaborative(activity)).toBe(false);
    });
  });

  describe("isCollaborative - assignment by different human", () => {
    it("counts assignment by a different human as collaborative", () => {
      const activity = createActivity({
        issueAssignee: assignee,
        events: [{ event: "assigned", actor: otherHuman }],
      });

      expect(isCollaborative(activity)).toBe(true);
    });

    it("does not count self-assignment as collaborative", () => {
      const activity = createActivity({
        issueAssignee: assignee,
        events: [{ event: "assigned", actor: assignee }],
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("does not count bot assignment as collaborative", () => {
      const activity = createActivity({
        issueAssignee: assignee,
        events: [{ event: "assigned", actor: bot }],
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("counts assignment by author (different from assignee) as collaborative", () => {
      const activity = createActivity({
        issueAssignee: assignee,
        events: [{ event: "assigned", actor: author }],
      });

      expect(isCollaborative(activity)).toBe(true);
    });
  });

  describe("isCollaborative - combined signals", () => {
    it("counts pricing labels by non-assignee as collaborative even when closed by same author", () => {
      const activity = createActivity({
        closedBy: author,
        events: [{ event: "labeled", actor: otherHuman, label: { name: "Time: 1h" } }],
      });

      expect(isCollaborative(activity)).toBe(true);
    });

    it("is not collaborative when all actions are by the same user with no reviews", () => {
      const activity = createActivity({
        closedBy: author,
        events: [{ event: "assigned", actor: author }],
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("is collaborative when bot closes but human reviewed", () => {
      const activity = createActivity({
        closedBy: bot,
        issueAssignee: assignee,
        reviews: [createReview(reviewer)],
      });

      expect(isCollaborative(activity)).toBe(true);
    });
  });
});
