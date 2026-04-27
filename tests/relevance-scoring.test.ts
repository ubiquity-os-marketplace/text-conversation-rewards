/**
 * Regression tests for Issue #223 — Relevance Scoring Prompt Refinement
 *
 * Problem: Administrative / management comments from maintainers (e.g., "please
 * open a draft PR", "I'll review shortly", "great work!") were scored high on
 * relevance despite being off-topic with respect to the technical specification.
 *
 * Fix: Explicit low-score patterns were added to _getDimensionInstructions for the
 * "relevance" dimension. These tests verify that those patterns are present in the
 * generated prompt so that future refactors cannot silently regress this behaviour.
 *
 * Reference: https://github.com/ubiquity-os-marketplace/text-vector-embeddings/issues/56#issuecomment-2556244548
 */

import { describe, expect, it } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { ContextPlugin } from "../src/types/plugin-input";
import cfg from "./__mocks__/results/valid-configuration.json";
import { Octokit } from "@octokit/rest";

// ──────────────────────────────────────────────────────────────────────────────
// Minimal context factory (no network calls — we test synchronous methods only)
// ──────────────────────────────────────────────────────────────────────────────
function makeContext() {
  return {
    config: cfg,
    logger: new Logs("debug"),
    octokit: new Octokit(),
    payload: {
      issue: { html_url: "https://github.com/test/repo/issues/1", number: 1, state_reason: "completed", assignees: [] },
      repository: { name: "repo", owner: { login: "test", id: 1 } },
    },
    eventName: "issues.closed",
  } as unknown as ContextPlugin;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────
describe("Relevance scoring prompt — Issue #223 regression", () => {
  const module = new ContentEvaluatorModule(makeContext());

  // Access private method via index access (only in tests)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getDimInstr = (dim: string, type: string) => (module as any)._getDimensionInstructions(dim, type);

  describe("relevance dimension — issue type", () => {
    const instr = getDimInstr("relevance", "issue");

    it("scoring explicitly lists administrative messages as 0-score", () => {
      expect(instr.scoring).toContain("Administrative");
      expect(instr.scoring).toContain("please create a PR");
    });

    it("scoring explicitly lists status updates as 0-score", () => {
      expect(instr.scoring).toContain("Status or progress updates");
      expect(instr.scoring).toContain("will look at this soon");
    });

    it("scoring explicitly lists praise/thanks as 0-score", () => {
      expect(instr.scoring).toContain("Praise");
      expect(instr.scoring).toContain("great work!");
    });

    it("scoring explicitly lists off-topic comments as 0-score", () => {
      expect(instr.scoring).toContain("Off-topic or tangential discussions");
    });

    it("criteria states admin comments receive 0 regardless of author role", () => {
      expect(instr.criteria).toContain("administrative in nature");
      expect(instr.criteria).toContain("score of 0");
      expect(instr.criteria).toContain("regardless of their standing");
    });

    it("scoring provides a concrete high-relevance example (1.0 threshold)", () => {
      expect(instr.scoring).toContain("1.0");
      expect(instr.scoring).toContain("root cause");
    });

    it("scoring provides a mid-relevance example (0.5 threshold)", () => {
      expect(instr.scoring).toContain("0.5");
    });
  });

  describe("relevance dimension — PR type", () => {
    const instr = getDimInstr("relevance", "pr");

    it("prNotes mentions administrative messages to avoid high scores", () => {
      expect(instr.prNotes).toContain("administrative messages");
    });
  });
});
