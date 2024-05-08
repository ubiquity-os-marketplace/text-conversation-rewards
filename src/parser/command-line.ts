import { Command } from "@commander-js/extra-typings";
import { config } from "dotenv";
import packageJson from "../../package.json";

config();

// On test mode pass the env value directly to the CLI
if (process.env.NODE_ENV === "test") {
  process.argv.splice(2);
  process.argv.push("-i");
  process.argv.push(`${process.env.TEST_ISSUE_URL}`);
  process.argv.push("-n");
  process.argv.push("100");
  process.argv.push("-e");
  process.argv.push(`${process.env.EVM_PRIVATE_ENCRYPTED}`);
}

const program = new Command()
  .requiredOption("-i, --issue <url>", "The url of the issue to parse")
  .requiredOption("-n, --evmNetworkId <number>", "The network ID", parseInt)
  .requiredOption("-t, --token <key>", "The authentication token")
  .option("-s, --settings <value>", "The settings to use", "")
  .option("-f, --file <file>", "The target file to store the results in")
  .version(packageJson.version)
  .parse();

export default program;
