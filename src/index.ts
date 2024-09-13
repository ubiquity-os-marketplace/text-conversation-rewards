import * as core from "@actions/core";
import githubCommentModuleInstance from "./helpers/github-comment-module-instance";
import { getGithubWorkflowRunUrl } from "./helpers/github";
import logger from "./helpers/logger";
import { run } from "./run";

export default run()
  .then((result) => {
    core?.setOutput("result", result);
    return result;
  })
  .catch(async (e) => {
    const errorMessage = logger.error(`Failed to run comment evaluation. ${e?.logMessage?.raw || e}`, e);
    try {
      await githubCommentModuleInstance.postComment(
        `${errorMessage?.logMessage.diff}\n<!--\n${getGithubWorkflowRunUrl()}\n${JSON.stringify(errorMessage?.metadata, null, 2)}\n-->`
      );
    } catch (err) {
      logger.error(`Failed to update Github comment: ${err}`);
    }
    core?.setFailed(e);
    return e;
  });
