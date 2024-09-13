import { Logs } from "@ubiquity-dao/ubiquibot-logger";
import configuration from "../configuration/config-reader";

const logger = new Logs(configuration.logLevel);

export default logger;
