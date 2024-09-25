import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "@octokit/rest";
import { validateAndDecodeSchemas } from "./helpers/validator";

export async function returnDataToKernel(
  repoToken: string,
  stateId: string,
  output: object,
  eventType = "return_data_to_ubiquibot_kernel"
) {
  const octokit = new Octokit({ auth: repoToken });
  return octokit.repos.createDispatchEvent({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    event_type: eventType,
    client_payload: {
      state_id: stateId,
      output: JSON.stringify(output),
    },
  });
}

async function main() {
  const payload = github.context.payload.inputs;

  validateAndDecodeSchemas(process.env, JSON.parse(payload.settings));
  return { errors: [], payload };
}

main()
  .then((payload) => {
    console.log("Configuration validated.");
    return payload;
  })
  .catch((errors) => {
    console.error("Failed to validate configuration", errors);
    core.setFailed(errors);
    return errors;
  })
  .then(async (errors) => {
    const payload = github.context.payload.inputs;
    await returnDataToKernel(process.env.GITHUB_TOKEN, payload.stateId, errors, "configuration_validation");
  })
  .catch((e) => {
    console.error("Failed to return the data to the kernel.", e);
  });
