import * as github from "@actions/github";

export function getGithubWorkflowRunUrl() {
  return `${github.context.payload.repository?.html_url}/actions/runs/${github.context.runId}`;
}
