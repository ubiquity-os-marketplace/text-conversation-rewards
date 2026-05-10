import { isCollaborative, nonAssigneeApprovedReviews } from "../../src/helpers/checkers";
import type { GitHubPullRequestReviewState } from "../../src/github-types";
import type { IssueActivity } from "../../src/issue-activity";

type User = {
  id: number;
  login: string;
  type?: string;
};

const author = { id: 1, login: "author" };
const assignee = { id: 2, login: "assignee" };
const reviewer = { id: 3, login: "reviewer" };
const issueAuthor = { id: 4, login: "issue-author" };
const outsideReviewer = { id: 5, login: "outside-reviewer" };
const bot = { id: 6, login: "github-actions[bot]", type: "Bot" };

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

function createActivity({
  pullRequestContext = false,
  closedBy = author,
  issueAssignee,
  linkedIssueAuthor,
  events = [],
  reviews = [],
  requestedReviewers = [],
}: {
  pullRequestContext?: boolean;
  closedBy?: User;
  issueAssignee?: User;
  linkedIssueAuthor?: User;
  events?: unknown[];
  reviews?: GitHubPullRequestReviewState[];
  requestedReviewers?: User[];
}) {
  return {
    self: {
      user: author,
      closed_by: closedBy,
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
  describe("isCollaborative", () => {
    it("treats a different human closer as collaborative", () => {
      const activity = createActivity({
        closedBy: reviewer,
      });

      expect(isCollaborative(activity)).toBe(true);
    });

    it("does not treat bot closure as human collaboration", () => {
      const activity = createActivity({
        closedBy: bot,
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("does not count bot-added pricing labels as human collaboration", () => {
      const activity = createActivity({
        events: [
          {
            actor: bot,
            event: "labeled",
            label: {
              name: "Time: <2 Hours",
            },
          },
        ],
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("counts human-added pricing labels as collaboration", () => {
      const activity = createActivity({
        events: [
          {
            actor: reviewer,
            event: "labeled",
            label: {
              name: "Priority: 2 (Medium)",
            },
          },
        ],
      });

      expect(isCollaborative(activity)).toBe(true);
    });
  });

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

    it("does not count bot approvals in pull request context", () => {
      const activity = createActivity({
        pullRequestContext: true,
        reviews: [createReview(bot)],
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
});
