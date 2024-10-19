import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import configuration from "../configuration/config-reader";

const logger = new Logs(configuration.logLevel);

export default logger;
