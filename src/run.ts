import { postComment } from "@ubiquity-os/plugin-sdk";
import { collectLinkedMergedPulls } from "./data-collection/collect-linked-pulls";
import { GITHUB_DISPATCH_PAYLOAD_LIMIT } from "./helpers/constants";
import { getSortedPrices } from "./helpers/label-price-extractor";
import { IssueActivity } from "./issue-activity";
import { Processor } from "./parser/processor";
import { parseGitHubUrl } from "./start";
import { ContextPlugin } from "./types/plugin-input";
import { Result } from "./types/results";
import { isUserAllowedToGeneratePermits } from "./helpers/permissions";

export async function run(context: ContextPlugin) {
  const { eventName, payload, logger, config } = context;
  if (eventName !== "issues.closed") {
    return logger.error(`${eventName} is not supported, skipping.`).logMessage.raw;
  }

  if (payload.issue.state_reason !== "completed") {
    return logger.info("Issue was not closed as completed. Skipping.").logMessage.raw;
  }

  if (!(await preCheck(context))) {
    const result = logger.error("All linked pull requests must be closed to generate rewards.");
    await postComment(context, result);
    return result.logMessage.raw;
  }

  if (config.incentives.collaboratorOnlyPaymentInvocation && !(await isUserAllowedToGeneratePermits(context))) {
    const result =
      payload.sender.type === "Bot"
        ? logger.info("A human action is needed to generate permits.")
        : logger.error("You are not allowed to generate permits.");
    await postComment(context, result);
    return result.logMessage.raw;
  }

  logger.debug("Will use the following configuration:", { config });

  if (config.incentives.githubComment?.post) {
    await postComment(context, logger.ok("Evaluating results. Please wait..."));
  }

  const issue = parseGitHubUrl(payload.issue.html_url);
  const activity = new IssueActivity(context, issue);
  await activity.init();
  if (config.incentives.requirePriceLabel && !getSortedPrices(activity.self?.labels).length) {
    const result = logger.error("No price label has been set. Skipping permit generation.");
    await postComment(context, result);
    return result.logMessage.raw;
  }
  const processor = new Processor(context);
  await processor.run(activity);
  let result = processor.dump();
  if (result.length > GITHUB_DISPATCH_PAYLOAD_LIMIT) {
    logger.info("Truncating payload as it will trigger an error.");
    const resultObject = JSON.parse(result) as Result;
    for (const [key, value] of Object.entries(resultObject)) {
      resultObject[key] = {
        userId: value.userId,
        task: value.task,
        permitUrl: value.permitUrl,
        total: value.total,
      };
    }
    result = JSON.stringify(resultObject);
  }
  return JSON.parse(result);
}

async function preCheck(context: ContextPlugin) {
  const { payload, octokit, logger } = context;

  const issue = parseGitHubUrl(payload.issue.html_url);
  const linkedPulls = (await collectLinkedMergedPulls(context, issue)).filter((pullRequest) =>
    context.payload.issue.assignees.map((assignee) => assignee?.login).includes(pullRequest.author.login)
  );
  logger.debug("Checking open linked pull-requests for", {
    issue,
    linkedPulls,
  });
  if (linkedPulls.some((linkedPull) => linkedPull.state === "OPEN")) {
    await octokit.rest.issues.update({
      owner: issue.owner,
      repo: issue.repo,
      issue_number: issue.issue_number,
      state: "open",
    });
    return false;
  }
  return true;
}
