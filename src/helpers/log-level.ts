import { LOG_LEVEL } from "@ubiquity-os/ubiquity-os-logger";
import type { LogLevel } from "@ubiquity-os/ubiquity-os-logger";

export function getStartupLogLevel(logLevel: string | null | undefined): LogLevel | string {
  return typeof logLevel === "string" && logLevel.trim() !== "" ? logLevel : LOG_LEVEL.INFO;
}
