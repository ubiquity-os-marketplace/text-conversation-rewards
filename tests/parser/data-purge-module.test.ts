import { describe, expect, it } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { DataPurgeModule } from "../../src/parser/data-purge-module";
import { ContextPlugin } from "../../src/types/plugin-input";

const ctx = {
  config: {
    incentives: {
      dataPurge: {
        skipCommentsWhileAssigned: "none",
      },
    },
  },
  logger: new Logs("debug"),
  payload: {
    issue: {
      html_url: "https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/242",
    },
  },
} as unknown as ContextPlugin;

describe("DataPurgeModule", () => {
  const module = new DataPurgeModule(ctx) as unknown as {
    _cleanCommentBody(body: string): string;
  };

  it("removes multiline slash commands from rewardable comment content", () => {
    const empty = String();
    const body = [
      "/ask",
      "Can you check my scoring?",
      empty,
      "This text belongs to the slash command and should not be evaluated.",
    ].join("\n");

    expect(module._cleanCommentBody(body)).toBe(empty);
  });
});
