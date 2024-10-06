import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import program from "./parser/command-line";
import configuration from "./configuration/config-reader";
import { paginateGraphQL, paginateGraphQLInterface } from "@octokit/plugin-paginate-graphql";

// @ts-expect-error retry and paginateGraphql do not use latest hook types
// https://github.com/octokit/plugin-retry.js/issues/528
const customOctokit = Octokit.plugin(retry, paginateGraphQL);

type OctokitInstanceType = InstanceType<typeof customOctokit> & paginateGraphQLInterface;

let octokitInstance: OctokitInstanceType | null = null;

function getOctokitInstance() {
  if (!octokitInstance) {
    octokitInstance = new customOctokit({
      auth: program.authToken,
      retry: {
        retries: configuration.dataCollection.maxAttempts,
        retryAfterBaseValue: configuration.dataCollection.delayMs,
      },
    }) as OctokitInstanceType;
  }
  return octokitInstance as OctokitInstanceType;
}

export { getOctokitInstance };
