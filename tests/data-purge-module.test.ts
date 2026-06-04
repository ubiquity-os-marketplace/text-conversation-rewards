import { describe, expect, it, jest } from "@jest/globals";
import { CommentAssociation, CommentKind } from "../src/configuration/comment-types";
import { DataPurgeModule } from "../src/parser/data-purge-module";
import type { ContextPlugin } from "../src/types/plugin-input";
import type { Result } from "../src/types/results";

describe("DataPurgeModule", () => {
  it("skips multiline slash command comments instead of rewarding their arguments", async () => {
    const listEvents = jest.fn();
    const ctx = {
      config: {
        incentives: {
          dataPurge: {
            skipCommentsWhileAssigned: "none",
          },
        },
      },
      payload: {
        issue: {
          html_url: "https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/242",
        },
      },
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
      },
      octokit: {
        paginate: jest.fn(async () => []),
        rest: {
          issues: {
            listEvents,
          },
        },
      },
    } as unknown as ContextPlugin;

    const module = new DataPurgeModule(ctx);
    const result: Result = {
      contributor: {
        total: 0,
        userId: 1,
      },
    };
    const commentType = CommentKind.ISSUE | CommentAssociation.CONTRIBUTOR;
    const activity = {
      self: {
        html_url: "https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/242",
      },
      getAllComments: jest.fn(async () => [
        {
          id: 1,
          body: "This is a normal implementation note that should still be evaluated.",
          html_url:
            "https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/242#issuecomment-1",
          created_at: "2026-06-04T00:00:00Z",
          commentType,
          user: {
            login: "contributor",
            type: "User",
          },
        },
        {
          id: 2,
          body: "/ask\nWhy did this reward include command arguments?\nThis should never be scored.",
          html_url:
            "https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/242#issuecomment-2",
          created_at: "2026-06-04T00:01:00Z",
          commentType,
          user: {
            login: "contributor",
            type: "User",
          },
        },
      ]),
    };

    const transformed = await module.transform(activity as never, result);

    expect(transformed.contributor.comments).toHaveLength(1);
    expect(transformed.contributor.comments?.[0].id).toBe(1);
    expect(transformed.contributor.comments?.[0].content).toContain("normal implementation note");
    expect(transformed.contributor.comments?.[0].content).not.toContain("command arguments");
  });
});
