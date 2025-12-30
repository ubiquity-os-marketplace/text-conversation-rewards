import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";
import { IssueActivityCache } from "../web/db/issue-activity-cache";
import { getSortedPrices } from "./label-price-extractor";
import { logInvalidIssue } from "./log-invalid-issue";
import { isPullRequest } from "../types/module";

type ActivityType = IssueActivity | IssueActivityCache;

export async function handlePriceLabelValidation(
  context: Pick<ContextPlugin, "config" | "logger" | "payload">,
  activity: ActivityType
): Promise<boolean> {
  const { config, logger, payload } = context;

  const requiresPriceLabel = config.incentives.requirePriceLabel;
  const hasPriceLabel = getSortedPrices(activity.self?.labels).length > 0;

  if (requiresPriceLabel && !hasPriceLabel && !isPullRequest(context)) {
    const issue = "issue" in payload ? payload.issue : payload.pull_request;
    await logInvalidIssue(logger, issue.html_url);
    logger.error("No price label has been set. Skipping permit generation.");
    return false;
  }
  return true;
}
