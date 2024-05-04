import { Value } from "@sinclair/typebox/value";
import { baseIncentiveConfiguration, BotConfig, generateConfiguration } from "@ubiquibot/configuration";
import * as fs from "fs";
import YAML from "yaml";
import program from "../parser/command-line";

let configuration: BotConfig;
let incentivesConfiguration: BotConfig["incentives"] | null = null;
try {
  const file = fs.readFileSync(program.opts().config, "utf8");
  incentivesConfiguration = YAML.parse(file);
} catch (e) {
  console.error(e);
}

// Get the default configuration
configuration = generateConfiguration();

if (!Value.Check(baseIncentiveConfiguration, incentivesConfiguration)) {
  console.warn("Invalid bot configuration detected, will use defaults.");
} else {
  // Merge the default with our own
  configuration = generateConfiguration({ incentives: incentivesConfiguration } as BotConfig);
}

export default configuration;
