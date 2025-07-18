import { describe, expect, it } from "bun:test";
import { GitHubIssue } from "../src/github-types";
import { parsePriorityLabel } from "../src/helpers/github";

describe("FormattingEvaluatorModule", () => {
  it("should default to priority 1 when no priority label is present", () => {
    const labels: GitHubIssue["labels"] = [];
    const priority = parsePriorityLabel(labels);
    expect(priority).toBe(1);
  });

  it('should return priority 3 when "Priority: 3" label is present', () => {
    const labels = ["Priority: 3"];
    const priority = parsePriorityLabel(labels);
    expect(priority).toBe(3);
  });
});
