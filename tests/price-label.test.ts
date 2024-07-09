/* eslint @typescript-eslint/no-var-requires: 0 */
import "../src/parser/command-line";
import { run } from "../src/run";
import { server } from "./__mocks__/node.ts";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

jest.mock("../src/helpers/label-price-extractor", () => {
  return {
    getSortedPrices: jest.fn(() => []),
  };
});

jest.mock("../src/parser/command-line", () => {
  const cfg = require("./__mocks__/results/valid-configuration.json");
  const dotenv = require("dotenv");
  dotenv.config();
  return {
    stateId: 1,
    eventName: "issues.closed",
    authToken: process.env.GITHUB_TOKEN,
    ref: "",
    eventPayload: {
      issue: {
        html_url: "https://github.com/ubiquibot/comment-incentives/issues/22",
        number: 1,
        state_reason: "completed",
      },
      repository: {
        name: "conversation-rewards",
        owner: {
          login: "ubiquibot",
        },
      },
    },
    settings: JSON.stringify(cfg),
  };
});

describe("Price tests", () => {
  it("Should skip when no price label is set", async () => {
    const result = await run();
    expect(result).toEqual("No price label has been set. Skipping permit generation.");
  });
});
