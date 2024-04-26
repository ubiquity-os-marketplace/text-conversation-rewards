import * as github from "@actions/github";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { APP_ID, INSTALLATION_ID, UBIQUIBOT_APP_PRIVATE_KEY } from "./configuration/constants";

let octokitInstance: Octokit | null = null;

async function getAuthenticationToken() {
  const appId = APP_ID;
  const privateKey = UBIQUIBOT_APP_PRIVATE_KEY;
  const inputs = github.context.payload.inputs || {
    installationId: INSTALLATION_ID,
  };
  console.log(JSON.stringify(github.context.payload, null, 2));

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
