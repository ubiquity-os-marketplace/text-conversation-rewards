import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import program from "./parser/command-line";
import configuration from "./configuration/config-reader";

const customOctokit = Octokit.plugin(retry);

let octokitInstance: Octokit | null = null;

function getOctokitInstance(): Octokit {
  if (!octokitInstance) {
    octokitInstance = new customOctokit({
      auth: program.authToken,
      retry: {
        retries: configuration.dataCollection.maxAttempts,
        retryAfterBaseValue: configuration.dataCollection.delayMs,
      },
    });
  }
  return octokitInstance;
}

export { getOctokitInstance };
