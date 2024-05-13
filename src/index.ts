import { IssueActivity } from "./issue-activity";
import program from "./parser/command-line";
import { Processor } from "./parser/processor";
import { parseGitHubUrl } from "./start";
import * as core from "@actions/core";
import * as github from "@actions/github";

async function main() {
  const issueUrl = program.opts().issue;
  const webhookPayload = github.context.payload.inputs;
  const inputs = {
    stateId: webhookPayload.stateId,
    eventName: webhookPayload.eventName,
    authToken: webhookPayload.authToken,
    ref: webhookPayload.ref,
  };
  console.log("event", inputs.eventName);
  if (inputs.eventName === "issues.closed") {
    const issue = parseGitHubUrl(issueUrl);
    const activity = new IssueActivity(issue);
    await activity.init();
    const processor = new Processor();
    await processor.run(activity);
    const result = processor.dump();
    core?.setOutput("result", result);
  } else {
    console.warn(`${inputs.eventName} is not supported, skipping.`);
  }
}

main().catch((e) => {
  console.error("Failed to run comment evaluation:", e);
  core?.setFailed(e.toString());
});
