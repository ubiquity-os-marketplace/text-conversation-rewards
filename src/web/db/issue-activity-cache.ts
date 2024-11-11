import { IssueActivity } from "../../issue-activity";
import { ContextPlugin } from "../../types/plugin-input";
import { IssueParams } from "../../start";
import { open } from "sqlite";
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
      try {
        const relatedIssues = await db.all("SELECT * FROM issues WHERE related = ?", []);
        this._context.logger.debug(`Fetched ${relatedIssues.length} related issues from the cache.`);
      } catch (error) {
        this._context.logger.error("Error fetching related issues from the database:", { error: error as Error });
      }
    }
  }
}
