import { Command } from "@commander-js/extra-typings";
import { config } from "dotenv";
import packageJson from "../../package.json";

config();

const program = new Command()
  .option("-c, --config <path>", "The path to the desired configuration to use", "rewards-configuration.default.yml")
  .option("-f, --file <file>", "The target file to store the results in")
  .version(packageJson.version)
  .parse();

export default program;
