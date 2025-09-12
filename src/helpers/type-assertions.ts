import { ContextPlugin } from "../types/plugin-input";

export function isIssueClosedEvent(context: ContextPlugin): context is ContextPlugin<"issues.closed"> {
  return context.eventName === "issues.closed";
}

export function isIssueCommentedEvent(context: ContextPlugin): context is ContextPlugin<"issue_comment.created"> {
  return context.eventName === "issue_comment.created";
}

export function isPullRequestEvent(context: ContextPlugin): context is ContextPlugin<"pull_request.closed"> {
  return context.eventName === "pull_request.closed";
}
