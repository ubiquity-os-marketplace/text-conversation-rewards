import * as fs from "fs";
import YAML from "yaml";
import program from "../parser/command-line";
import { IncentivesConfiguration, validateIncentivesConfiguration } from "./incentives";

let configuration: IncentivesConfiguration | null = null;

try {
  const file = fs.readFileSync(".rewards-configuration.default.yml", "utf8");
  configuration = YAML.parse(file);
} catch (e) {
  console.error(e);
}

if (program.opts().settings) {
  const settings = JSON.parse(program.opts().settings);
  if (validateIncentivesConfiguration.test(settings)) {
    configuration = settings;
  } else {
    console.warn("Invalid incentives configuration detected, will revert to defaults.");
  }
}

export default configuration as IncentivesConfiguration;
