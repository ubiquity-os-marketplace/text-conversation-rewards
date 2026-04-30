import { isCollaborative, nonAssigneeApprovedReviews } from "../../src/helpers/checkers";
import type { GitHubPullRequestReviewState } from "../../src/github-types";
import type { IssueActivity } from "../../src/issue-activity";

type User = {
  id: number;
  login: string;
};

const author = { id: 1, login: "author" };
const assignee = { id: 2, login: "assignee" };
const reviewer = { id: 3, login: "reviewer" };
const issueAuthor = { id: 4, login: "issue-author" };
const outsideReviewer = { id: 5, login: "outside-reviewer" };
const botUser = { id: 100, login: "ubiquity-os" };
const botBeta = { id: 101, login: "ubiquity-os-beta" };
const ghActionsBot = { id: 102, login: "github-actions[bot]" };
const humanCollaborator = { id: 6, login: "human-collaborator" };

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
  issueAssignee,
  assignees,
  linkedIssueAuthor,
  reviews = [],
  requestedReviewers = [],
  closedBy,
  events = [],
}: {
  pullRequestContext?: boolean;
  issueAssignee?: User;
  assignees?: User[];
  linkedIssueAuthor?: User;
  reviews?: GitHubPullRequestReviewState[];
  requestedReviewers?: User[];
  closedBy?: User;
  events?: Array<{ event: string; actor: User; label?: { name: string } }>;
}) {
  return {
    self: {
      user: author,
      closed_by: closedBy ?? author,
      assignee: issueAssignee,
      assignees: assignees,
      pull_request: pullRequestContext ? { html_url: "https://github.com/owner/repo/pull/1" } : undefined,
    },
    events: events,
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

  describe("bot detection", () => {
    it("does not count bot-closed issues as collaborative", () => {
      const activity = createActivity({
        closedBy: botUser,
        reviews: [createReview(reviewer)],
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("does not count ubiquity-os-beta closed issues as collaborative", () => {
      const activity = createActivity({
        closedBy: botBeta,
        reviews: [createReview(reviewer)],
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("does not count github-actions[bot] closed issues as collaborative", () => {
      const activity = createActivity({
        closedBy: ghActionsBot,
        reviews: [createReview(reviewer)],
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("counts human-closed issues as collaborative", () => {
      const activity = createActivity({
        closedBy: humanCollaborator,
      });

      expect(isCollaborative(activity)).toBe(true);
    });
  });

  describe("bot label exclusion", () => {
    it("does not count bot-applied pricing labels as collaboration", () => {
      const activity = createActivity({
        closedBy: author,
        events: [{ event: "labeled", actor: botUser, label: { name: "Time: <1 Day" } }],
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("counts human-applied pricing labels as collaboration", () => {
      const activity = createActivity({
        closedBy: author,
        events: [{ event: "labeled", actor: humanCollaborator, label: { name: "Time: <1 Day" } }],
      });

      expect(isCollaborative(activity)).toBe(true);
    });
  });

  describe("assignee exclusion", () => {
    it("does not count assignee-applied pricing labels as collaboration", () => {
      const activity = createActivity({
        closedBy: author,
        assignees: [assignee],
        events: [{ event: "labeled", actor: assignee, label: { name: "Time: <1 Day" } }],
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("does not count assignee assignment events as collaboration", () => {
      const activity = createActivity({
        closedBy: author,
        assignees: [assignee],
        events: [{ event: "assigned", actor: assignee }],
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("counts non-assignee assignment events as collaboration", () => {
      const activity = createActivity({
        closedBy: author,
        assignees: [assignee],
        events: [{ event: "assigned", actor: humanCollaborator }],
      });

      expect(isCollaborative(activity)).toBe(true);
    });
  });
});
