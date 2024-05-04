import * as github from "@actions/github";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { UBIQUIBOT_APP_ID, INSTALLATION_ID, UBIQUIBOT_APP_PRIVATE_KEY } from "./configuration/constants";

let octokitInstance: Octokit | null = null;

async function getAuthenticationToken() {
  const appId = UBIQUIBOT_APP_ID;
  const privateKey = UBIQUIBOT_APP_PRIVATE_KEY;
  // Defaults to the ENV value in case we are not in a GitHub Action context
  const inputs = {
    installationId: INSTALLATION_ID,
  };

  if (github.context.payload.inputs) {
    const eventPayload = JSON.parse(github.context.payload.inputs.eventPayload);
    if (eventPayload?.installation) {
      inputs.installationId = eventPayload.installation.id;
    }
  }

  const auth = createAppAuth({ appId, privateKey, installationId: inputs.installationId });
  const authInstance = await auth({ type: "installation" });
  return authInstance.token;
}

async function getOctokitInstance(): Promise<Octokit> {
  if (!octokitInstance) {
    const auth = await getAuthenticationToken();
    octokitInstance = new Octokit({ auth });
  }
  return octokitInstance;
}

export { getOctokitInstance };
