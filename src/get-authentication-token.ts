import { Octokit } from "@octokit/rest";
import program from "./parser/command-line";

let octokitInstance: Octokit | null = null;

function getOctokitInstance(): Octokit {
  if (!octokitInstance) {
    octokitInstance = new Octokit({ auth: program.opts().token });
  }
  return octokitInstance;
}

export { getOctokitInstance };
