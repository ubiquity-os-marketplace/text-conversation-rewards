import { jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { ContentEvaluatorModule } from "../../src/parser/content-evaluator-module";
import { ContextPlugin } from "../../src/types/plugin-input";

function createModule() {
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
          login: "ubiquity-os",
        },
        name: "conversation-rewards",
      },
    },
    logger: new Logs("debug"),
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

  it("combines specialized issue comment criteria using weighted scores", async () => {
    const module = createModule();
    const submitPrompt = jest
      .spyOn(module, "_submitPrompt")
      .mockResolvedValueOnce({ "101": 1, "102": 0 })
      .mockResolvedValueOnce({ "101": 0, "102": 1 })
      .mockResolvedValueOnce({ "101": 0.5, "102": 0.5 });

    const result = await module._evaluateComments(
      "Implement the requested feature and document the tradeoffs.",
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
    expect(submitPrompt.mock.calls[0][0]).toContain("Criterion: Task solving relevance");
    expect(submitPrompt.mock.calls[1][0]).toContain("Criterion: Contributor helpfulness");
    expect(submitPrompt.mock.calls[2][0]).toContain("Criterion: Research and insight value");
  });
});
