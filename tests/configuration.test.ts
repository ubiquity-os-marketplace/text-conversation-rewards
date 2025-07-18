import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "bun:test";
import { formattingEvaluatorConfigurationType } from "../src/configuration/formatting-evaluator-config";
import { FormattingEvaluatorModule } from "../src/parser/formatting-evaluator-module";
import { ContextPlugin, pluginSettingsSchema } from "../src/types/plugin-input";

describe("Configuration Tests", () => {
  it("Formatting evaluator should parse the enums properly", () => {
    const config = Value.Default(pluginSettingsSchema, {
      incentives: {
        formattingEvaluator: Value.Default(formattingEvaluatorConfigurationType, {}),
      },
    });
    const formattingEvaluator = new FormattingEvaluatorModule({
      config,
    } as unknown as ContextPlugin);

    expect(Object.keys(formattingEvaluator["_multipliers"])).toEqual([
      "5",
      "6",
      "9",
      "10",
      "17",
      "18",
      "33",
      "34",
      "129",
      "130",
    ]);
  });
});
