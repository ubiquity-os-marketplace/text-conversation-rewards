import { createPlugin, Manifest } from "@ubiquity-os/ubiquity-os-kernel";
import { PluginSettings, pluginSettingsSchema } from "../types/plugin-input";
import envConfigSchema, { EnvConfig } from "../types/env-type";
import { SupportedEvents } from "../parser/command-line";
import { LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import manifest from "../../manifest.json";
import { serveStatic } from "hono/bun";
import { IssueActivity } from "../issue-activity";
import { parseGitHubUrl } from "../start";
import { Processor } from "../parser/processor";

const app = createPlugin<PluginSettings, EnvConfig, SupportedEvents>(
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
    ...(process.env.KERNEL_PUBLIC_KEY && { kernelPublicKey: process.env.KERNEL_PUBLIC_KEY }),
    postCommentOnError: false,
  }
);

// You will need to build the client code first `bun run ui:build`
app.use(
  "/*",
  serveStatic({
    root: "./",
    rewriteRequestPath: (path) => `./dist${path}`,
  })
);

app.post("/openai/*", async (c) => {
  const text = await c.req.json();
  const regex = /{\s*"id":\s*(\d+),\s*"comment":\s*"([^"]*)",\s*"author":\s*"([^"]*)"\s*}/g;

  const comments = [];

  if ("messages" in text) {
    let match;
    while ((match = regex.exec(text.messages[0].content)) !== null) {
      comments.push({
        id: parseInt(match[1], 10),
        comment: match[2],
        author: match[3],
      });
    }
  }

  const commentsObject = comments.reduce(
    (acc, comment) => {
      acc[comment.id] = 0.8;
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
console.log(`Server is running on port ${port}`);

export default {
  fetch: app.fetch,
  port,
};
