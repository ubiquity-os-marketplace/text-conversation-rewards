import { context } from "@actions/github";

export function createStructuredMetadata(className: string, metadata: unknown) {
  const jsonString = JSON.stringify(metadata, null, 2);
  const revision = context.sha;
  let caller = `${className}.createStructuredMetadata`;

  try {
    const stackLines = new Error().stack?.split("\n") ?? [];
    const callerLine = stackLines[2];
    const match = callerLine ? /\bat\s+(?:async\s+)?([^\s(]+)/.exec(callerLine) : null;
    const stackCaller = match?.[1];
    if (stackCaller && stackCaller !== "createStructuredMetadata") {
      const normalizedCaller = stackCaller.startsWith("Object.")
        ? `${className}.${stackCaller.slice("Object.".length)}`
        : stackCaller;
      caller = normalizedCaller.includes(".") ? normalizedCaller : `${className}.${normalizedCaller}`;
    }
  } catch {
    // Ignore stack parsing issues; keep the stable caller name.
  }

  return [`\n<!-- Ubiquity - ${className} - ${caller} - ${revision}`, jsonString, "-->"].join("\n");
}
