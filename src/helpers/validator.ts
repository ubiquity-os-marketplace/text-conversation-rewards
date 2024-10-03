import * as github from "@actions/github";
import { Octokit } from "@octokit/rest";

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
