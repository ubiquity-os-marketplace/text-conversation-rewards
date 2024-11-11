import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { ExecutionContext } from "hono";
import { serveStatic } from "hono/bun";
import manifest from "../../../manifest.json";
import { IssueActivity } from "../../issue-activity";
import { Processor } from "../../parser/processor";
import { parseGitHubUrl } from "../../start";
import envConfigSchema, { EnvConfig } from "../../types/env-type";
import { PluginSettings, pluginSettingsSchema, SupportedEvents } from "../../types/plugin-input";
import { getPayload } from "./payload";

const baseApp = createPlugin<PluginSettings, EnvConfig, SupportedEvents>(
  async (context) => {
    const { payload } = context;
    const issue = parseGitHubUrl(payload.issue.html_url);
    const activity = new IssueActivity(context, issue);
    await activity.init();
    const processor = new Processor(context);
    await processor.run(activity);
    const result = processor.dump();
    return JSON.parse(result);
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

const app = {
  fetch: async (request: Request, env: object, ctx: ExecutionContext) => {
    if (request.method === "POST" && new URL(request.url).pathname === "/") {
      try {
        const originalBody = await request.json();
        const modifiedBody = await getPayload(originalBody.ownerRepo, originalBody.issueId, originalBody.useOpenAi);
        const modifiedRequest = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(modifiedBody),
        });
        return baseApp.fetch(modifiedRequest, env, ctx);
      } catch (error) {
        console.error(error);
        return new Response("Invalid JSON", { status: 400 });
      }
    }
    return baseApp.fetch(request, env, ctx);
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
  const regex = /JSON response should equal exactly (\d+)/g;

  const comments: { id: string; comment: string; author: string }[] = [];

  if ("messages" in text) {
    let match;
    while ((match = regex.exec(text.messages[0].content)) !== null) {
      const length = JSON.parse(`[${match[1]}]`);

      comments.push(
        ...Array.from({ length }, (item, i) => ({
          id: i.toString(),
          comment: "Generic comment",
          author: "Generic author",
        }))
      );
    }
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

const port = 3000;

export default {
  fetch: app.fetch,
  port,
};
