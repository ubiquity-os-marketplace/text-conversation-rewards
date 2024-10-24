import { createPlugin } from "@ubiquity-os/ubiquity-os-kernel";
import { LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import manifest from "../manifest.json";
import { SupportedEvents } from "./parser/command-line";
import { run } from "./run";
import envConfigSchema, { EnvConfig } from "./types/env-type";
import { PluginSettings, pluginSettingsSchema } from "./types/plugin-input";

export default createPlugin<PluginSettings, EnvConfig, SupportedEvents>(
  (context) => {
    return run(context);
  },
  //@ts-expect-error err
  manifest,
  {
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? "info",
    settingsSchema: pluginSettingsSchema,
    envSchema: envConfigSchema,
    kernelPublicKey: process.env.KERNEL_PUBLIC_KEY,
    postCommentOnError: true,
  }
);
