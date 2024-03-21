import { Command } from "@commander-js/extra-typings";
import { config } from "dotenv";
import packageJson from "../../package.json";

if (process.env.NODE_ENV === "test") {
  config();
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  process.argv = ["path/to/node", "path/to/script", `--auth`, `${GITHUB_TOKEN}`, "--open-ai", `${OPENAI_API_KEY}`];
}

const program = new Command()
  .requiredOption("-a, --auth <token>", "GitHub authentication token")
  .requiredOption("-o, --open-ai <token>", "OpenAi authentication token")
  .option("-c, --config <path>", "The path to the desired configuration to use", "rewards-configuration.default.yml")
  .option("-f, --file <file>", "The target file to store the results in")
  .version(packageJson.version)
  .parse();

export default program;
