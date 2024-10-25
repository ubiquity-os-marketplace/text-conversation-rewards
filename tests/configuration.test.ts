import { FormattingEvaluatorModule } from "../src/parser/formatting-evaluator-module";
import { ContextPlugin } from "../src/types/plugin-input";
import customConfiguration from "./__mocks__/configurations/custom-configuration.json";

jest.mock("../src/parser/command-line", () => {
  const cfg = require("./__mocks__/configurations/custom-configuration.json");
  const dotenv = require("dotenv");
  dotenv.config();
  return {
    stateId: 1,
    eventName: "issues.closed",
    authToken: process.env.GITHUB_TOKEN,
    ref: "",
    eventPayload: {
      issue: {
        html_url: "",
        number: 69,
        state_reason: "completed",
      },
      repository: {
        name: "conversation-rewards",
        owner: {
          login: "ubiquity-os",
          id: 76412717,
        },
      },
    },
    settings: JSON.stringify(cfg),
  };
});

describe("Configuration Tests", () => {
  it("Should populate default values in configuration", () => {
    expect(configuration).toEqual(customConfiguration);
  });

  it("Formatting evaluator should parse the enums properly", () => {
    const formattingEvaluator = new FormattingEvaluatorModule({} as unknown as ContextPlugin);

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
