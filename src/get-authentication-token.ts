import * as github from "@actions/github";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { APP_ID, INSTALLATION_ID, UBIQUIBOT_APP_PRIVATE_KEY } from "./configuration/constants";

let octokitInstance: Octokit | null = null;

async function getAuthenticationToken() {
  const appId = APP_ID;
  const privateKey = UBIQUIBOT_APP_PRIVATE_KEY;
  const inputs = {
    installationId: INSTALLATION_ID,
  };
  const eventPayload = JSON.parse(github.context.payload.inputs);
  console.log("event payload", eventPayload);
  if (eventPayload?.installation) {
    inputs.installationId = eventPayload.installation.id;
  }

  console.log(JSON.stringify(github.context, null, 2));

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
