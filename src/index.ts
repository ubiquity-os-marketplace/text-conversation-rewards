import * as core from "@actions/core";
import githubCommentModuleInstance, { getGithubWorkflowRunUrl } from "./helpers/github-comment-module-instance";
import logger from "./helpers/logger";
import { run } from "./run";

export default run()
  .then((result) => {
    core?.setOutput("result", result);
    return result;
  })
  .catch(async (e) => {
    const errorMessage = logger.error(`Failed to run comment evaluation: ${e}`, e);
    try {
      await githubCommentModuleInstance.postComment(
        `${errorMessage?.logMessage.diff}\n<!--${getGithubWorkflowRunUrl()}\n${JSON.stringify(errorMessage?.metadata, null, 2)}-->`
      );
    } catch (err) {
      logger.error(`Failed to update Github comment: ${err}`);
    }
    return e;
  });
