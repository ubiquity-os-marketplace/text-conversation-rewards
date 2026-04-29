import { describe, expect, it } from "@jest/globals";
import { cleanCommentBody } from "../src/parser/data-purge-module";

describe("cleanCommentBody", () => {
  it("removes multiline slash command blocks from rewardable comment text", () => {
    const body = [
      "/ask can you check this?",
      "This line is command context and should not be rewarded.",
      "Another command detail should be removed.",
      "",
      "This follow-up is a normal comment with https://example.com",
    ].join("\n");

    expect(cleanCommentBody(body)).toBe("This follow-up is a normal comment with [https://example.com](https://example.com)");
  });

  it("removes an entire slash command comment when no normal text follows", () => {
    expect(cleanCommentBody("/ask\nscore this hidden command context")).toBe("");
  });
});
