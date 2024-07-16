import * as core from "@actions/core";
import logger from "./helpers/logger";
import { run } from "./run";

export default run()
  .then((result) => {
    core?.setOutput("result", result);
    return result;
  })
  .catch((e) => {
    logger.error(`Failed to run comment evaluation: ${e}`, e);
    return e;
  });
