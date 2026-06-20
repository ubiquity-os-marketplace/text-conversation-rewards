import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { ContextPlugin } from "../src/types/plugin-input";

const originalFetch = global.fetch;

function createModule(openAi: { model?: string; tokenCountLimit: number; maxRetries: number }) {
  const logger = {
    debug: jest.fn(),
    error: jest.fn((message: string) => new Error(message)),
    fatal: jest.fn((message: string) => new Error(message)),
    info: jest.fn(),
    ok: jest.fn((message: string) => message),
    warn: jest.fn((message: string, _details?: unknown) => new Error(message)),
  };

  const context = {
    config: {
      incentives: {
        contentEvaluator: {
          openAi,
          multipliers: [],
        },
      },
    },
    logger,
    payload: {
      issue: {
        number: 1,
      },
    },
  } as unknown as ContextPlugin;

  return {
    logger,
    module: new ContentEvaluatorModule(context),
  };
}

function mockOpenRouterModels(models: unknown[]) {
  global.fetch = jest.fn(async () => new Response(JSON.stringify({ data: models }), { status: 200 }));
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("ContentEvaluatorModule model token limits", () => {
  it("uses the configured model context length for content chunking", async () => {
    mockOpenRouterModels([
      {
        id: "openai/gpt-4o-mini",
        context_length: 128000,
        top_provider: {
          max_completion_tokens: 16384,
        },
      },
    ]);

    const { module } = createModule({
      model: "openai/gpt-4o-mini",
      tokenCountLimit: 32000,
      maxRetries: 0,
    });

    const tokenLimit = await module._resolveTokenLimit();

    expect(tokenLimit).toBe(128000);
    expect(module._completionTokenLimit).toBe(16384);
    expect(global.fetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/models");
  });

  it("falls back to the configured token limit when model metadata is unavailable", async () => {
    mockOpenRouterModels([
      {
        id: "anthropic/claude-3-5-sonnet",
        context_length: 200000,
        top_provider: {
          max_completion_tokens: 8192,
        },
      },
    ]);

    const { logger, module } = createModule({
      model: "openai/gpt-4o-mini",
      tokenCountLimit: 32000,
      maxRetries: 0,
    });

    const tokenLimit = await module._resolveTokenLimit();

    expect(tokenLimit).toBe(32000);
    expect(module._completionTokenLimit).toBe(16384);
    expect(logger.warn).toHaveBeenCalledWith("Failed to resolve the configured model token limit, using fallback.", {
      model: "openai/gpt-4o-mini",
    });
  });
});
