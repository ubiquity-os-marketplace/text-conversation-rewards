import { Octokit } from "@octokit/rest";
import { parse } from "yargs";

let octokitInstance: Octokit | null = null;

function getAuthenticationToken(): string {
  const argv = parse(process.argv.slice(2));
  if (!argv.auth) {
    throw new Error("No authentication token provided");
  }
  return argv.auth as string;
}

function getOctokitInstance(): Octokit {
  if (!octokitInstance) {
    const auth = getAuthenticationToken();
    octokitInstance = new Octokit({ auth });
  }
  return octokitInstance;
}

export { getOctokitInstance };
