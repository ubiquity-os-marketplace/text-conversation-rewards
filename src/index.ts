import { createActionsPlugin } from "@ubiquity-os/ubiquity-os-kernel";
import { LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { SupportedEvents } from "./parser/command-line";
import { run } from "./run";
import envConfigSchema, { EnvConfig } from "./types/env-type";
import { PluginSettings, pluginSettingsSchema } from "./types/plugin-input";

export default createActionsPlugin<PluginSettings, EnvConfig, SupportedEvents>(
  (context) => {
    return run(context);
  },
  {
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? "info",
    // @ts-expect-error the schema is valid
    settingsSchema: pluginSettingsSchema,
    // @ts-expect-error the schema is valid
    envSchema: envConfigSchema,
    ...(process.env.KERNEL_PUBLIC_KEY && { kernelPublicKey: process.env.KERNEL_PUBLIC_KEY }),
    postCommentOnError: true,
  }
);
