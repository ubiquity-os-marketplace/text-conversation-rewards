import * as core from "@actions/core";
import { IssueActivity } from "./issue-activity";
import program from "./parser/command-line";
import { Processor } from "./parser/processor";
import { parseGitHubUrl } from "./start";

async function main() {
  if (program.eventName === "issues.closed") {
    const issue = parseGitHubUrl(program.eventPayload.issue.html_url);
    const activity = new IssueActivity(issue);
    await activity.init();
    const processor = new Processor();
    await processor.run(activity);
    const result = processor.dump();
    core?.setOutput("result", result);
  } else {
    console.warn(`${program.eventName} is not supported, skipping.`);
  }
}

main().catch((e) => {
  console.error("Failed to run comment evaluation:", e);
  core?.setFailed(e.toString());
});
