import { isCollaborative, nonAssigneeApprovedReviews } from "../../src/helpers/checkers";
import type { GitHubPullRequestReviewState } from "../../src/github-types";
import type { IssueActivity } from "../../src/issue-activity";

type User = {
  id: number;
  login: string;
  type?: string;
};

const author = { id: 1, login: "author", type: "User" };
const assignee = { id: 2, login: "assignee", type: "User" };
const reviewer = { id: 3, login: "reviewer", type: "User" };
const issueAuthor = { id: 4, login: "issue-author", type: "User" };
const outsideReviewer = { id: 5, login: "outside-reviewer", type: "User" };
const bot = { id: 6, login: "ubiquity-os[bot]", type: "Bot" };

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

function createLabeledEvent(actor: User, labelName = "Time: <1 Hour") {
  return {
    actor,
    event: "labeled",
    label: {
      name: labelName,
    },
  };
}

function createAssignedEvent(assigner: User, assignedUser: User) {
  return {
    actor: assigner,
    assignee: assignedUser,
    assigner,
    event: "assigned",
  };
}

function createActivity({
  pullRequestContext = false,
  issueAssignee,
  issueAssignees,
  issueCloser,
  issueCreator = author,
  linkedIssueAuthor,
  reviews = [],
  requestedReviewers = [],
  events = [],
}: {
  pullRequestContext?: boolean;
  issueAssignee?: User;
  issueAssignees?: User[];
  issueCloser?: User;
  issueCreator?: User;
  linkedIssueAuthor?: User;
  reviews?: GitHubPullRequestReviewState[];
  requestedReviewers?: User[];
  events?: unknown[];
}) {
  return {
    self: {
      user: issueCreator,
      closed_by: issueCloser ?? issueCreator,
      assignee: issueAssignee,
      assignees: issueAssignees ?? (issueAssignee ? [issueAssignee] : []),
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

    it("keeps the issue-context assignee review behavior", () => {
      const activity = createActivity({
        issueAssignee: assignee,
        issueCreator: assignee,
        reviews: [createReview(reviewer)],
      });

      expect(nonAssigneeApprovedReviews(activity)).toBe(true);
      expect(isCollaborative(activity)).toBe(true);
    });

    it("does not treat an empty issue-context review list as collaborative", () => {
      const activity = createActivity({
        issueAssignee: assignee,
        issueCreator: assignee,
      });

      expect(nonAssigneeApprovedReviews(activity)).toBe(false);
      expect(isCollaborative(activity)).toBe(false);
    });

    it("does not count an approval from another rewarded assignee", () => {
      const activity = createActivity({
        issueAssignee: assignee,
        issueAssignees: [assignee, reviewer],
        issueCreator: assignee,
        reviews: [createReview(reviewer)],
      });

      expect(nonAssigneeApprovedReviews(activity)).toBe(false);
      expect(isCollaborative(activity)).toBe(false);
    });
  });

  describe("isCollaborative", () => {
    it("treats a different issue author as a specification signal", () => {
      const activity = createActivity({
        issueAssignee: assignee,
      });

      expect(isCollaborative(activity)).toBe(true);
    });

    it("does not treat pricing labels alone as collaboration for a self-authored reward", () => {
      const activity = createActivity({
        events: [createLabeledEvent(reviewer), createLabeledEvent(bot, "Priority: 2 (Medium)")],
        issueAssignee: assignee,
        issueCreator: assignee,
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("treats assignment by another human as collaboration", () => {
      const activity = createActivity({
        events: [createAssignedEvent(reviewer, assignee)],
        issueAssignee: assignee,
        issueCreator: assignee,
      });

      expect(isCollaborative(activity)).toBe(true);
    });

    it("does not treat self-assignment as collaboration", () => {
      const activity = createActivity({
        events: [createAssignedEvent(assignee, assignee)],
        issueAssignee: assignee,
        issueCreator: assignee,
      });

      expect(isCollaborative(activity)).toBe(false);
    });

    it("does not treat bot assignment as collaboration", () => {
      const activity = createActivity({
        events: [createAssignedEvent(bot, assignee)],
        issueAssignee: assignee,
        issueCreator: assignee,
      });

      expect(isCollaborative(activity)).toBe(false);
    });
  });
});
