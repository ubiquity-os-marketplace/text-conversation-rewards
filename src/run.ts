import { collectLinkedMergedPulls } from "./data-collection/collect-linked-pulls";
import { GITHUB_DISPATCH_PAYLOAD_LIMIT } from "./helpers/constants";
import { checkIfClosedByCommand, manuallyCloseIssue } from "./helpers/issue-close";
import { getSortedPrices } from "./helpers/label-price-extractor";
import { logInvalidIssue } from "./helpers/log-invalid-issue";
import { isUserAllowedToGenerateRewards } from "./helpers/permissions";
import { handlePriceLabelValidation } from "./helpers/price-label-handler";
import { isIssueClosedEvent, isIssueCommentedEvent, isPullRequestEvent } from "./helpers/type-assertions";
import { IssueActivity } from "./issue-activity";
import { Processor } from "./parser/processor";
import { parseGitHubUrl } from "./start";
import { ContextPlugin } from "./types/plugin-input";
import { Result } from "./types/results";
import { LINKED_ISSUES, PullRequestClosingIssue } from "./types/requests";

async function handlePullRequestEvent(context: ContextPlugin<"pull_request.closed">) {
  const { logger, octokit } = context;

  if (!context.payload.pull_request.merged) {
    return logger.error("Pull requests must be merged to generate rewards.").logMessage.raw;
  }
  if (!context.config.incentives.shouldProcessUnlinkedPullRequests) {
    const pullRequest = parseGitHubUrl(context.payload.pull_request.html_url);
    const linkedIssues = await octokit.graphql<PullRequestClosingIssue>(LINKED_ISSUES, {
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      pull_number: pullRequest.issue_number,
    });
    if (!linkedIssues.repository.pullRequest.closingIssuesReferences.edges.length) {
      return logger.info("Unlinked pull-requests evaluation is disabled.").logMessage.raw;
    }
  }
}

async function handleEventTypeChecks(context: ContextPlugin) {
  const { eventName, logger } = context;

  if (context.command) {
    if (context.command.name === "finish") {
      return null;
    }
    return logger.error(`The command ${context.command.name} is not supported, skipping.`).logMessage.raw;
  }

  if (isIssueClosedEvent(context)) {
    return await handleClosedIssueEventChecks(context as ContextPlugin<"issues.closed">);
  } else if (isIssueCommentedEvent(context)) {
    if (!context.payload.comment.body.trim().startsWith("/finish")) {
      return logger.error(`${context.payload.comment.body} is not a valid command, skipping.`).logMessage.raw;
    }
  } else if (isPullRequestEvent(context)) {
    return await handlePullRequestEvent(context);
  } else {
    return logger.error(`${eventName} is not supported, skipping.`).logMessage.raw;
  }

  return null;
}

async function handleClosedIssueEventChecks(context: ContextPlugin<"issues.closed">) {
  const { logger, commentHandler } = context;
  if (context.payload.issue.state_reason !== "completed") {
    await logInvalidIssue(logger, context.payload.issue.html_url);
    return logger.info("Issue was not closed as completed. Skipping.").logMessage.raw;
  }
  if (await checkIfClosedByCommand(context)) {
    return logger.info("The issue was closed through the /finish command. Skipping.").logMessage.raw;
  }
  if (!(await preCheck(context))) {
    await logInvalidIssue(logger, context.payload.issue.html_url);
    const result = logger.error("All linked pull requests must be closed to generate rewards.");
    await commentHandler.postComment(context, result);
    return result.logMessage.raw;
  }
  return null;
}

export async function run(context: ContextPlugin) {
  const { payload, logger, config, commentHandler } = context;

  const eventCheckResult = await handleEventTypeChecks(context);
  if (eventCheckResult) {
    return eventCheckResult;
  }

  const issueItem = "issue" in payload ? payload.issue : payload.pull_request;

  if (config.incentives.collaboratorOnlyPaymentInvocation && !(await isUserAllowedToGenerateRewards(context))) {
    await logInvalidIssue(logger, issueItem.html_url);
    const result =
      payload.sender.type === "Bot"
        ? logger.warn("Bots can not generate rewards.")
        : logger.error("You are not allowed to generate rewards.");
    await commentHandler.postComment(context, result);
    return result.logMessage.raw;
  }

  logger.debug("Will use the following configuration:", { config });

  if (config.incentives.githubComment?.post) {
    await commentHandler.postComment(context, logger.info("Evaluating results. Please wait..."));
  }

  const issue = parseGitHubUrl(issueItem.html_url);
  const activity = new IssueActivity(context, issue);
  await activity.init();

  // Only check price labels for issues
  if (!activity.self?.pull_request) {
    const shouldProceed = await handlePriceLabelValidation(context, activity);
    if (!shouldProceed) {
      const errorMsg = "No price label has been set. Skipping permit generation.";
      const result = logger.error(errorMsg);
      await commentHandler.postComment(context, result);
      return result.logMessage.raw;
    }

    const sortedPriceLabels = getSortedPrices(activity.self?.labels);
    if (sortedPriceLabels.length > 0 && sortedPriceLabels[0] === 0) {
      throw logger.warn(
        "No rewards have been distributed for this task because it was explicitly marked with a Price: 0 label."
      );
    }
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
  const { octokit, logger } = context;

  if (!isIssueClosedEvent(context)) {
    return true;
  }
  const issue = parseGitHubUrl(context.payload.issue.html_url);
  const linkedPulls = (await collectLinkedMergedPulls(context, issue)).filter((pullRequest) => {
    // This can happen when a user deleted its account
    if (!pullRequest?.author?.login) {
      return false;
    }
    return context.payload.issue.assignees.map((assignee) => assignee?.login).includes(pullRequest.author.login);
  });
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
