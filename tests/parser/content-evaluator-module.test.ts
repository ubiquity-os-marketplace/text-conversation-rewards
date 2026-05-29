import { describe, expect, it } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { ContentEvaluatorModule } from "../../src/parser/content-evaluator-module";
import { ContextPlugin } from "../../src/types/plugin-input";
import cfg from "../__mocks__/results/valid-configuration.json";

const ctx = {
  payload: {
    issue: {
      number: 223,
    },
    repository: {
      name: "text-conversation-rewards",
      owner: {
        login: "ubiquity-os-marketplace",
      },
    },
  },
  config: cfg,
  logger: new Logs("debug"),
} as unknown as ContextPlugin;

describe("ContentEvaluatorModule", () => {
  describe("_generatePromptForComments", () => {
    it("guides the model to score evaluator meta-discussion as low relevance", () => {
      const module = new ContentEvaluatorModule(ctx);
      const prompt = module._generatePromptForComments(
        "Implement formal deduplication for recommendation matches.",
        "gentlementlegen",
        [
          {
            id: 1,
            author: "gentlementlegen",
            comment:
              "Relevance scoring could have done so much better here. Perhaps this conversation should be saved as a unit test.",
          },
        ]
      );

      expect(prompt).toContain("Score low-value meta discussion near 0");
      expect(prompt).toContain("rewards, relevance, scoring, tests, or the evaluator itself");
      expect(prompt).toContain("Relevance scoring could have done so much better here");
      expect(prompt).toContain('"1": <score>');
    });
  });
});
