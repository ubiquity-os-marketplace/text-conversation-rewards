import { BotConfig, generateConfiguration } from "@ubiquibot/configuration";
import * as fs from "fs";
import YAML from "yaml";
import program from "../parser/command-line";
import { IncentivesConfiguration, validateIncentivesConfiguration } from "./incentives";

let configuration: BotConfig & IncentivesConfiguration;
let incentivesConfiguration: IncentivesConfiguration | null = null;
try {
  const file = fs.readFileSync(program.opts().config, "utf8");
  incentivesConfiguration = YAML.parse(file);
} catch (e) {
  console.error(e);
}

// Get the default configuration
configuration = generateConfiguration();

if (!incentivesConfiguration || !validateIncentivesConfiguration.test(incentivesConfiguration)) {
  console.warn("Invalid incentives configuration detected, will use defaults.");
} else {
  // Merge the default with our own
  configuration = {
    ...configuration,
    ...incentivesConfiguration,
  };
}

export default configuration;
