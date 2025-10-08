import { IssueActivity } from "../../issue-activity";
import { ContextPlugin } from "../../types/plugin-input";
import { IssueParams } from "../../start";
import { Database, open } from "sqlite";
import path from "node:path";
import sqlite3 from "sqlite3";

export class IssueActivityCache extends IssueActivity {
  constructor(
    context: ContextPlugin,
    issueParams: IssueParams,
    private _enableCache: boolean
  ) {
    super(context, issueParams);
  }

  async init(): Promise<void> {
    if (!this._enableCache) {
      await super.init();
    } else {
      this._context.logger.debug("Fetching data from the cached db.");
      const db = await open({
        filename: path.resolve(__dirname, "./database.db"),
        driver: sqlite3.cached.Database,
      });
      await this._initDatabase(db);

      try {
        const issue =
          "issue" in this._context.payload ? this._context.payload.issue : this._context.payload.pull_request;
        const relatedIssue = await db.get<{
          issue: string;
          events: string;
          comments: string;
          reviews: string;
        }>("SELECT * FROM issues WHERE html_url = ?", issue.html_url);
        this._context.logger.debug(`Fetched related issues from the cache.`, { relatedIssue });
        if (!relatedIssue) {
          await super.init();
          await db.run(
            `INSERT INTO issues (html_url, issue, events, comments, reviews) VALUES (?, ?, ?, ?, ?)`,
            issue.html_url,
            JSON.stringify(this.self),
            JSON.stringify(this.events),
            JSON.stringify(this.comments),
            JSON.stringify(this.linkedMergedPullRequests)
          );
        } else {
          this.self = JSON.parse(relatedIssue.issue);
          this.events = JSON.parse(relatedIssue.events);
          this.comments = JSON.parse(relatedIssue.comments);
          this.linkedMergedPullRequests = JSON.parse(relatedIssue.reviews);
        }
      } catch (error) {
        if (error && typeof error === "object" && "errno" in error) {
          console.error(error);
        } else {
          throw this._context.logger.error(`Error fetching related issues from the database`, {
            error: error as Error,
          });
        }
      }
    }
  }

  private async _initDatabase(db: Database): Promise<void> {
    await db.exec(`
         CREATE TABLE IF NOT EXISTS issues (
           html_url TEXT PRIMARY KEY,
           issue TEXT,
           events TEXT,
           comments TEXT,
           reviews TEXT
         );
       `);
  }
}
