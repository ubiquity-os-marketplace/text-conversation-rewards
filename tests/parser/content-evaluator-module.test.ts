import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ContentEvaluatorModule } from "../../src/parser/content-evaluator-module";
import { ContextPlugin } from "../../src/types/plugin-input";

describe("ContentEvaluatorModule", () => {
  let module: ContentEvaluatorModule;

  beforeEach(() => {
    const context = {
      config: {
        incentives: {
          contentEvaluator: {
            openAi: {
              maxRetries: 1,
              reasoningEffort: "low",
              tokenCountLimit: 124000,
            },
            evaluationDimensions: [
              {
                name: "specification-relevance",
                prompt: "Rank how directly this helps solve the issue specification.",
                weight: 0.5,
              },
              {
                name: "contributor-assistance",
                prompt: "Rank how helpful this is for answering contributor questions.",
                weight: 0.25,
              },
              {
                name: "research-insight",
                prompt: "Rank how useful this is for adding research or project insight.",
                weight: 0.25,
              },
            ],
            multipliers: [],
            originalAuthorWeight: 0.5,
          },
        },
      },
      logger: {
        debug: jest.fn(),
        error: jest.fn((message: string) => new Error(message)),
        fatal: jest.fn((message: string) => new Error(message)),
        info: jest.fn(),
        warn: jest.fn((message: string) => new Error(message)),
      },
      payload: {
        issue: {
          number: 1,
          user: { login: "maintainer" },
        },
        repository: {
          name: "text-conversation-rewards",
          owner: { login: "ubiquity-os-marketplace" },
        },
      },
    } as unknown as ContextPlugin;

    module = new ContentEvaluatorModule(context);
    (module as unknown as { _tokenLimit: number })._tokenLimit = 124000;
  });

  it("combines separate evaluation dimensions by weight", async () => {
    const submitPrompt = jest
      .spyOn(module, "_submitPrompt")
      .mockResolvedValueOnce({ "101": 1 })
      .mockResolvedValueOnce({ "101": 0 })
      .mockResolvedValueOnce({ "101": 0.5 });

    const result = await module._evaluateComments(
      "Implement a status badge for pull request activity.",
      "alice",
      [{ id: 101, comment: "This should include a fallback for repositories without checks." }],
      [{ id: 101, author: "alice", comment: "This should include a fallback for repositories without checks." }],
      []
    );

    expect(submitPrompt).toHaveBeenCalledTimes(3);
    expect(submitPrompt.mock.calls.map(([prompt]) => prompt)).toEqual([
      expect.stringContaining("Rank how directly this helps solve the issue specification."),
      expect.stringContaining("Rank how helpful this is for answering contributor questions."),
      expect.stringContaining("Rank how useful this is for adding research or project insight."),
    ]);
    expect(result["101"]).toBeCloseTo(0.625);
  });
});
