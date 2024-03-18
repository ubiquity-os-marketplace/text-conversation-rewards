import { Command } from "@commander-js/extra-typings";
import packageJson from "../../package.json";

const program = new Command()
  .requiredOption("-a, --auth <token>", "GitHub authentication token")
  .requiredOption("-o, --open-ai <token>", "OpenAi authentication token")
  .option("-c, --config <path>", "The path to the desired configuration to use", "rewards-configuration.yml")
  .option("-f, --file <file>", "The target file to store the results in")
  .version(packageJson.version)
  .parse();

export default program;
