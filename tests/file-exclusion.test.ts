import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { OctokitResponse, RequestParameters } from "@octokit/types";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { getExcludedFiles } from "../src/helpers/excluded-files";
import { ContextPlugin } from "../src/types/plugin-input";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import { PullRequestData } from "../src/helpers/pull-request-data";

type MockGetContent = jest.Mock<
  (
    params?: RequestParameters & { ref?: string; owner: string; repo: string; path: string }
  ) => Promise<OctokitResponse<unknown>>
>;

const mockGetContent: MockGetContent = jest.fn();
const mockOctokit = {
  rest: {
    repos: {
      getContent: mockGetContent,
    },
  },
};

const ctx = {
  config: cfg,
  logger: new Logs("debug"),
  octokit: mockOctokit,
  payload: { repository: { owner: { login: "test-owner" }, name: "test-repo" } },
} as unknown as ContextPlugin;

const { ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module");

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  mockGetContent.mockClear();
});
afterAll(() => server.close());

describe("ReviewIncentivizerModule file exclusion", () => {
  const reviewIncentivizer = new ReviewIncentivizerModule(ctx);

  beforeEach(() => {
    jest.spyOn(ReviewIncentivizerModule.prototype, "getTripleDotDiffAsObject").mockResolvedValue({
      "src/index.ts": { addition: 50, deletion: 50 },
      "src/helpers/utils.ts": { addition: 50, deletion: 50 },
      "dist/generated.ts": { addition: 50, deletion: 50 },
      "dist/lang_generated.ts": { addition: 50, deletion: 50 },
      "tests/main.test.ts": { addition: 50, deletion: 50 },
    });
  });

  it("should calculate total diff when no patterns are excluded", async () => {
    const result = await reviewIncentivizer.getReviewableDiff(
      "owner",
      "repo",
      "baseSha",
      "headSha",
      new PullRequestData({} as never, "owner", "repo", 0)
    );
    expect(result).toEqual({ addition: 250, deletion: 250 });
  });

  it("should exclude files matching ANY of the patterns", async () => {
    const result = await reviewIncentivizer.getReviewableDiff(
      "owner",
      "repo",
      "baseSha",
      "headSha",
      new PullRequestData({} as never, "owner", "repo", 0),
      ["dist/**", "tests/**"]
    );
    expect(result).toEqual({ addition: 100, deletion: 100 });
  });
});

function mockFileResponse(content: string): Promise<OctokitResponse<unknown>> {
  return Promise.resolve({
    status: 200,
    headers: {},
    url: "mock://url",
    data: { content: Buffer.from(content).toString("base64") },
  });
}

function mockNotFoundError(): Promise<never> {
  const error = new Error("Not Found") as Error & { status?: number };
  error.status = 404;
  return Promise.reject(error);
}

describe("getExcludedFiles tests", () => {
  const owner = "test-owner";
  const repo = "test-repo";
  const defaults = ["*", "!*.ts"];

  it("should return defaults if no files are found", async () => {
    mockGetContent.mockImplementation(mockNotFoundError);
    const result = await getExcludedFiles(ctx, owner, repo);
    expect(result).toEqual(defaults);
    expect(mockGetContent).toHaveBeenCalledTimes(3);
  });

  it("should return defaults + gitattributes patterns", async () => {
    const gitAttribContent = `
      *.ts linguist-generated
      *.js linguist-vendored
      # comment
      dist/ linguist-generated
    `;
    mockGetContent.mockImplementation((params) => {
      if (params?.path === ".gitattributes") return mockFileResponse(gitAttribContent);
      return mockNotFoundError();
    });
    const result = await getExcludedFiles(ctx, owner, repo);
    expect(new Set(result)).toEqual(new Set([...defaults, "*.ts", "dist/"]));
    expect(result).toHaveLength(defaults.length + 2);
  });

  it("should return defaults + prettierignore patterns", async () => {
    const prettierIgnoreContent = `
      # Prettier ignores
      node_modules
      *.log

      build/
    `;
    mockGetContent.mockImplementation((params) => {
      if (params?.path === ".prettierignore") return mockFileResponse(prettierIgnoreContent);
      return mockNotFoundError();
    });
    const result = await getExcludedFiles(ctx, owner, repo);
    expect(new Set(result)).toEqual(new Set([...defaults, "node_modules", "*.log", "build/"]));
    expect(result).toHaveLength(defaults.length + 3);
  });

  it("should return defaults + tsconfig exclude patterns", async () => {
    const tsconfigContent = `
      {
        "compilerOptions": {
          "target": "ES2022"
        },
        // comments here
        "exclude": [
          "node_modules", // more comments
          "dist",
          "**/*.spec.ts",
          "bin/"
        ]
      }
    `;
    mockGetContent.mockImplementation((params) => {
      if (params?.path === "tsconfig.json") return mockFileResponse(tsconfigContent);
      return mockNotFoundError();
    });
    const result = await getExcludedFiles(ctx, owner, repo);
    expect(new Set(result)).toEqual(new Set([...defaults, "node_modules", "dist", "**/*.spec.ts", "bin/"]));
    expect(result).toHaveLength(defaults.length + 4);
  });

  it("should merge and deduplicate patterns from all sources", async () => {
    const gitAttribContent = "*.gen.ts linguist-generated\ndist/** linguist-generated";
    const prettierIgnoreContent = "build/\n*.lock";
    const tsconfigContent = `{ "exclude": ["coverage", "build/"] }`;

    mockGetContent.mockImplementation((params) => {
      if (params?.path === ".gitattributes") return mockFileResponse(gitAttribContent);
      if (params?.path === ".prettierignore") return mockFileResponse(prettierIgnoreContent);
      if (params?.path === "tsconfig.json") return mockFileResponse(tsconfigContent);
      return mockNotFoundError();
    });

    const result = await getExcludedFiles(ctx, owner, repo);
    const expected = [...new Set([...defaults, "*.gen.ts", "build/", "coverage", "*.lock", "dist/**"])];
    expect(new Set(result)).toEqual(new Set(expected));
    expect(result).toHaveLength(expected.length);
  });

  it("should handle tsconfig without exclude array", async () => {
    const tsconfigContent = `{ "compilerOptions": {} }`;
    mockGetContent.mockImplementation((params) => {
      if (params?.path === "tsconfig.json") return mockFileResponse(tsconfigContent);
      return mockNotFoundError();
    });
    const result = await getExcludedFiles(ctx, owner, repo);
    expect(result).toEqual(defaults);
  });

  it("should handle invalid tsconfig json gracefully", async () => {
    const tsconfigContent = `{ "compilerOptions": { "exclude": [,] }`;
    mockGetContent.mockImplementation((params) => {
      if (params?.path === "tsconfig.json") return mockFileResponse(tsconfigContent);
      return mockNotFoundError();
    });
    const result = await getExcludedFiles(ctx, owner, repo);
    expect(result).toEqual(defaults);
  });
});
