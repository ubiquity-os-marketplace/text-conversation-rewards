import { ContextPlugin } from "../src/types/plugin-input";
import { FormattingEvaluatorModule } from "../src/parser/formatting-evaluator-module";
import { GitHubIssue } from "../src/github-types";
import { describe, expect, it, jest } from "@jest/globals";

describe("FormattingEvaluatorModule", () => {
  // Mocking the context plugin
  const context = {
    config: {
      incentives: {
        formattingEvaluator: null,
      },
    },
    logger: {
      error: jest.fn(),
    },
  } as unknown as ContextPlugin;

  const module = new FormattingEvaluatorModule(context);

  it("should default to priority 1 when no priority label is present", () => {
    const labels: GitHubIssue["labels"] = [];
    const priority = module["_parsePriorityLabel"](labels);
    expect(priority).toBe(1);
  });

  it('should return priority 3 when "Priority: 3" label is present', () => {
    const labels = ["Priority: 3"];
    const priority = module["_parsePriorityLabel"](labels);
    expect(priority).toBe(3);
  });
});
