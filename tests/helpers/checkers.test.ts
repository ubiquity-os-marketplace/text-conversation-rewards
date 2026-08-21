import {
	isCollaborative,
	nonAssigneeApprovedReviews,
} from "../../src/helpers/checkers";
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

function createReview(
	user: User,
	state: GitHubPullRequestReviewState["state"] = "APPROVED",
	authorAssociation: GitHubPullRequestReviewState["author_association"] = "MEMBER",
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
	linkedIssueAuthor,
	reviews = [],
	requestedReviewers = [],
}: {
	pullRequestContext?: boolean;
	issueAssignee?: User;
	linkedIssueAuthor?: User;
	reviews?: GitHubPullRequestReviewState[];
	requestedReviewers?: User[];
}) {
	return {
		self: {
			user: author,
			closed_by: author,
			assignee: issueAssignee,
			pull_request: pullRequestContext
				? { html_url: "https://github.com/owner/repo/pull/1" }
				: undefined,
		},
		events: [],
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
				reviews: [
					createReview(reviewer, "APPROVED", "CONTRIBUTOR"),
					createReview(outsideReviewer, "APPROVED", "NONE"),
				],
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
				reviews: [
					createReview(reviewer, "COMMENTED"),
					createReview(author, "COMMENTED"),
				],
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
