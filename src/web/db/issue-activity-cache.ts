import { IssueActivity, Review } from "../../issue-activity";
import { ContextPlugin } from "../../types/plugin-input";
import { IssueParams } from "../../start";
import { open } from "sqlite";
import path from "node:path";
import sqlite3 from "sqlite3";
import { GitHubIssue, GitHubIssueComment, GitHubIssueEvent } from "../../github-types";

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
      try {
        const relatedIssue = await db.get<GitHubIssue>(
          "SELECT * FROM issues WHERE html_url = ?",
          this._context.payload.issue.html_url
        );
        this._context.logger.debug(`Fetched related issues from the cache.`, { relatedIssue });
        if (!relatedIssue) {
          await super.init();
          // TODO: insert new data after fetch
        } else {
          const events = await db.all<GitHubIssueEvent[]>(
            "SELECT * FROM events WHERE html_url_fk = ?",
            this._context.payload.issue.html_url
          );
          const comments = await db.all<GitHubIssueComment[]>(
            "SELECT * FROM comments WHERE html_url_fk = ?",
            this._context.payload.issue.html_url
          );
          const reviews = await db.all<Review[]>(
            "SELECT * FROM reviews WHERE html_url_fk = ?",
            this._context.payload.issue.html_url
          );
          this.self = relatedIssue;
          this.events = events;
          this.comments = comments;
          this.linkedReviews = reviews;
          this._context.logger.debug("cached values", {
            self: this.self,
            events: this.events,
            comments: this.comments,
            linkedReviews: this.linkedReviews,
          });
        }
      } catch (error) {
        if (error && typeof error === "object" && "errno" in error) {
          console.error(error);
        } else {
          this._context.logger.error("Error fetching related issues from the database:", { error: error as Error });
        }
      }
    }
  }
}
