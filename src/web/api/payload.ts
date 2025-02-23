import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";

export async function getPayload(ownerRepo: string, issueId: number, useOpenAi: boolean, useCache: boolean) {
  const filePath = path.resolve(__dirname, "../.ubiquity-os.config.yml");
  const fileContent = await fs.readFile(filePath, "utf8");
  const cfgFile = YAML.parse(fileContent);
  const [owner, repo] = ownerRepo.split("/");

  if (!useOpenAi) {
    cfgFile.incentives.contentEvaluator.openAi = {
      ...cfgFile.incentives.contentEvaluator.openAi,
      endpoint: "http://localhost:4000/openai",
    };
  }

  const octokit = new customOctokit({ auth: process.env.GITHUB_TOKEN });
  const issue = (
    await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueId,
    })
  ).data;
  const repository = (
    await octokit.rest.repos.get({
      owner,
      repo,
    })
  ).data;

  return {
    ref: "http://localhost",
    stateId: "1234",
    signature: "",
    eventName: "issues.closed",
    action: "closed",
    env: process.env,
    command: "null",
    settings: JSON.stringify({
      ...cfgFile,
      evmPrivateEncrypted: cfgFile.evmPrivateEncrypted ?? process.env.EVM_PRIVATE_ENCRYPTED,
      ...(useCache && { useCache }),
    }),
    authToken: process.env.GITHUB_TOKEN,
    eventPayload: JSON.stringify({
      issue,
      repository,
      sender: {
        login: "ubiquity-os",
        id: 159901852,
        node_id: "MDQ6VXNlcjE=",
        avatar_url: "https://github.com/images/error/ubiquity-os_happy.gif",
        gravatar_id: "",
        url: "https://api.github.com/users/ubiquity-os",
        html_url: "https://github.com/ubiquity-os",
        followers_url: "https://api.github.com/users/ubiquity-os/followers",
        following_url: "https://api.github.com/users/ubiquity-os/following{/other_user}",
        gists_url: "https://api.github.com/users/ubiquity-os/gists{/gist_id}",
        starred_url: "https://api.github.com/users/ubiquity-os/starred{/owner}{/repo}",
        subscriptions_url: "https://api.github.com/users/ubiquity-os/subscriptions",
        organizations_url: "https://api.github.com/users/ubiquity-os/orgs",
        repos_url: "https://api.github.com/users/ubiquity-os/repos",
        events_url: "https://api.github.com/users/ubiquity-os/events{/privacy}",
        received_events_url: "https://api.github.com/users/ubiquity-os/received_events",
        type: "User",
        site_admin: false,
      },
    }),
  };
}
