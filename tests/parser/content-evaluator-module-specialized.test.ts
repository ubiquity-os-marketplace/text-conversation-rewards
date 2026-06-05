import { describe, expect, it, jest, afterEach } from "@jest/globals";
import { ContentEvaluatorModule } from "../../src/parser/content-evaluator-module";
import type { ContextPlugin } from "../../src/types/plugin-input";

function createModule(evaluationDimensions?: { relevance: number; helpfulness: number; research: number }) {
  const logger = {
    warn: jest.fn((message: string) => new Error(message)),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn((message: string) => new Error(message)),
    fatal: jest.fn((message: string) => new Error(message)),
    ok: jest.fn((message: string) => message),
  };

  const context = {
    config: {
      incentives: {
        contentEvaluator: {
          openAi: {
            tokenCountLimit: 124000,
            maxRetries: 1,
            reasoningEffort: "low",
          },
          originalAuthorWeight: 0.5,
          multipliers: [],
          ...(evaluationDimensions ? { evaluationDimensions } : {}),
        },
        githubComment: {
          post: false,
        },
      },
    },
    payload: {
      issue: {
        number: 1,
      },
      repository: {
        owner: {
          login: "ubiquity-os-marketplace",
        },
        name: "text-conversation-rewards",
      },
    },
    logger,
    commentHandler: {
      postComment: jest.fn(),
    },
  } as unknown as ContextPlugin;

  const module = new ContentEvaluatorModule(context);
  Reflect.set(module, "_tokenLimit", 124000);
  return module;
}

describe("ContentEvaluatorModule specialized issue comment evaluation", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("evaluates issue comments with three specialized prompts and combines them with default weights", async () => {
    const module = createModule();
    const submitPrompt = jest
      .spyOn(module, "_submitPrompt")
      .mockResolvedValueOnce({ "101": 1, "102": 0 })
      .mockResolvedValueOnce({ "101": 0, "102": 1 })
      .mockResolvedValueOnce({ "101": 0.5, "102": 0.5 });

    const result = await module._evaluateComments(
      "Implement specialized prompts and combine them into one reward relevance score.",
      "alice",
      [
        { id: 101, comment: "I implemented the core behavior and added tests." },
        { id: 102, comment: "Here is background research and an answer to the API question." },
      ],
      [
        { id: 101, author: "alice", comment: "I implemented the core behavior and added tests." },
        { id: 102, author: "alice", comment: "Here is background research and an answer to the API question." },
      ],
      []
    );

    expect(result).toEqual({ "101": 0.6, "102": 0.4 });
    expect(submitPrompt).toHaveBeenCalledTimes(3);
    expect(submitPrompt.mock.calls[0][0]).toContain("solving the specification");
    expect(submitPrompt.mock.calls[1][0]).toContain("helping contributors");
    expect(submitPrompt.mock.calls[2][0]).toContain("research and insights");
  });

  it("normalizes configured dimension weights when combining scores", async () => {
    const module = createModule({ relevance: 0.2, helpfulness: 0.2, research: 0.6 });
    jest
      .spyOn(module, "_submitPrompt")
      .mockResolvedValueOnce({ "101": 1 })
      .mockResolvedValueOnce({ "101": 0 })
      .mockResolvedValueOnce({ "101": 0.5 });

    const result = await module._evaluateComments(
      "Implement specialized prompts and combine them into one reward relevance score.",
      "alice",
      [{ id: 101, comment: "I implemented the core behavior and added tests." }],
      [{ id: 101, author: "alice", comment: "I implemented the core behavior and added tests." }],
      []
    );

    expect(result).toEqual({ "101": 0.5 });
  });

  it("throws when a specialized prompt omits a target comment score", async () => {
    const module = createModule();
    jest.spyOn(module, "_submitPrompt").mockResolvedValueOnce({ "101": 1 });

    await expect(
      module._evaluateComments(
        "Implement specialized prompts and combine them into one reward relevance score.",
        "alice",
        [
          { id: 101, comment: "I implemented the core behavior and added tests." },
          { id: 102, comment: "Here is background research and an answer to the API question." },
        ],
        [
          { id: 101, author: "alice", comment: "I implemented the core behavior and added tests." },
          { id: 102, author: "alice", comment: "Here is background research and an answer to the API question." },
        ],
        []
      )
    ).rejects.toThrow("There was a mismatch between specialized relevance scores and comments.");
  });
});
