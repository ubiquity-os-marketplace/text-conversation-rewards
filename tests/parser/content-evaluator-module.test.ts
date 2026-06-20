import { describe, expect, it, jest } from "@jest/globals";
import { ContentEvaluatorModule } from "../../src/parser/content-evaluator-module";
import { ContextPlugin } from "../../src/types/plugin-input";

function createModule() {
  return new ContentEvaluatorModule({
    config: {
      incentives: {
        contentEvaluator: {},
      },
    },
    logger: {
      warn: jest.fn(),
      fatal: jest.fn(),
    },
    payload: {
      issue: {},
    },
  } as unknown as ContextPlugin);
}

describe("ContentEvaluatorModule", () => {
  it("guides issue comment scoring to downrank meta discussion about the evaluator", () => {
    const module = createModule();

    const prompt = module._generatePromptForComments(
      "Build a vector search feature for issue comments.",
      "gentlementlegen",
      [
        {
          id: 1,
          author: "gentlementlegen",
          comment: "Relevance scoring could have done so much better here for you @gentlementlegen",
        },
        {
          id: 2,
          author: "gentlementlegen",
          comment:
            "Perhaps this conversation should be saved as a unit test of sorts so that we can improve the relevance scoring prompt",
        },
        {
          id: 3,
          author: "maintainer",
          comment: "The implementation should compare comments to the vector search feature request.",
        },
      ]
    );

    expect(prompt).toContain("meta commentary about the reward or relevance evaluator");
    expect(prompt).toContain("score 0.0 unless it includes a concrete proposal for the issue itself");
  });
});
