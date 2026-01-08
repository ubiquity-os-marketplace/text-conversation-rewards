import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";
import { IssueActivityCache } from "../web/db/issue-activity-cache";
import { getSortedPrices } from "./label-price-extractor";
import { logInvalidIssue } from "./log-invalid-issue";
import { isPullRequest } from "../types/module";

type ActivityType = IssueActivity | IssueActivityCache;
type LoggerType = ContextPlugin["logger"];

async function tryAutoFetchingPrice(logger: LoggerType, activity: ActivityType): Promise<void> {
  logger.info("No price label found, attempting to fetch price automatically...");
  const issueTitle = activity.self?.title;
  const issueDescription = activity.self?.body;

  if (!issueTitle || !issueDescription) {
    logger.warn("Issue title or description is missing, cannot fetch price automatically.");
    return;
  }

  try {
    const response = await fetch("https://ubiquity-os-daemon-pricing-development.azurewebsites.net/time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issue_title: issueTitle,
        issue_description: issueDescription,
      }),
    });

    if (!response.ok) {
      logger.warn(`Automatic price fetching failed: API request failed with status ${response.status}.`, {
        status: response.status,
        statusText: response.statusText,
      });
      return;
    }

    const data = await response.json();
    if (!data || !data.price) {
      logger.warn("Automatic price fetching failed: API response did not contain a valid price.", { data });
      return;
    }

    const price = data.price;
    const priceLabelName = `Price: ${price} USD`;
    logger.info(`Automatic price fetched: ${price}. Adding label locally: ${priceLabelName}`);

    const fakeLabel = {
      id: 0,
      node_id: activity.self?.node_id ?? "",
      url: activity.self?.url ?? activity.self?.html_url ?? "",
      name: priceLabelName,
      color: "ededed",
      default: false,
      description: null,
    };

    if (activity.self?.labels) {
      activity.self.labels.push(fakeLabel);
    } else if (activity.self) {
      activity.self.labels = [fakeLabel];
    }
  } catch (err) {
    logger.error("An error occurred during automatic price fetching:", { err });
  }
}

export async function handlePriceLabelValidation(
  context: Pick<ContextPlugin, "config" | "logger" | "payload">,
  activity: ActivityType
): Promise<boolean> {
  const { config, logger, payload } = context;

  const isPriceLabelRequired = config.incentives.requirePriceLabel;
  const hasPriceLabel = getSortedPrices(activity.self?.labels).length > 0;

  if (isPriceLabelRequired && !hasPriceLabel && !isPullRequest(context)) {
    if (isPriceLabelRequired === "auto") {
      await tryAutoFetchingPrice(logger, activity);
      if (!getSortedPrices(activity.self?.labels).length) {
        logger.warn("Proceeding without a price label after auto-fetch attempt failed to add one.");
      }
      return true;
    } else {
      const issue = "issue" in payload ? payload.issue : payload.pull_request;
      await logInvalidIssue(logger, issue.html_url);
      logger.error("No price label has been set. Skipping permit generation.");
      return false;
    }
  }
  return true;
}
