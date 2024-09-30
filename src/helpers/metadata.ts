import { execSync } from "child_process";

export function createStructuredMetadata(className: string, metadata: unknown) {
  const jsonString = JSON.stringify(metadata, null, 2);
  const stackLine = new Error().stack?.split("\n")[2] ?? "";
  const caller = stackLine.match(/at (\S+)/)?.[1] ?? "";
  const revision = execSync("git rev-parse --short HEAD").toString().trim();
  return [`\n<!-- Ubiquity - ${className} - ${caller} - ${revision}`, jsonString, "-->"].join("\n");
}
