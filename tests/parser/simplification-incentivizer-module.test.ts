import { describe, expect, it, jest } from "@jest/globals";
import { SimplificationIncentivizerModule } from "../../src/parser/simplification-incentivizer-module";
import type { ContextPlugin } from "../../src/types/plugin-input";
import { Result } from "../../src/types/results";

describe("SimplificationIncentivizerModule", () => {
  it("removes simplification rewards when additions outweigh deletions", async () => {
    const listFilesMock = jest.fn(async () => ({
      data: [
        { filename: "src/feature.ts", additions: 12, deletions: 4, status: "modified" },
        { filename: "src/utils.ts", additions: 3, deletions: 2, status: "modified" },
      ],
    }));

    const getContentMock = jest.fn(async () => {
      throw Object.assign(new Error("Not Found"), { status: 404 });
    });

    const ctx = {
      config: {
        incentives: {
          simplificationIncentivizer: {
            simplificationRate: 10,
          },
        },
      },
      payload: {
        pull_request: {
          html_url: "https://example.com/pr/1",
          number: 7,
          user: {
            login: "author",
          },
          base: {
            repo: {
              owner: {
                login: "acme",
              },
              name: "widget",
            },
          },
        },
      },
      octokit: {
        rest: {
          pulls: {
            listFiles: listFilesMock,
          },
          repos: {
            getContent: getContentMock,
          },
        },
      },
      logger: {
        warn: jest.fn(),
        info: jest.fn(),
        error: jest.fn((message: string) => new Error(message)),
      },
    } as unknown as ContextPlugin;

    const module = new SimplificationIncentivizerModule(ctx);
    const result: Result = {
      author: {
        total: 0,
        userId: 1,
      },
    };

    const transformed = await module.transform({} as never, result);
    expect(listFilesMock).toHaveBeenCalledTimes(1);
    expect(getContentMock).toHaveBeenCalled();
    expect(transformed.author.simplificationReward).toBeUndefined();
  });
});
