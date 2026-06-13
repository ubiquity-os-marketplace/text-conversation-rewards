import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";

function createModule(openAi: { tokenCountLimit: number; maxRetries: number; model?: string }) {
  return new ContentEvaluatorModule({
    config: {
      incentives: {
        contentEvaluator: {
          openAi,
          multipliers: [],
        },
      },
    },
    logger: {
      warn: jest.fn(),
      info: jest.fn(),
      fatal: (message: string) => new Error(message),
    },
  } as never);
}

describe("ContentEvaluatorModule token limits", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("caps configured token count with OpenRouter model context length", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "openai/gpt-4o",
            context_length: 128000,
            top_provider: { max_completion_tokens: 16384 },
          },
        ],
      }),
    } as unknown as Response);

    const module = createModule({ model: "openai/gpt-4o", tokenCountLimit: 200000, maxRetries: 1 });

    await expect(module._resolveTokenLimit()).resolves.toBe(128000);
  });

  it("keeps the configured limit when the model is not an OpenRouter id", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const module = createModule({ model: "gpt-4o", tokenCountLimit: 124000, maxRetries: 1 });

    await expect(module._resolveTokenLimit()).resolves.toBe(124000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the configured limit when OpenRouter lookup fails", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    const module = createModule({ model: "openai/gpt-4o", tokenCountLimit: 64000, maxRetries: 1 });

    await expect(module._resolveTokenLimit()).resolves.toBe(64000);
  });
});
