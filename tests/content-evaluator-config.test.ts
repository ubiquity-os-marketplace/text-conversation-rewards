import { Value } from "@sinclair/typebox/value";
import {
  ContentEvaluatorConfiguration,
  contentEvaluatorConfigurationType,
} from "../src/configuration/content-evaluator-config";

describe("ContentEvaluatorConfiguration Validation", () => {
  it("should trigger an error when a non-URL value is provided for the endpoint", () => {
    const invalidConfig: Partial<ContentEvaluatorConfiguration> = {
      openAi: {
        model: "gpt-4o-2024-08-06",
        endpoint: "not-a-valid-url",
        maxRetries: 3,
      },
    };

    function assertInvalidConfig() {
      const defaultedConfig = Value.Default(contentEvaluatorConfigurationType, invalidConfig);
      const decodedConfig = Value.Decode(contentEvaluatorConfigurationType, defaultedConfig);
      Value.Check(contentEvaluatorConfigurationType, decodedConfig);
    }

    expect(assertInvalidConfig).toThrow();
  });

  it("should pass validation when a valid URL value is provided for the endpoint", () => {
    const validConfig: Partial<ContentEvaluatorConfiguration> = {
      openAi: {
        model: "gpt-4o-2024-08-06",
        endpoint: "https://api.openai.com/v1",
        maxRetries: 3,
      },
    };

    const defaultedConfig = Value.Default(contentEvaluatorConfigurationType, validConfig);
    const decodedConfig = Value.Decode(contentEvaluatorConfigurationType, defaultedConfig);
    const isValid = Value.Check(contentEvaluatorConfigurationType, decodedConfig);
    expect(isValid).toBe(true);
  });
});
