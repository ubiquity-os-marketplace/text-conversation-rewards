import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { GitHubPullRequestReviewComment, GitHubPullRequestReviewState } from "../src/github-types";
import { PullRequestData } from "../src/helpers/pull-request-data";
import { ReviewIncentivizerModule } from "../src/parser/review-incentivizer-module";
import { ContextPlugin } from "../src/types/plugin-input";
import cfg from "./__mocks__/results/valid-configuration.json";

const mockGetContent = jest.fn(async () => {
  const error = new Error("Not Found") as Error & { status?: number };
  error.status = 404;
  throw error;
});

const ctx = {
  config: cfg,
  logger: new Logs("debug"),
  octokit: {
    rest: {
      repos: {
        getContent: mockGetContent,
      },
    },
  },
} as unknown as ContextPlugin;

function createReview({
  id,
  body,
  commitId,
  state = "APPROVED",
}: {
  id: number;
  body?: string | null;
  commitId: string;
  state?: string;
}) {
  return {
    id,
    body,
    commit_id: commitId,
    state,
    pull_request_url: "https://api.github.com/repos/owner/repo/pulls/7",
    user: { login: "reviewer" },
  } as GitHubPullRequestReviewState;
}

function createReviewComment(reviewId: number) {
  return {
    pull_request_review_id: reviewId,
    user: { login: "reviewer" },
    body: "Inline review note",
  } as GitHubPullRequestReviewComment;
}

describe("ReviewIncentivizerModule substantive reviews", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockGetContent.mockClear();
  });

  it("does not reward empty approvals with no review comments", async () => {
    jest.spyOn(PullRequestData.prototype, "fetchData").mockResolvedValue(undefined);
    jest
      .spyOn(PullRequestData.prototype, "pullCommits", "get")
      .mockReturnValue([{ sha: "first", parents: [{ sha: "base" }], parentCount: 1 }]);

    const reviewIncentivizer = new ReviewIncentivizerModule(ctx);
    const diffSpy = jest
      .spyOn(reviewIncentivizer, "getReviewableDiff")
      .mockResolvedValue({ addition: 5000, deletion: 4000 });

    const result = await reviewIncentivizer.fetchReviewDiffRewards(
      "owner",
      "repo",
      "main",
      "owner:repo",
      [createReview({ id: 1, body: "   ", commitId: "approval-commit" })],
      1,
      []
    );

    expect(result).toEqual([]);
    expect(diffSpy).not.toHaveBeenCalled();
  });

  it("keeps reviews that include either body text or review comments", async () => {
    jest.spyOn(PullRequestData.prototype, "fetchData").mockResolvedValue(undefined);
    jest
      .spyOn(PullRequestData.prototype, "pullCommits", "get")
      .mockReturnValue([{ sha: "first", parents: [{ sha: "base" }], parentCount: 1 }]);

    const reviewIncentivizer = new ReviewIncentivizerModule(ctx);
    jest.spyOn(reviewIncentivizer, "getReviewableDiff").mockResolvedValue({ addition: 5, deletion: 3 });

    const result = await reviewIncentivizer.fetchReviewDiffRewards(
      "owner",
      "repo",
      "main",
      "owner:repo",
      [createReview({ id: 1, body: "Looks good after checking the changes.", commitId: "body-commit" })],
      2,
      []
    );

    const inlineResult = await reviewIncentivizer.fetchReviewDiffRewards(
      "owner",
      "repo",
      "main",
      "owner:repo",
      [createReview({ id: 2, body: "   ", commitId: "inline-commit" })],
      2,
      [createReviewComment(2)]
    );

    expect(result).toEqual([{ reviewId: 1, effect: { addition: 5, deletion: 3 }, reward: 0.16, priority: 2 }]);
    expect(inlineResult).toEqual([{ reviewId: 2, effect: { addition: 5, deletion: 3 }, reward: 0.16, priority: 2 }]);
  });
});
