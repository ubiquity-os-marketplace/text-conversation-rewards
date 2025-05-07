import { collectLinkedMergedPulls } from "./data-collection/collect-linked-pulls";
import { GITHUB_DISPATCH_PAYLOAD_LIMIT } from "./helpers/constants";
import { checkIfClosedByCommand, manuallyCloseIssue } from "./helpers/issue-close";
import { getSortedPrices } from "./helpers/label-price-extractor";
import { isUserAllowedToGenerateRewards } from "./helpers/permissions";
import { IssueActivity } from "./issue-activity";
import { Processor } from "./parser/processor";
import { parseGitHubUrl } from "./start";
import { ContextPlugin } from "./types/plugin-input";
import { Result } from "./types/results";

function isIssueClosedEvent(context: ContextPlugin): context is ContextPlugin<"issues.closed"> {
  return context.eventName === "issues.closed";
}

function isIssueCommentedEvent(context: ContextPlugin): context is ContextPlugin<"issue_comment.created"> {
  return context.eventName === "issue_comment.created";
}

async function handleEventTypeChecks(context: ContextPlugin) {
  const { eventName, payload, logger, commentHandler } = context;

  if (isIssueClosedEvent(context)) {
    if (payload.issue.state_reason !== "completed") {
      return logger.info("Issue was not closed as completed. Skipping.").logMessage.raw;
    }
    if (await checkIfClosedByCommand(context)) {
      return logger.info("The issue was closed through the /finish command. Skipping.").logMessage.raw;
    }
    if (!(await preCheck(context))) {
      const result = logger.error("All linked pull requests must be closed to generate rewards.");
      await commentHandler.postComment(context, result);
      return result.logMessage.raw;
    }
  } else if (isIssueCommentedEvent(context)) {
    if (!context.payload.comment.body.trim().startsWith("/finish")) {
      return logger.error(`${context.payload.comment.body} is not a valid command, skipping.`).logMessage.raw;
    }
  } else {
    return logger.error(`${eventName} is not supported, skipping.`).logMessage.raw;
  }

  return null;
}

export async function run(context: ContextPlugin) {
  const { payload, logger, config, commentHandler } = context;

  const eventCheckResult = await handleEventTypeChecks(context);
  if (eventCheckResult) {
    return eventCheckResult;
  }

  if (config.incentives.collaboratorOnlyPaymentInvocation && !(await isUserAllowedToGenerateRewards(context))) {
    const result =
      payload.sender.type === "Bot"
        ? logger.warn("Bots can not generate rewards.")
        : logger.error("You are not allowed to generate rewards.");
    await commentHandler.postComment(context, result);
    return result.logMessage.raw;
  }

  logger.debug("Will use the following configuration:", { config });

  if (config.incentives.githubComment?.post) {
    await commentHandler.postComment(context, logger.ok("Evaluating results. Please wait..."));
  }

  const issue = parseGitHubUrl(payload.issue.html_url);
  const activity = new IssueActivity(context, issue);
  await activity.init();
  if (config.incentives.requirePriceLabel && !getSortedPrices(activity.self?.labels).length) {
    const result = logger.error("No price label has been set. Skipping permit generation.");
    await commentHandler.postComment(context, result);
    return result.logMessage.raw;
  }

  const sortedPriceLabels = getSortedPrices(activity.self?.labels);
  if (sortedPriceLabels.length > 0 && sortedPriceLabels[0] === 0) {
    throw logger.warn(
      "No rewards have been distributed for this task because it was explicitly marked with a Price: 0 label."
    );
  }

  if (isIssueCommentedEvent(context)) {
    await manuallyCloseIssue(context);
  }

  return generateResults(context, activity);
}

async function generateResults(context: ContextPlugin, activity: IssueActivity) {
  const processor = new Processor(context);
  await processor.run(activity);
  let result = processor.dump();
  if (result.length > GITHUB_DISPATCH_PAYLOAD_LIMIT) {
    context.logger.info("Truncating payload as it will trigger an error.");
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
