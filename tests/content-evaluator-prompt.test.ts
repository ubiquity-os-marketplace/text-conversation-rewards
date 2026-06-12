import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import cfg from "./__mocks__/results/valid-configuration.json";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { ContextPlugin } from "../src/types/plugin-input";

const ctx = {
  config: cfg,
  logger: new Logs("debug"),
} as unknown as ContextPlugin;

describe("ContentEvaluatorModule prompt generation", () => {
  it("instructs the evaluator to score reward-scoring meta comments low", () => {
    const module = new ContentEvaluatorModule(ctx);
    const prompt = module._generatePromptForComments("Fix duplicate task rewards for completed issues", "gentlementlegen", [
      {
        id: 1,
        author: "gentlementlegen",
        comment: "Relevance scoring could have done so much better here for you.",
      },
      {
        id: 2,
        author: "alice",
        comment: "The task rewards are duplicated when the issue has two closing events.",
      },
    ]);

    expect(prompt).toContain("meta-comments about rewards/scoring");
    expect(prompt).toContain("relevance scoring accuracy");
    expect(prompt).toContain("rather than only discussing how rewards or relevance scoring behaved");
    expect(prompt).toContain("Their comment IDs are: 1");
  });
});
