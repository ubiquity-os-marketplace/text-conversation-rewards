import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import program from "./parser/command-line";
import configuration from "./configuration/config-reader";
import { paginateGraphQL, paginateGraphQLInterface } from "@octokit/plugin-paginate-graphql";

const customOctokit = Octokit.plugin(retry, paginateGraphQL);

type OctokitInstanceType = InstanceType<typeof customOctokit> & paginateGraphQLInterface;

let octokitInstance: OctokitInstanceType | null = null;

function getOctokitInstance(): OctokitInstanceType {
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
