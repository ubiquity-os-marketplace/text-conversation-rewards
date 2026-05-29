import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { ContentEvaluatorModule } from "../../src/parser/content-evaluator-module";
import { ContextPlugin } from "../../src/types/plugin-input";
import cfg from "../__mocks__/results/valid-configuration.json";

const ctx = {
  payload: {
    issue: {
      number: 223,
    },
    repository: {
      name: "text-conversation-rewards",
      owner: {
        login: "ubiquity-os-marketplace",
      },
    },
  },
  config: cfg,
  logger: new Logs("debug"),
} as unknown as ContextPlugin;

describe("ContentEvaluatorModule", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("_resolveModelTokenLimits", () => {
    it("uses OpenRouter model limits when a model is configured", async () => {
      const module = new ContentEvaluatorModule({
        ...ctx,
        config: {
          ...cfg,
          incentives: {
            ...cfg.incentives,
            contentEvaluator: {
              ...cfg.incentives.contentEvaluator,
              openAi: {
                ...cfg.incentives.contentEvaluator.openAi,
                model: "openai/gpt-4o-mini",
                tokenCountLimit: 124000,
              },
            },
          },
        },
      } as unknown as ContextPlugin);
      const getLimits = jest.spyOn(module, "_getOpenRouterModelTokenLimits").mockResolvedValue({
        contextLength: 8192,
        maxCompletionTokens: 4096,
      });

      await expect(module._resolveModelTokenLimits(124000)).resolves.toEqual({
        contextLength: 8192,
        maxCompletionTokens: 4096,
      });
      expect(getLimits).toHaveBeenCalledWith("openai/gpt-4o-mini");
    });

    it("falls back to configured token limits when OpenRouter has no model metadata", async () => {
      const module = new ContentEvaluatorModule({
        ...ctx,
        config: {
          ...cfg,
          incentives: {
            ...cfg.incentives,
            contentEvaluator: {
              ...cfg.incentives.contentEvaluator,
              openAi: {
                ...cfg.incentives.contentEvaluator.openAi,
                model: "missing/model",
              },
            },
          },
        },
      } as unknown as ContextPlugin);
      const getLimits = jest.spyOn(module, "_getOpenRouterModelTokenLimits").mockResolvedValue(null);

      await expect(module._resolveModelTokenLimits(1000)).resolves.toEqual({
        contextLength: 1000,
        maxCompletionTokens: 16384,
      });
      expect(getLimits).toHaveBeenCalledWith("missing/model");
    });
  });

  describe("_generatePromptForComments", () => {
    it("guides the model to score evaluator meta-discussion as low relevance", () => {
      const module = new ContentEvaluatorModule(ctx);
      const prompt = module._generatePromptForComments(
        "Implement formal deduplication for recommendation matches.",
        "gentlementlegen",
        [
          {
            id: 1,
            author: "gentlementlegen",
            comment:
              "Relevance scoring could have done so much better here. Perhaps this conversation should be saved as a unit test.",
          },
        ]
      );

      expect(prompt).toContain("Score low-value meta discussion near 0");
      expect(prompt).toContain("rewards, relevance, scoring, tests, or the evaluator itself");
      expect(prompt).toContain("Relevance scoring could have done so much better here");
      expect(prompt).toContain('"1": <score>');
    });
  });
});
