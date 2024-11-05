import { createPlugin, Manifest } from "@ubiquity-os/ubiquity-os-kernel";
import { PluginSettings, pluginSettingsSchema } from "../types/plugin-input";
import envConfigSchema, { EnvConfig } from "../types/env-type";
import { SupportedEvents } from "../parser/command-line";
import { run } from "../run";
import { LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import manifest from "../../manifest.json";
import { serveStatic } from "hono/bun";

const app = createPlugin<PluginSettings, EnvConfig, SupportedEvents>(
  (context) => {
    return run(context);
  },
  manifest as Manifest,
  {
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? "info",
    settingsSchema: pluginSettingsSchema,
    envSchema: envConfigSchema,
    ...(process.env.KERNEL_PUBLIC_KEY && { kernelPublicKey: process.env.KERNEL_PUBLIC_KEY }),
    postCommentOnError: true,
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

const port = 3000;
console.log(`Server is running on port ${port}`);

export default {
  fetch: app.fetch,
  port,
};
