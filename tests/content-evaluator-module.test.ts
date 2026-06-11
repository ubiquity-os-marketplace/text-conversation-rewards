import { describe, expect, it, jest } from "@jest/globals";
import { CommentKind } from "../src/configuration/comment-types";
import { ContentEvaluatorModule, stripSlashCommandBlocks } from "../src/parser/content-evaluator-module";
import { GithubCommentScore } from "../src/types/results";

const EMPTY_COMMAND_RESULT = String();

function createModule() {
  return new ContentEvaluatorModule({
    config: {
      incentives: {
        contentEvaluator: {
          multipliers: [],
          openAi: {
            maxRetries: 1,
            tokenCountLimit: 10000,
          },
        },
      },
    },
    payload: {
      issue: {},
    },
  } as never);
}

function createComment(id: number, content: string, commentType = CommentKind.ISSUE): GithubCommentScore {
  return {
    id,
    content,
    commentType,
    timestamp: "2026-01-01T00:00:00.000Z",
    url: `https://example.com/comments/${id}`,
    score: {
      multiplier: 1,
      reward: 1,
      authorship: 1,
    },
  };
}

describe("ContentEvaluatorModule slash command filtering", () => {
  it("removes multiline slash command blocks while preserving later discussion", () => {
    expect(stripSlashCommandBlocks("/ask\nplease summarize this issue")).toBe(EMPTY_COMMAND_RESULT);
    expect(stripSlashCommandBlocks("Useful note\n/ask\nplease summarize\n\nFollow up")).toBe(
      "Useful note\n\nFollow up"
    );
    expect(stripSlashCommandBlocks("This mentions /ask inline and should stay")).toBe(
      "This mentions /ask inline and should stay"
    );
  });

  it("omits command-only comments from LLM prompt input", () => {
    const module = createModule();
    const split = module._splitCommentsByPrompt([
      createComment(1, "/ask\nplease summarize this issue"),
      createComment(2, "/ask\nplease summarize\n\nActual contribution"),
      createComment(3, "Regular contribution"),
      createComment(4, "/ask\nplease review this diff", CommentKind.PULL),
      createComment(5, "/ask\nplease review\n\nThis line matters", CommentKind.PULL),
    ]);

    expect(split.commentsToEvaluate).toEqual([
      { id: 2, comment: "Actual contribution" },
      { id: 3, comment: "Regular contribution" },
    ]);
    expect(split.prCommentsToEvaluate).toEqual([{ id: 5, comment: "This line matters", diffHunk: undefined }]);
  });

  it("assigns zero relevance and reward to command-only comments", async () => {
    const module = createModule();
    jest.spyOn(module, "_evaluateComments").mockResolvedValue({ 2: 1 });

    const comments = [
      createComment(1, "/ask\nplease summarize this issue"),
      createComment(2, "Implemented the requested fix"),
    ];
    const result = await module._processComment("alice", comments, "Issue body", [
      { id: 2, author: "alice", comment: "Implemented the requested fix" },
    ]);

    expect(result[0].score?.relevance).toBe(0);
    expect(result[0].score?.reward).toBe(0);
    expect(result[1].score?.relevance).toBe(1);
    expect(result[1].score?.reward).toBe(1);
  });
});
