import program from "../parser/command-line";
import { IncentivesConfiguration, incentivesConfigurationSchema, validateIncentivesConfiguration } from "./incentives";
import { Value } from "@sinclair/typebox/value";

let configuration: IncentivesConfiguration | null = null;

try {
  const defaultConf = Value.Create(incentivesConfigurationSchema);
  configuration = Value.Decode(incentivesConfigurationSchema, defaultConf);
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
