import { context } from "@actions/github";

export function createStructuredMetadata(
  className: string,
  metadata: unknown,
  prependNewline: boolean = true,
  appendNewLine: boolean = false
) {
  const jsonString = JSON.stringify(metadata, null, 2);
  const stackLine = new Error().stack?.split("\n")[2] ?? "";
  const caller = stackLine.match(/at (\S+)/)?.[1] ?? "";
  const revision = context.sha;
  const start = prependNewline ? "\n" : "";
  const end = appendNewLine ? "\n" : "";

  return start + [`<!-- Ubiquity - ${className} - ${caller} - ${revision}`, jsonString, "-->"].join("\n") + end;
}
