import { Value } from "@sinclair/typebox/value";
import {
  ContentEvaluatorConfiguration,
  contentEvaluatorConfigurationType,
} from "../src/configuration/content-evaluator-config";

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
        model: "anthropic/claude-3.5-sonnet",
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
    expect(decodedConfig.openAi.model).toBe("anthropic/claude-3.5-sonnet");
    expect(decodedConfig.openAi.maxRetries).toBe(10);
  });

  it("should allow custom model in openAi config", () => {
    const config: PartialContentEvaluatorConfiguration = {
      openAi: {
        model: "deepseek/deepseek-chat",
      },
      originalAuthorWeight: 0.5,
    };

    const defaultedConfig = Value.Default(contentEvaluatorConfigurationType, config);
    const decodedConfig = Value.Decode(contentEvaluatorConfigurationType, defaultedConfig);
    expect(decodedConfig.openAi.model).toBe("deepseek/deepseek-chat");
    expect(decodedConfig.openAi.maxRetries).toBe(10);
  });
});
