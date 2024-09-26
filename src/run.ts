import configuration from "./configuration/config-reader";
import githubCommentModuleInstance from "./helpers/github-comment-module-instance";
import { getSortedPrices } from "./helpers/label-price-extractor";
import logger from "./helpers/logger";
import { IssueActivity } from "./issue-activity";
import program from "./parser/command-line";
import { Processor } from "./parser/processor";
import { parseGitHubUrl } from "./start";

export async function run() {
  const { eventPayload, eventName } = program;
  if (eventName === "issues.closed") {
    if (eventPayload.issue.state_reason !== "completed") {
      return logger.info("Issue was not closed as completed. Skipping.").logMessage.raw;
    }
    const issue = parseGitHubUrl(eventPayload.issue.html_url);
    const activity = new IssueActivity(issue);
    await activity.init();
    if (configuration.incentives.requirePriceLabel && !getSortedPrices(activity.self?.labels).length) {
      const result = logger.error("No price label has been set. Skipping permit generation.");
      await githubCommentModuleInstance.postComment(result.logMessage.diff);
      return result.logMessage.raw;
    }
    const processor = new Processor();
    await processor.run(activity);
    return processor.dump();
  } else {
    return logger.error(`${eventName} is not supported, skipping.`).logMessage.raw;
  }
}
