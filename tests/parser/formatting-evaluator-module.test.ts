import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CommentType } from "../../src/configuration/comment-types";
import { FormattingEvaluatorModule } from "../../src/parser/formatting-evaluator-module";
import { ContextPlugin } from "../../src/types/plugin-input";

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
      expect(module["_countSyllables"](String())).toBe(1);
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
      expect(result.fleschKincaid).toBeGreaterThanOrEqual(0);
      expect(result.fleschKincaid).toBeLessThanOrEqual(100);
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
      expect(result.fleschKincaid).toBeGreaterThanOrEqual(0);
      expect(result.fleschKincaid).toBeLessThanOrEqual(100);
    });

    it("should handle text with no periods", () => {
      const text = "This is a test without periods but still readable";
      const result = module["_calculateFleschKincaid"](text);

      expect(result.sentences).toBe(1);
      expect(result.syllables).toBeGreaterThan(0);
      expect(result.fleschKincaid).toBeGreaterThanOrEqual(0);
      expect(result.fleschKincaid).toBeLessThanOrEqual(100);
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
      expect(result.fleschKincaid).toBeGreaterThanOrEqual(0);
      expect(result.fleschKincaid).toBeLessThanOrEqual(100);
    });

    it("clamps readability score to the upper bound for very easy text", () => {
      const text = "Cool";
      const result = module["_calculateFleschKincaid"](text);

      expect(result.fleschKincaid).toBe(100);
      expect(result.score).toBe(1);
    });

    it("clamps readability score to the lower bound for extremely complex text", () => {
      const text =
        "Antidisestablishmentarianism incomprehensibilities counterrevolutionaries anthropomorphologically characteristically";
      const result = module["_calculateFleschKincaid"](text);

      expect(result.fleschKincaid).toBe(0);
      expect(result.score).toBe(0);
    });

    it("Formatting result should be limited to a maximum of three decimal places", () => {
      const formatting1 = {
        p: { score: 0, elementCount: 11 },
        ul: { score: 0, elementCount: 2 },
        li: { score: 0.1, elementCount: 6 },
      };
      const result1 = module["_calculateFormattingResult"](formatting1);

      expect(result1).toBe(0.6);

      const formatting2 = {
        p: { score: 0, elementCount: 11 },
        ul: { score: 0, elementCount: 2 },
        li: { score: 0.11000000000001, elementCount: 6 },
      };
      const result2 = module["_calculateFormattingResult"](formatting2);

      expect(result2).toBe(0.66);

      const formatting3 = {
        p: { score: 0, elementCount: 11 },
        ul: { score: 0, elementCount: 2 },
        li: { score: 0.11100000000001, elementCount: 6 },
      };
      const result3 = module["_calculateFormattingResult"](formatting3);

      expect(result3).toBe(0.666);

      const formatting4 = {
        p: { score: 0, elementCount: 11 },
        ul: { score: 0, elementCount: 2 },
        li: { score: 0.11101000000001, elementCount: 6 },
      };
      const result4 = module["_calculateFormattingResult"](formatting4);

      expect(result4).toBe(0.666);
    });
  });
});
