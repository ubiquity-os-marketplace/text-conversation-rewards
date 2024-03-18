import { Octokit } from "@octokit/rest";
import program from "./parser/command-line";

let octokitInstance: Octokit | null = null;

function getAuthenticationToken(): string {
  const { auth } = program.opts();
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
