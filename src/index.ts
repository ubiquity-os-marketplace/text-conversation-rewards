import * as core from "@actions/core";
import { run } from "./run";

run()
  .then((result) => {
    core?.setOutput("result", result);
  })
  .catch((e) => {
    console.error("Failed to run comment evaluation:", e);
    core?.setFailed(e.toString());
  });
