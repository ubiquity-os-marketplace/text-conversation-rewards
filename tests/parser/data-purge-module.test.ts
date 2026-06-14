import { describe, expect, it, jest } from "@jest/globals";
import { DataPurgeModule } from "../../src/parser/data-purge-module";
import type { ContextPlugin } from "../../src/types/plugin-input";

describe("DataPurgeModule", () => {
  const context = {
    config: {
      incentives: {
        dataPurge: {},
      },
    },
    logger: {
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    },
  } as unknown as ContextPlugin;

  it("removes multiline slash commands and their payload", () => {
    const module = new DataPurgeModule(context);
    const body = [
      "This part should still be evaluated.",
      "",
      "/ask",
      "Please summarize the issue.",
      "This command payload should not be rewarded.",
    ].join("\n");

    expect(module["_cleanCommentBody"](body)).toBe("This part should still be evaluated.");
  });

  it("keeps normal paragraphs after a multiline slash command block", () => {
    const module = new DataPurgeModule(context);
    const body = [
      "/ask",
      "Please summarize the issue.",
      "",
      "This separate paragraph is a normal comment.",
    ].join("\n");

    expect(module["_cleanCommentBody"](body)).toBe("This separate paragraph is a normal comment.");
  });
});
