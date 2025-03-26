import { context } from "@actions/github";

export function createStructuredMetadata(className: string, metadata: unknown) {
  const jsonString = JSON.stringify(metadata, null, 2);
  const stackLine = new Error().stack?.split("\n")[2] ?? "";
  const caller = RegExp(/at (\S+)/).exec(stackLine)?.[1] ?? "";
  const revision = context.sha;
  return [`\n<!-- Ubiquity - ${className} - ${caller} - ${revision}`, jsonString, "-->"].join("\n");
}
