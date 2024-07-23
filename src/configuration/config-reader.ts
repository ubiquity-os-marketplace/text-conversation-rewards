import { Value } from "@sinclair/typebox/value";
import { merge } from "lodash";
import program from "../parser/command-line";
import { IncentivesConfiguration, incentivesConfigurationSchema, validateIncentivesConfiguration } from "./incentives";

let configuration: IncentivesConfiguration | null = null;

try {
  const defaultConf = Value.Create(incentivesConfigurationSchema);
  Value.Default(incentivesConfigurationSchema, defaultConf);
} catch (e) {
  console.error(e);
}

if (program.settings) {
  const settings = merge(
    configuration,
    Value.Default(incentivesConfigurationSchema, JSON.parse(program.settings)) as IncentivesConfiguration
  );
  if (validateIncentivesConfiguration.test(settings)) {
    configuration = Value.Decode(incentivesConfigurationSchema, settings);
  } else {
    console.warn("Invalid incentives configuration detected, will revert to defaults.");
    for (const error of validateIncentivesConfiguration.errors(settings)) {
      console.warn(error);
    }
  }
}

export default configuration as IncentivesConfiguration;
