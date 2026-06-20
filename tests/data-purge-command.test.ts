import { describe, expect, it, jest } from "@jest/globals";
import { DataPurgeModule } from "../src/parser/data-purge-module";
import { ContextPlugin } from "../src/types/plugin-input";

function createContext(): ContextPlugin {
  return {
    config: {
      incentives: {
        dataPurge: {
          skipCommentsWhileAssigned: "none",
        },
      },
    },
    logger: {
      debug: jest.fn(),
      warn: jest.fn((message: string) => new Error(message)),
    },
  } as unknown as ContextPlugin;
}

describe("DataPurgeModule command cleanup", () => {
  it("removes a multiline slash command and its payload from rewardable content", () => {
    const module = new DataPurgeModule(createContext());

    const cleaned = module["_cleanCommentBody"](
      "/ask\nPlease evaluate this implementation.\nThis prompt is command input."
    );

    expect(cleaned).toHaveLength(0);
  });
});
