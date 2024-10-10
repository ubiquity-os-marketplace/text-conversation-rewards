import { Value } from "@sinclair/typebox/value";
import program from "../parser/command-line";
import { PluginSettings, pluginSettingsSchema, pluginSettingsValidator } from "../types/plugin-input";

let configuration: PluginSettings | null = null;

try {
  configuration = Value.Default(pluginSettingsSchema, {}) as PluginSettings;
} catch (e) {
  console.error(e);
}

if (program.settings) {
  const settings = Value.Default(pluginSettingsSchema, JSON.parse(program.settings)) as PluginSettings;
  if (pluginSettingsValidator.test(settings)) {
    configuration = Value.Decode(pluginSettingsSchema, settings);
  } else {
    console.warn("Invalid incentives configuration detected, will revert to defaults.");
    for (const error of pluginSettingsValidator.errors(settings)) {
      console.warn(error);
    }
  }
}
export default configuration as PluginSettings;
