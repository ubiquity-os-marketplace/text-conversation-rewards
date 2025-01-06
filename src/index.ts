import { createActionsPlugin } from "@ubiquity-os/plugin-sdk";
import { LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { run } from "./run";
import envConfigSchema, { EnvConfig } from "./types/env-type";
import { PluginSettings, pluginSettingsSchema, SupportedEvents } from "./types/plugin-input";

export default createActionsPlugin<PluginSettings, EnvConfig, null, SupportedEvents>(
  (context) => {
    return run(context);
  },
  {
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? "info",
    settingsSchema: pluginSettingsSchema,
    envSchema: envConfigSchema,
    ...(process.env.KERNEL_PUBLIC_KEY && { kernelPublicKey: process.env.KERNEL_PUBLIC_KEY }),
    postCommentOnError: true,
  }
);
