import { DataPurgeModule } from "../../src/parser/data-purge-module";

describe("DataPurgeModule", () => {
  describe("_cleanCommentBody", () => {
    const module = Object.create(DataPurgeModule.prototype) as unknown as {
      _cleanCommentBody(body: string): string;
    };

    it("removes multiline slash commands and their content from reward evaluation", () => {
      const result = module._cleanCommentBody(
        "/ask\nThis follow-up text belongs to the command and should not be evaluated."
      );

      expect(result).toBe("");
    });

    it("removes multiline slash commands after quoted reply text", () => {
      const result = module._cleanCommentBody("> previous comment\n/ask\nPlease score this");

      expect(result).toBe("");
    });

    it("removes known slash commands with leading whitespace", () => {
      const result = module._cleanCommentBody(" /start\nPlease start this task");

      expect(result).toBe("");
    });

    it("preserves slash-prefixed paths at the start of normal comments", () => {
      expect(module._cleanCommentBody("/api/v1/rewards\nLooks good")).toBe("/api/v1/rewards\nLooks good");
      expect(module._cleanCommentBody("/src/parser/data-purge-module.ts\nLooks good")).toBe(
        "/src/parser/data-purge-module.ts\nLooks good"
      );
      expect(module._cleanCommentBody("/some/random/path\nLooks good")).toBe("/some/random/path\nLooks good");
    });

    it("preserves slash-prefixed paths in normal multiline comments", () => {
      const result = module._cleanCommentBody("Endpoint tested:\n/api/v1/rewards\nLooks good");

      expect(result).toBe("Endpoint tested:\n/api/v1/rewards\nLooks good");
    });

    it("preserves normal comments that start with a blank line", () => {
      const result = module._cleanCommentBody("\nThis is a normal comment.\n/api/v1/rewards");

      expect(result).toBe("This is a normal comment.\n/api/v1/rewards");
    });
  });
});
