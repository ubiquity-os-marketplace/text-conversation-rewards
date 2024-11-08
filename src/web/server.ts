import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { serveStatic } from "hono/bun";
import manifest from "../../manifest.json";
import { IssueActivity } from "../issue-activity";
import { Processor } from "../parser/processor";
import { parseGitHubUrl } from "../start";
import envConfigSchema, { EnvConfig } from "../types/env-type";
import { PluginSettings, pluginSettingsSchema, SupportedEvents } from "../types/plugin-input";

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
    bypassSignatureVerification: true,
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
  const regex = /START EVALUATING:\s*\[([\s\S]*?)]/g;

  const comments: { id: string; comment: string; author: string }[] = [];

  if ("messages" in text) {
    let match;
    while ((match = regex.exec(text.messages[0].content)) !== null) {
      const jsonArray = JSON.parse(`[${match[1]}]`);
      jsonArray.forEach((item: { id: string; comment: string; author: string }) => {
        comments.push({
          id: item.id,
          comment: item.comment,
          author: item.author,
        });
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
