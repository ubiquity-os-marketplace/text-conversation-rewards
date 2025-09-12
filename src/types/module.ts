import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "./plugin-input";
import { Result } from "./results";

export interface Module {
  transform(data: Readonly<IssueActivity>, result: Result): Promise<Result>;
  get enabled(): boolean;
}

export abstract class BaseModule implements Module {
  protected context: ContextPlugin;

  constructor(context: ContextPlugin) {
    this.context = context;
  }

  abstract get enabled(): boolean;

  abstract transform(data: Readonly<IssueActivity>, result: Result): Promise<Result>;

  protected isPullRequest(): boolean {
    return (
      "pull_request" in this.context.payload ||
      ("issue" in this.context.payload && !!this.context.payload.issue.pull_request)
    );
  }
}
