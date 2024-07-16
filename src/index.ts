import * as core from "@actions/core";
import * as github from "@actions/github";
import logger from "./helpers/logger";
import { run } from "./run";

export default run()
  .then((result) => {
    console.log(JSON.stringify(github.context, null, 2));
    core?.setOutput("result", result);
    return result;
  })
  .catch((e) => {
    logger.error(`Failed to run comment evaluation: ${e}`, e);
    return e;
  });
