import { describe, expect, it } from "@jest/globals";
import {
  ContentEvaluatorModule,
  OFF_TOPIC_SCORING_META_DISCUSSION_GUIDANCE,
} from "../src/parser/content-evaluator-module";

describe("Content evaluator prompt", () => {
  const evaluator = Object.create(ContentEvaluatorModule.prototype) as ContentEvaluatorModule;

  it("guides issue comment scoring to downscore scoring meta-discussion", () => {
    const prompt = evaluator._generatePromptForComments("Implement vector search improvements.", "gentlementlegen", [
      {
        id: 1,
        author: "0x4007",
        comment: "Relevance scoring could have done so much better here for you @gentlementlegen",
      },
      {
        id: 2,
        author: "gentlementlegen",
        comment:
          "> Relevance scoring could have done so much better here for you @gentlementlegen\n\nPerhaps this conversation should be saved as a unit test so that we can improve the relevance scoring prompt.",
      },
    ]);

    expect(prompt).toContain(OFF_TOPIC_SCORING_META_DISCUSSION_GUIDANCE);
    expect(prompt).toContain("2 - gentlementlegen");
    expect(prompt).toContain('"2": <score>');
  });

  it("guides pull request comment scoring to downscore scoring meta-discussion", () => {
    const prompt = evaluator._generatePromptForPrComments("Implement vector search improvements.", [
      {
        id: 3,
        comment: "The reward scoring should have paid this contributor more.",
      },
    ]);

    expect(prompt).toContain(OFF_TOPIC_SCORING_META_DISCUSSION_GUIDANCE);
    expect(prompt).toContain('"3": <score>');
  });
});
