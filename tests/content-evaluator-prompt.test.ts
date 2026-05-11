import { describe, expect, it } from "@jest/globals";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";

describe("ContentEvaluatorModule prompt generation", () => {
  it("instructs the model to downscore generic test-only issue comments", () => {
    const module = Object.create(ContentEvaluatorModule.prototype) as ContentEvaluatorModule;

    const prompt = module._generatePromptForComments("Improve relevance scoring for issue comments.", "contributor", [
      {
        id: 1,
        author: "contributor",
        comment: "I will add tests for this.",
      },
      {
        id: 2,
        author: "maintainer",
        comment: "The evaluator is over-rewarding generic comments.",
      },
    ]);

    expect(prompt).toContain("Score near 0 when a comment only mentions broad work such as");
    expect(prompt).toContain("\"add tests\"");
    expect(prompt).toContain("Do not infer relevance from the comment author, assignee, repository, or prior activity.");
    expect(prompt).toContain("A comment is relevant only when its own original content ties directly to the issue");
  });
});
