import program from "../parser/command-line";
import { IncentivesConfiguration, incentivesConfigurationSchema, validateIncentivesConfiguration } from "./incentives";
import { Value } from "@sinclair/typebox/value";
import { merge } from "lodash";

let configuration: IncentivesConfiguration | null = null;

try {
  const defaultConf = Value.Create(incentivesConfigurationSchema);
  configuration = Value.Decode(incentivesConfigurationSchema, defaultConf);
} catch (e) {
  console.error(e);
}

if (program.settings) {
  const settings = merge(configuration, JSON.parse(program.settings));
  if (validateIncentivesConfiguration.test(settings)) {
    configuration = settings;
  } else {
    console.warn("Invalid incentives configuration detected, will revert to defaults.");
    for (const error of validateIncentivesConfiguration.errors(settings)) {
      console.warn(error);
    }
  }
}

export default configuration as IncentivesConfiguration;
