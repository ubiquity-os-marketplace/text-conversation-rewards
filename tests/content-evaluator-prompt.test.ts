import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { ContextPlugin } from "../src/types/plugin-input";

describe("ContentEvaluatorModule prompt generation", () => {
  it("instructs the LLM to score reward meta discussion low unless it is on topic", () => {
    const module = new ContentEvaluatorModule({
      config: {
        incentives: {
          contentEvaluator: null,
        },
      },
    } as unknown as ContextPlugin);

    const prompt = module._generatePromptForComments("Fix issue matching for duplicate reports.", "gentlementlegen", [
      {
        id: 1,
        author: "gentlementlegen",
        comment: "Relevance scoring could have done so much better here.",
      },
      {
        id: 2,
        author: "maintainer",
        comment: "Please focus on duplicate issue matching.",
      },
    ]);

    expect(prompt).toContain("meta comments about rewards, relevance scoring, who should be paid");
    expect(prompt).toContain("low relevance unless the issue itself is specifically about rewards or relevance scoring");
    expect(prompt).toContain("brief acknowledgements, thanks, status chatter, or social replies as low relevance");
  });
});
