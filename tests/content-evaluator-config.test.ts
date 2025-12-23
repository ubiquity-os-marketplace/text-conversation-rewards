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
  });
});
