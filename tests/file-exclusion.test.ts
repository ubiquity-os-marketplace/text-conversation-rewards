import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { ContextPlugin } from "../src/types/plugin-input";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";

const ctx = {
  config: cfg,
  logger: new Logs("debug"),
  octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
} as unknown as ContextPlugin;

const { ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module");

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Modules tests", () => {
  const reviewIncentivizer = new ReviewIncentivizerModule(ctx);

  beforeEach(async () => {
    jest.spyOn(ReviewIncentivizerModule.prototype, "getTripleDotDiffAsObject").mockImplementation(() => {
      return Promise.resolve({
        "src/index.ts": { addition: 50, deletion: 50 },
        "src/helpers/utils.ts": { addition: 50, deletion: 50 },
        "dist/generated.ts": { addition: 50, deletion: 50 },
        "dist/lang_generated.ts": { addition: 50, deletion: 50 },
        "tests/main.test.ts": { addition: 50, deletion: 50 },
      });
    });
  });

  it("should calculate total diff when no patterns are excluded", async () => {
    const result = await reviewIncentivizer.getReviewableDiff("owner", "repo", "baseSha", "headSha");

    expect(result).toEqual({
      addition: 250,
      deletion: 250,
    });
  });

  it("should exclude files matching ANY of the patterns", async () => {
    const result = await reviewIncentivizer.getReviewableDiff("owner", "repo", "baseSha", "headSha", [
      "dist/**",
      "tests/**",
    ]);
    expect(result).toEqual({
      addition: 100,
      deletion: 100,
    });
  });
});
