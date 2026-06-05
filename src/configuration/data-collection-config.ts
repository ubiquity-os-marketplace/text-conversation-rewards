import { Static, Type } from "@sinclair/typebox";

export const dataCollectionConfigurationType = Type.Object(
  {
    /**
     * The maximum amount of retries on failure.
     */
    maxAttempts: Type.Number({
      default: 10,
      minimum: 1,
      description: "The maximum amount of retries on failure",
      examples: ["10"],
    }),
    /**
     * The delay between each retry, in milliseconds.
     */
    delayMs: Type.Number({
      default: 1000,
      minimum: 100,
      description: "The delay between each retry, in milliseconds",
      examples: ["1000"],
    }),
    /**
     * Optional Google Sheets CSV source for task activity.
     * When configured, rows matching `taskId` are normalized into the same issue/comment
     * shape used by the existing reward pipeline.
     */
    googleSheets: Type.Optional(
      Type.Object({
        csvUrl: Type.String({
          description: "Published Google Sheets CSV export URL.",
          examples: ["https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=0"],
        }),
        taskId: Type.String({
          description: "Task identifier to load from the sheet.",
          examples: ["TASK-123"],
        }),
        taskIdColumn: Type.String({ default: "task_id" }),
        titleColumn: Type.String({ default: "title" }),
        bodyColumn: Type.String({ default: "body" }),
        authorColumn: Type.String({ default: "author" }),
        commentIdColumn: Type.String({ default: "comment_id" }),
        createdAtColumn: Type.String({ default: "created_at" }),
        assigneeColumn: Type.String({ default: "assignee" }),
        urlColumn: Type.String({ default: "url" }),
        priceLabelColumn: Type.String({ default: "price_label" }),
      })
    ),
  },
  { default: {} }
);

export type DataCollectionConfiguration = Static<typeof dataCollectionConfigurationType>;
