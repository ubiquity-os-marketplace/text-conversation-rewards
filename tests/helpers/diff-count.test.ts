import { describe, expect, it } from "@jest/globals";
import { getCharacterContributionPercentages, sanitizeMarkdownBody } from "../../src/helpers/diff-count";

describe("Sanitize Markdown body", () => {
  it("removes a standalone HTML comment between paragraphs", () => {
    const input = "First paragraph\n\n<!-- hidden note -->\n\nSecond paragraph";
    const output = sanitizeMarkdownBody(input);
    expect(output).not.toContain("hidden note");
    expect(output).toMatch(/First paragraph/);
    expect(output).toMatch(/Second paragraph/);
  });

  it("removes multiple consecutive standalone HTML comments", () => {
    const input = "<!-- one -->\n<!-- two -->\nContent";
    const output = sanitizeMarkdownBody(input);
    expect(output).toBe("Content");
  });

  it("removes multiline standalone HTML comment", () => {
    const input = "Intro\n\n<!--\nLine A\nLine B\n-->\n\nOutro";
    const output = sanitizeMarkdownBody(input);
    expect(output).not.toContain("Line A");
    expect(output).toContain("Intro");
    expect(output).toContain("Outro");
  });

  it("preserves comment inside fenced code block", () => {
    const input = "Before\n\n```ts\n<!-- kept in code -->\nconst a = 1;\n```\n\nAfter";
    const output = sanitizeMarkdownBody(input);
    expect(output).toContain("<!-- kept in code -->");
  });

  it("preserves comment inside inline code span", () => {
    const input = "Inline: `<!-- kept inline -->` text.";
    const output = sanitizeMarkdownBody(input);
    expect(output).toContain("`<!-- kept inline -->`");
  });

  it("keeps normal HTML tags (not pure comments) intact", () => {
    const input = "<div>Content</div>\n\n<!-- gone -->\n\n<section>More</section>";
    const output = sanitizeMarkdownBody(input);
    expect(output).toContain("<div>Content</div>");
    expect(output).toContain("<section>More</section>");
    expect(output).not.toContain("gone");
  });
});

describe("getCharacterContributionPercentages integration with sanitization", () => {
  it("does not attribute removed standalone comments to any user", () => {
    const edits = [
      {
        createdAt: "2024-01-01T00:00:00Z",
        editedAt: "2024-01-01T00:00:00Z",
        diff: "Intro\n\n<!-- secret -->\n\nPublic",
        editor: { login: "whilefoo" },
      },
      {
        createdAt: "2024-01-01T01:00:00Z",
        editedAt: "2024-01-01T01:00:00Z",
        diff: "Intro\n\nPublic and more",
        editor: { login: "gentlementlegen" },
      },
    ];

    const res = getCharacterContributionPercentages(edits);
    // All characters from the standalone comment should be ignored; percentages sum to 1.
    const total = Object.values(res).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5);
    expect(res.whilefoo).toBeGreaterThan(0);
    expect(res.gentlementlegen).toBeGreaterThan(0);
  });

  it("retains attribution for comments inside code fences", () => {
    const edits = [
      {
        createdAt: "2024-01-01T00:00:00Z",
        editedAt: "2024-01-01T00:00:00Z",
        diff: "```\n<!-- code owned by whilefoo -->\nline\n```",
        editor: { login: "whilefoo" },
      },
      {
        createdAt: "2024-01-01T01:00:00Z",
        editedAt: "2024-01-01T01:00:00Z",
        diff: "```\n<!-- code owned by whilefoo -->\nline\nnew line\n```",
        editor: { login: "gentlementlegen" },
      },
    ];

    const res = getCharacterContributionPercentages(edits);
    expect(res.whilefoo).toBeGreaterThan(res.gentlementlegen);
    expect(res.whilefoo + res.gentlementlegen).toBeCloseTo(1, 5);
  });
});
