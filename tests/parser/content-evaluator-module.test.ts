import { describe, expect, it, jest } from "@jest/globals";
import { ContentEvaluatorModule } from "../../src/parser/content-evaluator-module";
import { ContextPlugin } from "../../src/types/plugin-input";

const context = {
  config: {
    incentives: {
      contentEvaluator: {
        openAi: {
          tokenCountLimit: 124000,
          maxRetries: 10,
        },
        multipliers: [],
      },
    },
  },
  logger: {
    warn: jest.fn(),
  },
} as unknown as ContextPlugin;

describe("ContentEvaluatorModule", () => {
  describe("_generatePromptForComments", () => {
    it("instructs the model to score non-actionable meta reward comments low", () => {
      const module = new ContentEvaluatorModule(context);
      const prompt = module._generatePromptForComments(
        "Fix duplicated matching comments on label events.",
        "gentlementlegen",
        [
          {
            id: 1,
            author: "0x4007",
            comment: "The matcher posts another comment every time a label event fires.",
          },
          {
            id: 2,
            author: "gentlementlegen",
            comment:
              "> Relevance scoring could have done so much better here for you\n\nLooks like it did the right thing for your reward.",
          },
        ]
      );

      expect(prompt).toContain("Score comments low (0 to 0.2)");
      expect(prompt).toContain("reward/result commentary");
      expect(prompt).toContain("Do not award high relevance just because a comment is long");
      expect(prompt).toContain("Their comment IDs are: 2");
    });
  });
});
