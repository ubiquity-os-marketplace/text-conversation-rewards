/**
 * UbiquityOS - Code Syntax Complexity Multiplier
 */
export function calculateCodeBlockMultiplier(codeMarkdown: string): number {
  const codeBlocks = codeMarkdown.match(/```[a-z]*
[sS]*?```/g) || [];
  if (codeBlocks.length === 0) return 1.0;

  let totalLines = 0;
  for (const block of codeBlocks) {
    totalLines += block.split('
').length - 2;
  }

  if (totalLines > 200) return 1.5;
  if (totalLines > 50) return 1.25;
  return 1.1;
}
