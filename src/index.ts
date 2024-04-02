import { IssueActivity } from "./issue-activity";
import program from "./parser/command-line";
import { Processor } from "./parser/processor";
import { parseGitHubUrl } from "./start";

async function main() {
  const issueUrl = program.opts().issue;
  const issue = parseGitHubUrl(issueUrl);
  const activity = new IssueActivity(issue);
  await activity.init();
  const processor = new Processor();
  await processor.run(activity);
  processor.dump();
}

main().catch((e) => console.error("Failed to run comment evaluation:", e));
