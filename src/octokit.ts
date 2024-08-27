import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import program from "./parser/command-line";
import configuration from "./configuration/config-reader";
import { paginateGraphQL, paginateGraphQLInterface } from "@octokit/plugin-paginate-graphql";

const customOctokit = Octokit.plugin(retry, paginateGraphQL);

let octokitInstance: (Octokit & paginateGraphQLInterface) | null = null;

function getOctokitInstance() {
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
