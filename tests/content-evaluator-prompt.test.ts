import { describe, expect, it } from "@jest/globals";
import cfg from "./__mocks__/results/valid-configuration.json";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { ContextPlugin } from "../src/types/plugin-input";

const ctx = {
  config: cfg,
} as unknown as ContextPlugin;

describe("Content evaluator prompt", () => {
  it("guides the model to score reward-bot meta comments low", () => {
    const module = new ContentEvaluatorModule(ctx);
    const prompt = module._generatePromptForComments(
      "Fix reward generation so only task-relevant implementation comments are paid.",
      "gentlementlegen",
      [
        {
          id: 100,
          author: "gentlementlegen",
          comment: "Okay both bots are broken @gentlementlegen. We should have specialized prompts.",
        },
        {
          id: 101,
          author: "maintainer",
          comment: "Please add a regression test for irrelevant process comments.",
        },
      ]
    );

    expect(prompt).toContain("reward bot");
    expect(prompt).toContain("scoring bot");
    expect(prompt).toContain("should receive a low score");
    expect(prompt).toContain("can be well written and still receive a low relevance score");
  });
});
