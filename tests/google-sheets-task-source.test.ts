import { describe, expect, it, jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { loadGoogleSheetsTaskActivity } from "../src/integrations/google-sheets-task-source";
import { ContextPlugin } from "../src/types/plugin-input";

describe("Google Sheets task source", () => {
  it("normalizes matching sheet rows into issue activity", async () => {
    const csv = [
      "task_id,title,body,author,comment_id,created_at,assignee,url,price_label",
      "TASK-1,Spec,Build this,alice,spec,2026-01-01T00:00:00.000Z,bob,https://github.com/org/repo/issues/1,Price: 50 USD",
      "TASK-1,Spec,Useful comment,carol,c1,2026-01-01T01:00:00.000Z,bob,https://github.com/org/repo/issues/1,Price: 50 USD",
      "TASK-2,Other,Ignored,dave,c2,2026-01-01T02:00:00.000Z,,https://github.com/org/repo/issues/2,Price: 10 USD",
    ].join("\n");
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(csv));

    const activity = await loadGoogleSheetsTaskActivity(
      {
        logger: new Logs("debug"),
        payload: {
          sender: { login: "sender" },
          issue: { html_url: "https://github.com/org/repo/issues/1" },
        },
      } as unknown as ContextPlugin,
      {
        csvUrl: "https://docs.google.com/sheet.csv",
        taskId: "TASK-1",
        taskIdColumn: "task_id",
        titleColumn: "title",
        bodyColumn: "body",
        authorColumn: "author",
        commentIdColumn: "comment_id",
        createdAtColumn: "created_at",
        assigneeColumn: "assignee",
        urlColumn: "url",
        priceLabelColumn: "price_label",
      }
    );

    expect(activity.self.title).toBe("Spec");
    expect(activity.self.assignee?.login).toBe("bob");
    expect(activity.self.labels).toEqual([{ name: "Price: 50 USD" }]);
    expect(activity.comments).toHaveLength(2);
    expect(activity.comments.map((comment) => comment.user?.login)).toEqual(["alice", "carol"]);
  });
});
