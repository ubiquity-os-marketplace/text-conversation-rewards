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
});
