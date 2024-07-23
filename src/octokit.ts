import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import program from "./parser/command-line";

const customOctokit = Octokit.plugin(retry);

let octokitInstance: Octokit | null = null;

function getOctokitInstance(): Octokit {
  if (!octokitInstance) {
    octokitInstance = new customOctokit({ auth: program.authToken });
  }
  return octokitInstance;
}

export { getOctokitInstance };
