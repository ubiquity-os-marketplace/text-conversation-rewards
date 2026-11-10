import { jest } from "@jest/globals";
import { Value } from "@sinclair/typebox/value";
import {
  ContentEvaluatorConfiguration,
  contentEvaluatorConfigurationType,
} from "../src/configuration/content-evaluator-config";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { ContextPlugin } from "../src/types/plugin-input";

type PartialContentEvaluatorConfiguration = Omit<Partial<ContentEvaluatorConfiguration>, "openAi"> & {
  openAi?: Partial<ContentEvaluatorConfiguration["openAi"]>;
};

describe("ContentEvaluatorConfiguration Validation", () => {
  it("should trigger an error when tokenCountLimit is not an integer", () => {
    const invalidConfig: PartialContentEvaluatorConfiguration = {
      openAi: {
        maxRetries: 3,
        tokenCountLimit: 1.5,
      },
      originalAuthorWeight: 0.5,
    };

    function assertInvalidConfig() {
      const defaultedConfig = Value.Default(contentEvaluatorConfigurationType, invalidConfig);
      const decodedConfig = Value.Decode(contentEvaluatorConfigurationType, defaultedConfig);
      Value.Check(contentEvaluatorConfigurationType, decodedConfig);
    }

    expect(assertInvalidConfig).toThrow();
  });

  it("should pass validation when tokenCountLimit and maxRetries are valid", () => {
    const validConfig: PartialContentEvaluatorConfiguration = {
      openAi: {
        maxRetries: 3,
        tokenCountLimit: 100,
      },
      originalAuthorWeight: 0.5,
    };

    const defaultedConfig = Value.Default(contentEvaluatorConfigurationType, validConfig);
    const decodedConfig = Value.Decode(contentEvaluatorConfigurationType, defaultedConfig);
    const isValid = Value.Check(contentEvaluatorConfigurationType, decodedConfig);
    expect(isValid).toBe(true);
  });

  it("should apply defaults when openAi is empty", () => {
    const config: PartialContentEvaluatorConfiguration = {
      openAi: {},
      originalAuthorWeight: 0.5,
    };

    const defaultedConfig = Value.Default(contentEvaluatorConfigurationType, config);
    const decodedConfig = Value.Decode(contentEvaluatorConfigurationType, defaultedConfig);
    expect(decodedConfig.openAi.tokenCountLimit).toBe(124000);
    expect(decodedConfig.openAi.maxRetries).toBe(10);
    expect(decodedConfig.evaluationWeights).toEqual({
      relevance: 0.4,
      helpfulness: 0.3,
      research: 0.3,
    });
  });

  it("should fail validation when evaluationWeights have invalid ranges", () => {
    const invalidWeightsConfig = {
      openAi: {},
      evaluationWeights: {
        relevance: -0.1,
        helpfulness: 0.3,
        research: 0.3,
      },
    };

    function assertInvalidWeights() {
      const defaultedConfig = Value.Default(contentEvaluatorConfigurationType, invalidWeightsConfig);
      const decodedConfig = Value.Decode(contentEvaluatorConfigurationType, defaultedConfig);
      Value.Check(contentEvaluatorConfigurationType, decodedConfig);
    }

    expect(assertInvalidWeights).toThrow();
  });

  it("should generate specialized prompts for relevance, helpfulness, and research dimensions", () => {
    const defaultedConfig = Value.Default(contentEvaluatorConfigurationType, { openAi: {} });
    const decodedConfig = Value.Decode(contentEvaluatorConfigurationType, defaultedConfig);
    const mockContext = {
      payload: {},
      config: { incentives: { contentEvaluator: decodedConfig } },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        fatal: jest.fn(),
      },
    } as unknown as ContextPlugin;

    const evaluator = new ContentEvaluatorModule(mockContext);
    const allComments = [
      { id: 101, comment: "Here is the architectural analysis and reproducible test", author: "alice" },
    ];

    const relevancePrompt = evaluator._generateRelevancePromptForComments("Spec body", "alice", allComments);
    const helpfulnessPrompt = evaluator._generateHelpfulnessPromptForComments("Spec body", "alice", allComments);
    const researchPrompt = evaluator._generateResearchPromptForComments("Spec body", "alice", allComments);

    expect(relevancePrompt).toContain("how relevant each comment is to solving the issue specification");
    expect(helpfulnessPrompt).toContain("how helpful each comment is in helping and answering contributor questions");
    expect(researchPrompt).toContain("how useful each comment is for adding research and insights to the project");
  });

  it("should evaluate issue comments across 3 specialized dimensions and combine weighted scores", async () => {
    const defaultedConfig = Value.Default(contentEvaluatorConfigurationType, {
      openAi: {},
      evaluationWeights: {
        relevance: 0.5,
        helpfulness: 0.3,
        research: 0.2,
      },
    });
    const decodedConfig = Value.Decode(contentEvaluatorConfigurationType, defaultedConfig);
    const mockContext = {
      payload: {},
      config: { incentives: { contentEvaluator: decodedConfig } },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        fatal: jest.fn(),
      },
    } as unknown as ContextPlugin;

    const evaluator = new ContentEvaluatorModule(mockContext);
    const allComments = [{ id: 101, comment: "Here is the root-cause analysis and fix", author: "alice" }];

    const submitSpy = jest
      .spyOn(evaluator, "_submitPrompt")
      .mockResolvedValueOnce({ "101": 1.0 })
      .mockResolvedValueOnce({ "101": 0.5 })
      .mockResolvedValueOnce({ "101": 0.25 });

    const scores = await evaluator._evaluateComments(
      "Spec body",
      "alice",
      [{ id: 101, comment: "Here is the root-cause analysis and fix" }],
      allComments,
      []
    );

    expect(submitSpy).toHaveBeenCalledTimes(3);
    // Weighted score: 1.0 * 0.5 + 0.5 * 0.3 + 0.25 * 0.2 = 0.5 + 0.15 + 0.05 = 0.70
    expect(scores).toEqual({ "101": 0.7 });
  });

  it("should skip LLM evaluation for dimensions with zero weight", async () => {
    const defaultedConfig = Value.Default(contentEvaluatorConfigurationType, {
      openAi: {},
      evaluationWeights: {
        relevance: 1.0,
        helpfulness: 0,
        research: 0,
      },
    });
    const decodedConfig = Value.Decode(contentEvaluatorConfigurationType, defaultedConfig);
    const mockContext = {
      payload: {},
      config: { incentives: { contentEvaluator: decodedConfig } },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    } as unknown as ContextPlugin;

    const evaluator = new ContentEvaluatorModule(mockContext);
    const allComments = [{ id: 101, comment: "Fix logic here", author: "bob" }];

    const submitSpy = jest.spyOn(evaluator, "_submitPrompt").mockResolvedValueOnce({ "101": 0.85 });

    const scores = await evaluator._evaluateComments(
      "Spec body",
      "bob",
      [{ id: 101, comment: "Fix logic here" }],
      allComments,
      []
    );

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(scores).toEqual({ "101": 0.85 });
  });

  it("should correctly normalize weights and handle missing comment IDs in _combineWeightedScores", () => {
    const mockContext = {
      payload: {},
      config: { incentives: { contentEvaluator: null } },
      logger: { debug: jest.fn() },
    } as unknown as ContextPlugin;

    const evaluator = new ContentEvaluatorModule(mockContext);
    const combined = evaluator._combineWeightedScores(
      [
        { weight: 2, scores: { "1": 1.0, "2": 0.8 } },
        { weight: 1, scores: { "1": 0.4 } }, // comment 2 missing in second dimension
      ],
      [1, 2]
    );

    // Comment 1: (1.0 * 2 + 0.4 * 1) / (2 + 1) = 2.4 / 3 = 0.8
    expect(combined["1"]).toBe(0.8);
    // Comment 2 was missing from the second dimension, so it should not be returned
    expect(combined["2"]).toBeUndefined();
  });
});
