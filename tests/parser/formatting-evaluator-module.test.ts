import { FormattingEvaluatorModule } from "../../src/parser/formatting-evaluator-module";
import { ContextPlugin } from "../../src/types/plugin-input";
import { CommentType } from "../../src/configuration/comment-types";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("FormattingEvaluatorModule", () => {
  let module: FormattingEvaluatorModule;

  const mockContext: ContextPlugin = {
    config: {
      incentives: {
        formattingEvaluator: {
          readabilityScoring: {
            enabled: true,
            weight: 0.3,
            targetReadabilityScore: 60,
          },
          multipliers: [
            {
              role: ["ISSUE_AUTHOR"] as CommentType[],
              multiplier: 1,
              rewards: {
                wordValue: 0.2,
                html: {
                  p: { score: 0, countWords: true },
                  code: { score: 5, countWords: false },
                  a: { score: 5, countWords: true },
                  li: { score: 0.5, countWords: true },
                  ul: { score: 1, countWords: true },
                  div: { score: 0, countWords: true },
                  pre: { score: 0, countWords: false },
                },
              },
            },
          ],
          wordCountExponent: 0.85,
        },
      },
    },
    logger: {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    },
  } as unknown as ContextPlugin;

  beforeEach(() => {
    module = new FormattingEvaluatorModule(mockContext);
  });

  describe("_countSyllables", () => {
    it("should correctly count syllables in words", () => {
      const testCases = [
        { word: "hello", expected: 2 },
        { word: "world", expected: 1 },
        { word: "beautiful", expected: 4 }, // beau-ti-ful
        { word: "code", expected: 1 },
        { word: "education", expected: 4 },
      ];

      testCases.forEach(({ word, expected }) => {
        expect(module["_countSyllables"](word)).toBe(expected);
      });
    });

    it("should handle short words and edge cases", () => {
      expect(module["_countSyllables"]("a")).toBe(1);
      expect(module["_countSyllables"]("the")).toBe(1);
      expect(module["_countSyllables"]("")).toBe(1);
    });
  });

  describe("_calculateFleschKincaid", () => {
    it("should calculate readability score for simple text", () => {
      // Expecting score around 60 (ideal readability)
      const text = "The sun is bright. I can see it shine. Birds fly high.";
      const result = module["_calculateFleschKincaid"](text);

      expect(result).toMatchObject({
        sentences: 3,
        syllables: expect.any(Number),
        fleschKincaid: expect.any(Number),
        score: expect.any(Number),
      });

      // Score should be normalized between 0 and 1
      expect(result.score).toBeGreaterThanOrEqual(0.8);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it("Low score for complex text", () => {
      const text = "This is a very complex sentence. It has many words and syllables. The score should be low.";
      const result = module["_calculateFleschKincaid"](text);

      expect(result).toMatchObject({
        sentences: 3,
        syllables: expect.any(Number),
        fleschKincaid: expect.any(Number),
        score: expect.any(Number),
      });

      // Score should be normalized between 0 and 1
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(0.8);
    });

    it("should handle text with no periods", () => {
      const text = "This is a test without periods but still readable";
      const result = module["_calculateFleschKincaid"](text);

      expect(result.sentences).toBe(1);
      expect(result.syllables).toBeGreaterThan(0);
    });

    it("should handle very complex text with difficult words", () => {
      const text =
        "Incomprehensible multisyllabic anthropomorphization characteristically demonstrates philosophical conceptualization through metaphysical manifestations";
      const result = module["_calculateFleschKincaid"](text);

      expect(result).toMatchObject({
        sentences: 1,
        syllables: expect.any(Number),
        fleschKincaid: expect.any(Number),
        score: expect.any(Number),
      });

      // Score should be normalized between 0 and 1
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(0.2);
    });
  });
});
