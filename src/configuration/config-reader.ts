import { Value } from "@sinclair/typebox/value";
import program from "../parser/command-line";
import { PluginSettings, pluginSettingsSchema } from "../types/plugin-inputs";
import { validateAndDecodeSchemas } from "../helpers/validator";

let configuration: PluginSettings | null = null;

try {
  configuration = Value.Default(pluginSettingsSchema, {}) as PluginSettings;
} catch (e) {
  console.error(e);
}

if (program.settings) {
  const { decodedSettings } = validateAndDecodeSchemas(JSON.parse(program.settings), process.env);
  configuration = decodedSettings;
}
export default configuration as PluginSettings;
