import { Octokit } from "@octokit/rest";
import { GITHUB_TOKEN } from "./configuration/constants";

let octokitInstance: Octokit | null = null;

function getAuthenticationToken(): string {
  const auth = GITHUB_TOKEN;
  if (!auth) {
    throw new Error("No authentication token provided");
  }
  return auth;
}

function getOctokitInstance(): Octokit {
  if (!octokitInstance) {
    const auth = getAuthenticationToken();
    octokitInstance = new Octokit({ auth });
  }
  return octokitInstance;
}

export { getOctokitInstance };
