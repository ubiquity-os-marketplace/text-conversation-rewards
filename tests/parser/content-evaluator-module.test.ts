import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { Value } from "@sinclair/typebox/value";
import { contentEvaluatorConfigurationType } from "../../src/configuration/content-evaluator-config";
import { ContextPlugin, pluginSettingsSchema } from "../../src/types/plugin-input";
import { IssueActivity } from "../../src/issue-activity";
import { Result } from "../../src/types/results";

const mockGetOpenRouterModelTokenLimits = jest.fn();

jest.mock("../../src/helpers/retry", () => ({
  __esModule: true,
  getOpenRouterModelTokenLimits: (...args: unknown[]) => mockGetOpenRouterModelTokenLimits(...args),
  getOpenRouterModels: jest.fn(),
  retry: async (fn: () => Promise<unknown>) => fn(),
  checkLlmRetryableState: jest.fn(),
}));

describe("ContentEvaluatorModule Token Limit and OpenRouter Integration", () => {
  let contentEvaluatorModuleClass: typeof import("../../src/parser/content-evaluator-module").ContentEvaluatorModule;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleImport = await import("../../src/parser/content-evaluator-module");
    contentEvaluatorModuleClass = moduleImport.ContentEvaluatorModule;
  });

  it("should use explicit tokenCountLimit if provided in configuration", async () => {
    const config = Value.Default(pluginSettingsSchema, {
      incentives: {
        contentEvaluator: Value.Default(contentEvaluatorConfigurationType, {
          openAi: {
            tokenCountLimit: 64000,
            model: "anthropic/claude-3.5-sonnet",
          },
        }),
      },
    });

    const mockContext = {
      config,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
        debug: jest.fn(),
        ok: jest.fn(),
      },
      payload: {
        repository: { owner: { login: "test-owner" }, name: "test-repo" },
        issue: { number: 1, user: { login: "author" } },
      },
      adapters: {},
    } as unknown as ContextPlugin;

    const module = new contentEvaluatorModuleClass(mockContext);
    const mockActivity = {
      self: { body: "Issue spec" },
      linkedIssues: [],
    } as unknown as IssueActivity;
    const mockResult: Result = {};

    await module.transform(mockActivity, mockResult);

    expect(module["_tokenLimit"]).toBe(64000);
    expect(mockContext.logger.info).toHaveBeenCalledWith("Using token limit: 64000");
  });

  it("should fetch token limits from OpenRouter API when tokenCountLimit is omitted", async () => {
    mockGetOpenRouterModelTokenLimits.mockResolvedValue({
      contextLength: 200000,
      maxCompletionTokens: 8192,
    });

    const config = Value.Default(pluginSettingsSchema, {
      incentives: {
        contentEvaluator: Value.Default(contentEvaluatorConfigurationType, {
          openAi: {
            model: "anthropic/claude-3.5-sonnet",
          },
        }),
      },
    });

    const mockContext = {
      config,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
        debug: jest.fn(),
        ok: jest.fn(),
      },
      payload: {
        repository: { owner: { login: "test-owner" }, name: "test-repo" },
        issue: { number: 1, user: { login: "author" } },
      },
      adapters: {},
    } as unknown as ContextPlugin;

    const module = new contentEvaluatorModuleClass(mockContext);
    const mockActivity = {
      self: { body: "Issue spec" },
      linkedIssues: [],
    } as unknown as IssueActivity;
    const mockResult: Result = {};

    await module.transform(mockActivity, mockResult);

    expect(mockGetOpenRouterModelTokenLimits).toHaveBeenCalledWith("anthropic/claude-3.5-sonnet");
    expect(module["_tokenLimit"]).toBe(200000);
    expect(mockContext.logger.info).toHaveBeenCalledWith("Using token limit: 200000");
  });

  it("should throw fatal error if OpenRouter model token limit cannot be resolved", async () => {
    mockGetOpenRouterModelTokenLimits.mockResolvedValue(null);

    const config = Value.Default(pluginSettingsSchema, {
      incentives: {
        contentEvaluator: Value.Default(contentEvaluatorConfigurationType, {
          openAi: {
            model: "non-existent/model",
          },
        }),
      },
    });

    const mockContext = {
      config,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn((msg) => new Error(msg as string)),
        debug: jest.fn(),
        ok: jest.fn(),
      },
      payload: {
        repository: { owner: { login: "test-owner" }, name: "test-repo" },
        issue: { number: 1, user: { login: "author" } },
      },
      adapters: {},
    } as unknown as ContextPlugin;

    const module = new contentEvaluatorModuleClass(mockContext);
    const mockActivity = {
      self: { body: "Issue spec" },
      linkedIssues: [],
    } as unknown as IssueActivity;
    const mockResult: Result = {};

    await expect(module.transform(mockActivity, mockResult)).rejects.toThrow();
    expect(mockContext.logger.fatal).toHaveBeenCalledWith(
      "Token count limit is missing and could not be determined for model: non-existent/model"
    );
  });
});
