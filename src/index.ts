import * as core from "@actions/core";
import { IssueActivity } from "./issue-activity";
import program from "./parser/command-line";
import { Processor } from "./parser/processor";
import { parseGitHubUrl } from "./start";
import { getOctokitInstance } from "./get-authentication-token.ts";

export async function main() {
  const { eventPayload, eventName } = program;
  if (eventName === "issues.closed") {
    if (eventPayload.issue.state_reason !== "completed") {
      const result = "# Issue was not closed as completed. Skipping.";
      await getOctokitInstance().issues.createComment({
        body: `\`\`\`text\n${result}\`\`\``,
        repo: eventPayload.repository.name,
        owner: eventPayload.repository.owner.login,
        issue_number: eventPayload.issue.number,
      });
      return result;
    }
    const issue = parseGitHubUrl(eventPayload.issue.html_url);
    const activity = new IssueActivity(issue);
    await activity.init();
    const processor = new Processor();
    await processor.run(activity);
    return processor.dump();
  } else {
    const result = `${eventName} is not supported, skipping.`;
    console.warn(result);
    return result;
  }
}

main()
  .then((result) => {
    core?.setOutput("result", result);
  })
  .catch((e) => {
    console.error("Failed to run comment evaluation:", e);
    core?.setFailed(e.toString());
  });
