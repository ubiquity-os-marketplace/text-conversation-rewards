import { context } from "@actions/github";

export function createStructuredMetadata(className: string, metadata: unknown) {
  const jsonString = JSON.stringify(metadata, null, 2);
  const caller = `${className}.createStructuredMetadata`;
  const revision = context.sha;

  return [`\n<!-- Ubiquity - ${className} - ${caller} - ${revision}`, jsonString, "-->"].join("\n");
}
