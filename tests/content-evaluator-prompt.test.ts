import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { ContextPlugin } from "../src/types/plugin-input";

function createContentEvaluatorModule() {
  const context = {
    config: {
      incentives: {
        contentEvaluator: {
          openAi: {
            maxRetries: 1,
            tokenCountLimit: 1000,
          },
        },
      },
    },
  } as unknown as ContextPlugin;

  return new ContentEvaluatorModule(context);
}

describe("ContentEvaluatorModule prompt generation", () => {
  it("instructs issue comment scoring to down-rank process-only and self-referential comments", () => {
    const module = createContentEvaluatorModule();

    const prompt = module._generatePromptForComments("Fix the recommendation quality for task assignment.", "alice", [
      {
        id: 1,
        author: "alice",
        comment: "This recommendation comment scored too high.",
      },
      {
        id: 2,
        author: "bob",
        comment: "The implementation should compare recommendations against the task specification.",
      },
    ]);

    expect(prompt).toContain("Down-rank process-only comments");
    expect(prompt).toContain("comments about assignment, recommendations, scoring, deadlines, or bot workflow");
    expect(prompt).toContain("Do not raise relevance because of the author's identity");
  });
});
