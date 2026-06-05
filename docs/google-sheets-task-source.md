# Google Sheets Task Source

The default task source remains GitHub. To evaluate a task from a published Google Sheets CSV export instead, configure `dataCollection.googleSheets`.

```yaml
dataCollection:
  googleSheets:
    csvUrl: "https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=0"
    taskId: "TASK-123"
```

By default, matching rows are selected with the `task_id` column. Each matching row can represent either the task specification or a contribution comment.

## Default Columns

| Column | Purpose |
| --- | --- |
| `task_id` | Task identifier used to select matching rows |
| `title` | Task title |
| `body` | Task specification or comment body |
| `author` | Human author login/name |
| `comment_id` | Stable comment id; generated from row order when blank |
| `created_at` | ISO timestamp |
| `assignee` | Optional assignee login/name |
| `url` | Canonical task URL |
| `price_label` | Optional price label such as `Price: 50 USD` |

Every column name can be overridden in `dataCollection.googleSheets`.
