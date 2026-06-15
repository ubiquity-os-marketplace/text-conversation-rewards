export const STRUCTURED_OUTPUT_MODELS: string[] = [
  // DeepSeek models on OpenRouter that support structured_outputs
  // As of June 2026, NO DeepSeek models support structured outputs through OpenRouter.
  // See: https://openrouter.ai/docs/features/structured-outputs
  // Checked models:
  // - deepseek/deepseek-v4-pro: false
  // - deepseek/deepseek-v4-flash: false  
  // - deepseek/deepseek-v3.2: false
  // - deepseek/deepseek-chat-v3-0324: false
  // - deepseek/deepseek-r1: false
  // Free models do NOT support this feature.
];

export function supportsStructuredOutputs(modelId: string): boolean {
  if (STRUCTURED_OUTPUT_MODELS.length === 0) return false;
  return STRUCTURED_OUTPUT_MODELS.some((m) => modelId.includes(m));
}

export function getStructuredOutputConfig(modelId: string): Record<string, unknown> | null {
  if (!supportsStructuredOutputs(modelId)) return null;
  return {
    type: "json_schema" as const,
    // Schema will be added when models support structured outputs
  };
}
