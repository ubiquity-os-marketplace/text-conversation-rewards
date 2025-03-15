import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { ExecutionContext } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import manifest from "../../../manifest.json";
import { Processor } from "../../parser/processor";
import { parseGitHubUrl } from "../../start";
import envConfigSchema, { EnvConfig } from "../../types/env-type";
import { PluginSettings, pluginSettingsSchema, SupportedEvents } from "../../types/plugin-input";
import { IssueActivityCache } from "../db/issue-activity-cache";
import { getPayload } from "./payload";
import { mkdirSync } from "fs";
import { Organization, Repository } from "@octokit/graphql-schema";

function githubUrlToFileName(url: string): string {
  const repoMatch = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);

  if (!repoMatch) {
    throw new Error("Invalid GitHub URL");
  }

  const owner = repoMatch[1].toLowerCase();
  const repo = repoMatch[2].toLowerCase();

  const issueMatch = url.match(/\/issues\/(\d+)/);

  if (issueMatch) {
    const issueNumber = issueMatch[1];
    return `results/${owner}_${repo}_${issueNumber}.json`;
  }

  return `results/${owner}_${repo}.json`;
}

const QUERY_ORG_REPOS = /* GraphQL */ `
  query GetOrgRepositories($orgName: String!, $cursor: String) {
    organization(login: $orgName) {
      name
      url
      repositories(first: 100, after: $cursor) {
        totalCount
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          name
          description
          url
          isPrivate
          primaryLanguage {
            name
            color
          }
          stargazerCount
          forkCount
          updatedAt
          createdAt
        }
      }
    }
  }
`;

const QUERY_REPO_ISSUES = /* GraphQL */ `
  query GetRepositoryIssues($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      name
      url
      issues(first: 100, after: $cursor, orderBy: { field: CREATED_AT, direction: DESC }, states: [CLOSED]) {
        totalCount
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          number
          title
          url
          state
          createdAt
          updatedAt
          closedAt
          author {
            login
            url
          }
          bodyText
        }
      }
    }
  }
`;

const baseApp = createPlugin<PluginSettings, EnvConfig, null, SupportedEvents>(
  async (context) => {
    const { config, octokit } = context;
    mkdirSync("results", { recursive: true });

    const { organization } = await octokit.graphql.paginate<{ organization: Organization }>(QUERY_ORG_REPOS, {
      orgName: "Meniole",
    });
    const repositories = organization.repositories.nodes;
    if (repositories) {
      for (const repo of repositories) {
        if (repo) {
          console.log("> ", repo.name);
          const { repository } = await octokit.graphql.paginate<{ repository: Repository }>(QUERY_REPO_ISSUES, {
            owner: "Meniole",
            repo: repo.name,
          });
          const issues = repository.issues.nodes;
          if (issues) {
            for (const issue of issues) {
              if (issue) {
                console.log("--- ", issue?.title);
                config.incentives.file = githubUrlToFileName(issue.url);
                const issueElem = parseGitHubUrl(issue.url);
                const activity = new IssueActivityCache(context, issueElem, "useCache" in config);
                await activity.init();
                const processor = new Processor(context);
                await processor.run(activity);
                processor.dump();
              }
            }
          }
        }
      }
    }
    return { output: { result: { evaluationCommentHtml: `<div>Done!</div>}` } } };
  },
  manifest as Manifest,
  {
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? "info",
    settingsSchema: pluginSettingsSchema,
    envSchema: envConfigSchema,
    postCommentOnError: false,
    bypassSignatureVerification: true,
  }
);

baseApp.use("*", cors());

const app = {
  fetch: async (request: Request, env: object, ctx: ExecutionContext) => {
    if (
      request.method === "POST" &&
      new URL(request.url).pathname === "/" &&
      request.headers.get("referer")?.startsWith("http://localhost")
    ) {
      try {
        const originalBody = await request.json();
        const modifiedBody = await getPayload(
          originalBody.ownerRepo,
          originalBody.issueId,
          originalBody.useOpenAi,
          originalBody.useCache
        );
        const modifiedRequest = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(modifiedBody),
        });
        const res = await baseApp.fetch(modifiedRequest, env, ctx);
        res.headers.set("Access-Control-Allow-Origin", "*");
        return res;
      } catch (error) {
        console.error(error);
        return new Response("Invalid JSON", {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
    }
    const res = await baseApp.fetch(request, env, ctx);
    res.headers.set("Access-Control-Allow-Origin", "*");
    return res;
  },
  use: baseApp.use.bind(baseApp),
  post: baseApp.post.bind(baseApp),
  get: baseApp.get.bind(baseApp),
};

// Serves the statically compiled frontend
app.use(
  "/*",
  serveStatic({
    root: "./",
    rewriteRequestPath: (path) => `./src/web/dist${path}`,
  })
);

// Fakes OpenAi routes
app.post("/openai/*", async (c) => {
  const text = await c.req.json();
  const regex =
    /(The total number of properties in your JSON response should equal exactly|The number of entries in the JSON response must equal) (\d+)/g;

  const comments: { id: string; comment: string; author: string }[] = [];

  if ("messages" in text) {
    const matches = [...text.messages[0].content.matchAll(regex)];

    const length = matches.reduce((sum, match) => sum + parseInt(match[2], 10), 0);
    comments.push(
      ...Array.from({ length }, () => ({
        id: crypto.randomUUID(),
        comment: "Generic comment",
        author: "Generic author",
      }))
    );
  }

  const commentsObject = comments.reduce(
    (acc, comment) => {
      acc[comment.id] = 0.83;
      return acc;
    },
    {} as Record<string, number>
  );

  return Response.json({
    choices: [{ message: { content: JSON.stringify(commentsObject) } }],
  });
});

app.get("/openai/*", () => {
  return Response.json("OpenAI GET");
});

const port = 4000;

export default {
  fetch: app.fetch,
  port,
};
