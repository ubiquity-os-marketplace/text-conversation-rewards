import { describe, expect, it } from "@jest/globals";
import { ContentEvaluatorModule } from "../../src/parser/content-evaluator-module";
import type { ContextPlugin } from "../../src/types/plugin-input";

describe("ContentEvaluatorModule", () => {
  it("calibrates issue-comment relevance prompts to score reward-scoring meta comments low", () => {
    const module = new ContentEvaluatorModule({
      config: {
        incentives: {},
      },
    } as unknown as ContextPlugin);

    const prompt = module._generatePromptForComments(
      "Populate the matchmaking database from completed GitHub issues and persist issue metadata.",
      "gentlementlegen",
      [
        {
          id: 101,
          author: "0x4007",
          comment: "Perhaps this conversation should be saved as a unit test of sorts.",
        },
        {
          id: 102,
          author: "gentlementlegen",
          comment: "Relevance scoring could have done so much better here for you @gentlementlegen.",
        },
      ]
    );

    expect(prompt).toContain("Meta-discussion about rewards, relevance scoring");
    expect(prompt).toContain("must score near 0");
    expect(prompt).toContain('"102": <score>');
  });
});
