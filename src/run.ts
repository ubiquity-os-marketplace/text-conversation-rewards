import { getSortedPrices } from "./helpers/label-price-extractor.ts";
import { IssueActivity } from "./issue-activity";
import program from "./parser/command-line";
import { Processor } from "./parser/processor";
import { parseGitHubUrl } from "./start";
import { getOctokitInstance } from "./get-authentication-token.ts";
import configuration from "./configuration/config-reader.ts";

export async function run() {
  const { eventPayload, eventName } = program;
  if (eventName === "issues.closed") {
    if (eventPayload.issue.state_reason !== "completed") {
      const result = "# Issue was not closed as completed. Skipping.";
      await getOctokitInstance().issues.createComment({
        body: `\`\`\`text\n${result}\n\`\`\``,
        repo: eventPayload.repository.name,
        owner: eventPayload.repository.owner.login,
        issue_number: eventPayload.issue.number,
      });
      return result;
    }
    const issue = parseGitHubUrl(eventPayload.issue.html_url);
    const activity = new IssueActivity(issue);
    await activity.init();
    if (configuration.incentives.requirePriceLabel && !getSortedPrices(activity.self?.labels).length) {
      const result = "! No price label has been set. Skipping permit generation.";
      await getOctokitInstance().issues.createComment({
        body: `\`\`\`text\n${result}\n\`\`\``,
        repo: eventPayload.repository.name,
        owner: eventPayload.repository.owner.login,
        issue_number: eventPayload.issue.number,
      });
      return result;
    }
    const processor = new Processor();
    await processor.run(activity);
    return processor.dump();
  } else {
    const result = `${eventName} is not supported, skipping.`;
    console.warn(result);
    return result;
  }
}
