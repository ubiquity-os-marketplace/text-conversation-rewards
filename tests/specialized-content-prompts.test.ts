import {
  buildSpecializedIssuePrompts,
  combineSpecializedScores,
  DEFAULT_SPECIALIZED_EVALUATIONS,
} from "../src/helpers/specialized-content-prompts";

describe("specialized content prompts", () => {
  it("builds one issue-evaluation prompt per configured dimension", () => {
    const prompts = buildSpecializedIssuePrompts({
      specification: "Implement fee calculation for permit transfers.",
      username: "alice",
      allComments: [
        { id: 10, author: "alice", comment: "I added the fee basis-point calculation and tests." },
        { id: 11, author: "bob", comment: "Can you add a boundary test?" },
      ],
      dimensions: DEFAULT_SPECIALIZED_EVALUATIONS,
    });

    expect(prompts).toHaveLength(3);
    expect(prompts.map((prompt) => prompt.key)).toEqual(["relevance", "helpfulness", "research"]);
    expect(prompts[0].prompt).toContain("Rank from 0 to 1 how relevant");
    expect(prompts[1].prompt).toContain("Rank from 0 to 1 how helpful");
    expect(prompts[2].prompt).toContain("Rank from 0 to 1 how useful");
    for (const { prompt } of prompts) {
      expect(prompt).toContain("Focus exclusively on comments authored by alice");
      expect(prompt).toContain('"10": <score>');
      expect(prompt).toContain("All comments in chronological order");
    }
  });

  it("combines specialized scores using configured weights and clamps out-of-range values", () => {
    const combined = combineSpecializedScores(
      [
        { key: "relevance", weight: 0.5, scores: { "10": 1, "12": 0.2 } },
        { key: "helpfulness", weight: 0.3, scores: { "10": 0.5, "12": 2 } },
        { key: "research", weight: 0.2, scores: { "10": 0, "12": -1 } },
      ],
      [10, 12]
    );

    expect(combined).toEqual({
      "10": 0.65,
      "12": 0.4,
    });
  });

  it("fails loudly when a model response omits a required comment id", () => {
    expect(() =>
      combineSpecializedScores(
        [
          { key: "relevance", weight: 1, scores: { "10": 1 } },
          { key: "helpfulness", weight: 1, scores: {} },
        ],
        [10]
      )
    ).toThrow("Missing helpfulness score for comment 10");
  });
});
