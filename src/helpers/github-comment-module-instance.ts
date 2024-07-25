import * as github from "@actions/github";
import { GithubCommentModule } from "../parser/github-comment-module";

export function getGithubWorkflowRunUrl() {
  return `${github.context.payload.repository?.html_url}/actions/runs/${github.context.runId}`;
}

const githubCommentModule = new GithubCommentModule();

export default githubCommentModule;
