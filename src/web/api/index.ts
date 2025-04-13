import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { mkdirSync } from "fs";
import { ExecutionContext } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { existsSync } from "node:fs";
import manifest from "../../../manifest.json";
import { logInvalidIssue } from "../../helpers/log-invalid-issue";
import { Processor } from "../../parser/processor";
import { parseGitHubUrl } from "../../start";
import envConfigSchema, { EnvConfig } from "../../types/env-type";
import { ContextPlugin, PluginSettings, pluginSettingsSchema, SupportedEvents } from "../../types/plugin-input";
import { IssueActivityCache } from "../db/issue-activity-cache";
import { getPayload } from "./payload";
import { RestEndpointMethodTypes } from "@octokit/rest";

function githubUrlToFileName(url: string): string {
  const repoMatch = RegExp(/github\.com\/([^/]+)\/([^/?#]+)/).exec(url);

  if (!repoMatch) {
    throw new Error("Invalid GitHub URL");
  }

  const owner = repoMatch[1].toLowerCase();
  const repo = repoMatch[2].toLowerCase();

  const issueMatch = RegExp(/\/issues\/(\d+)/).exec(url);

  if (issueMatch) {
    const issueNumber = issueMatch[1];
    return `results/${owner}_${repo}_${issueNumber}.json`;
  }

  return `results/${owner}_${repo}.json`;
}

type Repository = RestEndpointMethodTypes["repos"]["listForOrg"]["response"]["data"][0];

const baseApp = createPlugin<PluginSettings, EnvConfig, null, SupportedEvents>(
  async (context) => {
    const { config, octokit, payload, logger } = context;
    mkdirSync("results", { recursive: true });

    const orgName = payload.organization?.login;

    if (!orgName) {
      throw logger.error("Unable to find organization name");
    }

    let repositories: Repository[];
    if (!payload.repository) {
      repositories = await octokit.paginate(octokit.rest.repos.listForOrg, {
        org: orgName,
      });
    } else {
      const repository = await octokit.rest.repos.get({
        org: orgName,
        repo: payload.repository.name,
        owner: payload.repository.owner.login,
      });
      repositories = [repository.data as Repository];
    }
    for (const repo of repositories) {
      console.log("> ", repo.html_url);
      const issues = (
        await octokit.paginate(octokit.rest.issues.listForRepo, {
          owner: orgName,
          repo: repo.name,
          state: "closed",
        })
      ).filter((o) => {
        if (payload.issue && o.id !== payload.issue.id) {
          return false;
        }
        return !o.pull_request && o.state_reason === "completed";
      });
      if (!issues.length) {
        console.log("No issues found, skipping.");
      }
      for (const issue of issues) {
        console.log("--- ", issue.html_url);
        const filePath = githubUrlToFileName(issue.html_url);
        if (existsSync(filePath)) {
          console.warn(`File ${filePath} already exists, skipping.`);
        } else if (!issue.labels.some((label) => typeof label !== "string" && label.name?.startsWith("Price:"))) {
          console.warn("No pricing label found, skipping.");
          await logInvalidIssue(context.logger, issue.html_url);
        } else {
          config.incentives.file = filePath;
          context.payload.issue = issue as ContextPlugin["payload"]["issue"];
          context.payload.repository = repo as ContextPlugin["payload"]["repository"];
          const issueElem = parseGitHubUrl(issue.html_url);
          const activity = new IssueActivityCache(context, issueElem, "useCache" in config);
          await activity.init();
          const processor = new Processor(context);
          await processor.run(activity);
          processor.dump();
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
    if (request.method === "POST" && new URL(request.url).pathname === "/") {
      try {
        const originalBody = await request.json();
        const modifiedBody = await getPayload(
          originalBody.owner,
          originalBody.repo,
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
