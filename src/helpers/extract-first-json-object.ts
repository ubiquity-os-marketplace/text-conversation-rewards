export function extractFirstJsonObject(text: string): string {
  const startIndex = text.indexOf("{");
  if (startIndex === -1) {
    throw new Error("No JSON object start '{' found in response");
  }

  let depth = 0;
  let isInString = false;
  let isEscaped = false;

  function consumeStringChar(ch: string) {
    if (isEscaped) {
      isEscaped = false;
      return;
    }
    if (ch === "\\") {
      isEscaped = true;
      return;
    }
    if (ch === '"') {
      isInString = false;
    }
  }

  function consumeNonStringChar(ch: string, endIndex: number): string | null {
    if (ch === '"') {
      isInString = true;
      return null;
    }
    if (ch === "{") {
      depth++;
      return null;
    }
    if (ch !== "}") {
      return null;
    }
    depth--;
    return depth === 0 ? text.slice(startIndex, endIndex + 1) : null;
  }

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (isInString) {
      consumeStringChar(ch);
      continue;
    }

    const extracted = consumeNonStringChar(ch, i);
    if (extracted) return extracted;
  }

  throw new Error("No complete JSON object found in response");
}
