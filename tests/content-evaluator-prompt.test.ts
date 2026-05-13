import { describe, expect, it } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { ContextPlugin } from "../src/types/plugin-input";
import cfg from "./__mocks__/results/valid-configuration.json";

describe("ContentEvaluatorModule prompt guidance", () => {
  it("instructs the evaluator to score low-signal collaboration comments minimally", () => {
    const module = new ContentEvaluatorModule({
      config: cfg,
      logger: new Logs("debug"),
      payload: {
        issue: {
          number: 56,
        },
        repository: {
          name: "text-vector-embeddings",
          owner: {
            login: "ubiquity-os-marketplace",
          },
        },
      },
    } as unknown as ContextPlugin);

    const prompt = module._generatePromptForComments(
      "Resolve duplicate issue handling in the plugin.",
      "gentlementlegen",
      [
        {
          id: 1,
          author: "gentlementlegen",
          comment: "Thanks for the context. I agree with the direction here and can take another look later.",
        },
        {
          id: 2,
          author: "contributor",
          comment: "The duplicate detection should call the GitHub close-as-duplicate endpoint.",
        },
      ]
    );

    expect(prompt).toContain("Score 0.0-0.2 for comments that only express agreement");
    expect(prompt).toContain("Do not reward a comment highly just because it is polite");
    expect(prompt).toContain("Raise the score only when the comment contains issue-specific substance");
    expect(prompt).toContain("Their comment IDs are: 1");
  });
});
