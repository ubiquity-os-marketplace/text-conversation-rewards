import { describe, expect, it } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { IssueActivity } from "../src/issue-activity";
import { parseGitHubUrl } from "../src/start";
import type { ContextPlugin } from "../src/types/plugin-input";
import cfg from "./__mocks__/results/valid-configuration.json";

describe("IssueActivity command comments", () => {
  it("excludes multiline slash command comments from reward evaluation", async () => {
    const issueUrl = "https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/242";
    const activity = new IssueActivity(
      {
        eventName: "issues.closed",
        config: cfg,
        logger: new Logs("debug"),
      } as unknown as ContextPlugin,
      parseGitHubUrl(issueUrl)
    );

    activity.self = {
      id: 242,
      html_url: issueUrl,
      created_at: "2026-01-01T00:00:00Z",
      user: { id: 1 },
    } as typeof activity.self;
    activity.comments = [
      {
        id: 1,
        html_url: `${issueUrl}#issuecomment-1`,
        created_at: "2026-01-01T00:01:00Z",
        body: "/ask\n\nPlease explain the scoring for this issue.",
        user: { id: 2 },
        author_association: "CONTRIBUTOR",
      },
      {
        id: 2,
        html_url: `${issueUrl}#issuecomment-2`,
        created_at: "2026-01-01T00:02:00Z",
        body: "This implementation detail should still be evaluated.",
        user: { id: 3 },
        author_association: "CONTRIBUTOR",
      },
    ] as typeof activity.comments;

    const comments = await activity.getAllComments();

    expect(comments.map((comment) => comment.id)).toEqual([2, 242]);
    expect(comments.map((comment) => "body" in comment && comment.body)).not.toContain(
      "/ask\n\nPlease explain the scoring for this issue."
    );
  });

  it("excludes multiline slash command comments from linked pull request comments", async () => {
    const pullUrl = "https://github.com/ubiquity-os-marketplace/text-conversation-rewards/pull/242";
    const activity = new IssueActivity(
      {
        eventName: "pull_request.closed",
        config: cfg,
        logger: new Logs("debug"),
        payload: {
          pull_request: { html_url: pullUrl },
        },
      } as unknown as ContextPlugin,
      parseGitHubUrl(pullUrl)
    );

    activity.self = {
      id: 242,
      html_url: pullUrl,
      created_at: "2026-01-01T00:00:00Z",
      user: { id: 1 },
      pull_request: { html_url: pullUrl },
    } as typeof activity.self;
    activity.linkedMergedPullRequests = [
      {
        self: {
          id: 242,
          html_url: pullUrl,
          created_at: "2026-01-01T00:00:00Z",
          user: { id: 1 },
        },
        reviews: [],
        reviewComments: [],
        comments: [
          {
            id: 1,
            html_url: `${pullUrl}#issuecomment-1`,
            created_at: "2026-01-01T00:01:00Z",
            body: "/ask\n\nPlease explain the scoring for this pull request.",
            user: { id: 2 },
            author_association: "CONTRIBUTOR",
          },
          {
            id: 2,
            html_url: `${pullUrl}#issuecomment-2`,
            created_at: "2026-01-01T00:02:00Z",
            body: "This pull request implementation detail should still be evaluated.",
            user: { id: 3 },
            author_association: "CONTRIBUTOR",
          },
        ],
      },
    ] as unknown as typeof activity.linkedMergedPullRequests;

    const comments = await activity.getAllComments(true);

    expect(comments.map((comment) => comment.id)).toEqual([242, 2]);
    expect(comments.map((comment) => "body" in comment && comment.body)).not.toContain(
      "/ask\n\nPlease explain the scoring for this pull request."
    );
  });
});
