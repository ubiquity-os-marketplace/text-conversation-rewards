/* eslint-disable sonarjs/no-nested-functions */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import fs from "fs";
import { http, HttpResponse, passthrough } from "msw";
import OpenAI from "openai";
import { CommentAssociation } from "../src/configuration/comment-types";
import { GitHubIssue } from "../src/github-types";
import { retry } from "../src/helpers/retry";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { Result } from "../src/types/results";
import { db as mockDb } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import contentEvaluatorResults from "./__mocks__/results/content-evaluator-results.json";
import dataPurgeResults from "./__mocks__/results/data-purge-result.json";
import eventIncentivesResults from "./__mocks__/results/event-incentives-results.json";
import externalContentResults from "./__mocks__/results/external-content-results.json";
import formattingEvaluatorResults from "./__mocks__/results/formatting-evaluator-results.json";
import githubCommentResults from "./__mocks__/results/github-comment-results.json";
import githubCommentAltResults from "./__mocks__/results/github-comment-zero-results.json";
import paymentResults from "./__mocks__/results/permit-generation-results.json";
import reviewIncentivizerResult from "./__mocks__/results/review-incentivizer-results.json";
import simplificationIncentivizerResults from "./__mocks__/results/simplification-incentivizer.results.json";
import userCommentResults from "./__mocks__/results/user-comment-results.json";
import cfg from "./__mocks__/results/valid-configuration.json";
import "./helpers/permit-mock";
import { mockWeb3Module } from "./helpers/web3-mocks";

const TEST_X25519_PRIVATE_KEY = "wrQ9wTI1bwdAHbxk2dfsvoK1yRwDc0CEenmMXFvGYgY";
process.env.X25519_PRIVATE_KEY = TEST_X25519_PRIVATE_KEY;

const issueUrl = process.env.TEST_ISSUE_URL ?? "https://github.com/ubiquity-os/conversation-rewards/issues/5";
const web3Mocks = mockWeb3Module();

jest.mock("@actions/github", () => ({
  default: {},
  context: {
    runId: "1",
    payload: {
      repository: {
        html_url: "https://github.com/ubiquity-os/conversation-rewards",
      },
    },
    sha: "1234",
  },
}));

jest.mock("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
}));

const ctx = {
  eventName: "issues.closed",
  payload: {
    issue: {
      html_url: "https://github.com/ubiquity-os/conversation-rewards/issues/5",
      number: 1,
      state_reason: "completed",
      assignees: [
        {
          id: 1,
          login: "gentlementlegen",
        },
      ],
    },
    repository: {
      name: "conversation-rewards",
      owner: {
        login: "ubiquity-os",
        id: 76412717, // https://github.com/ubiquity
      },
    },
  },
  adapters: {
    supabase: {
      location: {
        getOrCreateIssueLocation: jest.fn(async () => 1),
      },
      wallet: {
        getWalletByUserId: jest.fn(async () => "0x1"),
      },
    },
  },
  config: cfg,
  logger: new Logs("debug"),
  octokit: new customOctokit({ auth: process.env.GITHUB_TOKEN }),
  env: {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    X25519_PRIVATE_KEY: process.env.X25519_PRIVATE_KEY,
  },
} as unknown as ContextPlugin;

const PLACEHOLDER_TIMESTAMP = "2024-01-01T00:00:00.000Z";
const PLACEHOLDER_URL = "https://example.test/resource";
const PLACEHOLDER_CONTENT = "placeholder content";
const OPENAI_SYSTEM_PROMPT = "system prompt";

jest.mock("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(() => ({
      rpc: jest.fn(async () => ({ error: null })),
      from: jest.fn(() => ({
        insert: jest.fn(() => ({})),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 1,
              },
            })),
            eq: jest.fn(() => ({
              single: jest.fn(() => ({
                data: {
                  id: 1,
                },
              })),
            })),
          })),
        })),
      })),
    })),
  };
});

jest.mock("../src/data-collection/collect-linked-pulls", () => ({
  collectLinkedPulls: jest.fn(() => [
    {
      id: "PR_kwDOLUK0B85soGlu",
      title: "feat: github comment generation and posting",
      number: 12,
      url: "https://github.com/ubiquity-os/conversation-rewards/pull/12",
      author: {
        login: "gentlementlegen",
        id: 9807008,
      },
      state: "MERGED",
      repository: {
        owner: {
          login: "ubiquity-os",
        },
        name: "conversation-rewards",
      },
    },
  ]),
}));

/* eslint-disable @typescript-eslint/naming-convention */
let IssueActivity: typeof import("../src/issue-activity").IssueActivity;
let ContentEvaluatorModule: typeof import("../src/parser/content-evaluator-module").ContentEvaluatorModule;
let DataPurgeModule: typeof import("../src/parser/data-purge-module").DataPurgeModule;
let FormattingEvaluatorModule: typeof import("../src/parser/formatting-evaluator-module").FormattingEvaluatorModule;
let GithubCommentModule: typeof import("../src/parser/github-comment-module").GithubCommentModule;
let PaymentModule: typeof import("../src/parser/payment-module").PaymentModule;
let Processor: typeof import("../src/parser/processor").Processor;
let UserExtractorModule: typeof import("../src/parser/user-extractor-module").UserExtractorModule;
let ReviewIncentivizerModule: typeof import("../src/parser/review-incentivizer-module").ReviewIncentivizerModule;
let EventIncentivesModule: typeof import("../src/parser/event-incentives-module").EventIncentivesModule;
let SimplificationIncentivizerModule: typeof import("../src/parser/simplification-incentivizer-module").SimplificationIncentivizerModule;
let ExternalContentProcessor: typeof import("../src/parser/external-content-module").ExternalContentProcessor;
/* eslint-enable @typescript-eslint/naming-convention */

let activity: InstanceType<typeof IssueActivity>;

function getExternalContentProcessor(context: ContextPlugin) {
  const instance = new ExternalContentProcessor(context);
  Reflect.set(instance, "_llmWebsite", { chat: { completions: { create: jest.fn() } } });
  Reflect.set(instance, "_llmImage", { chat: { completions: { create: jest.fn() } } });
  return instance;
}

beforeAll(async () => {
  server.listen();

  ({ IssueActivity } = await import("../src/issue-activity"));
  ({ ContentEvaluatorModule } = await import("../src/parser/content-evaluator-module"));
  ({ DataPurgeModule } = await import("../src/parser/data-purge-module"));
  ({ FormattingEvaluatorModule } = await import("../src/parser/formatting-evaluator-module"));
  ({ GithubCommentModule } = await import("../src/parser/github-comment-module"));
  ({ PaymentModule } = await import("../src/parser/payment-module"));
  ({ Processor } = await import("../src/parser/processor"));
  ({ UserExtractorModule } = await import("../src/parser/user-extractor-module"));
  ({ ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module"));
  ({ EventIncentivesModule } = await import("../src/parser/event-incentives-module"));
  ({ SimplificationIncentivizerModule } = await import("../src/parser/simplification-incentivizer-module"));
  ({ ExternalContentProcessor } = await import("../src/parser/external-content-module"));

  jest.spyOn(ReviewIncentivizerModule.prototype, "getTripleDotDiffAsObject").mockImplementation(async () => {
    return {
      "test.ts": {
        addition: 50,
        deletion: 50,
      },
    };
  });

  // eslint-disable-next-line @typescript-eslint/naming-convention
  PaymentModule.prototype._getNetworkExplorer = (_networkId: number) => {
    return "https://rpc";
  };
  const issue = parseGitHubUrl(issueUrl);
  activity = new IssueActivity(ctx, issue);
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Modules tests", () => {
  beforeAll(async () => {
    await activity.init();
    for (const item of dbSeed.users) {
      mockDb.users.create(item);
    }
    for (const item of dbSeed.wallets) {
      mockDb.wallets.create(item);
    }
    for (const item of dbSeed.locations) {
      mockDb.locations.create(item);
    }
  });

  beforeEach(async () => {
    jest
      .spyOn(ContentEvaluatorModule.prototype, "_evaluateComments")
      .mockImplementation((specificationBody, userId, commentsToEvaluate) => {
        return Promise.resolve(
          (() => {
            const relevance: { [k: string]: number } = {};
            commentsToEvaluate.forEach((comment) => {
              relevance[`${comment.id}`] = 0.8;
            });
            return relevance;
          })()
        );
      });
    jest
      .spyOn(ContentEvaluatorModule.prototype, "_getRateLimitTokens")
      .mockImplementation(() => Promise.resolve(Infinity));

    jest.spyOn(ctx.octokit.rest.repos, "compareCommits").mockImplementation(async () => {
      return {
        data: {
          files: [
            {
              filename: "test.txt",
              additions: 50,
              deletions: 50,
              status: "added",
            },
          ],
        },
      } as unknown as ReturnType<Awaited<typeof ctx.octokit.rest.repos.compareCommits>>;
    });
  });

  it("Should extract users from comments", async () => {
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [new UserExtractorModule(ctx)];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(userCommentResults);
  });

  it("Should purge data", async () => {
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [new UserExtractorModule(ctx), new DataPurgeModule(ctx)];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(dataPurgeResults);
  });

  it("Should evaluate external content", async () => {
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(externalContentResults);
  });

  it("Should evaluate formatting", async () => {
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(formattingEvaluatorResults);
  });

  it("Should evaluate content", async () => {
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(contentEvaluatorResults);
  });

  it("Should throw on a failed LLM evaluation", async () => {
    jest.spyOn(ContentEvaluatorModule.prototype, "_evaluateComments").mockImplementation(() => {
      return Promise.resolve({});
    });

    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
    ];
    await expect(processor.run(activity)).rejects.toMatchObject({
      logMessage: {
        diff: "> [!CAUTION]\n> There was a mismatch between the relevance scores and amount of comments.",
        level: "error",
        raw: "There was a mismatch between the relevance scores and amount of comments.",
        type: "error",
      },
    });
  });

  it("Should incentivize reviews", async () => {
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(reviewIncentivizerResult);
  });

  it("Should incentivize events", async () => {
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
      new EventIncentivesModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(eventIncentivesResults);
  });

  it("Should incentivize simplifications", async () => {
    jest
      .spyOn(ContentEvaluatorModule.prototype, "_evaluateComments")
      .mockImplementation((specificationBody, userId, commentsToEvaluate, allComments, prCommentsToEvaluate) => {
        const relevance: { [k: string]: number } = {};
        (prCommentsToEvaluate ?? commentsToEvaluate ?? []).forEach((comment) => {
          relevance[`${comment.id}`] = 0.8;
        });
        return Promise.resolve(relevance);
      });
    // should run on https://github.com/ubiquity-os/conversation-rewards/pull/12 since it is a pull-request
    const ctx = {
      eventName: "pull_request.closed",
      payload: {
        pull_request: {
          html_url: "https://github.com/ubiquity-os/conversation-rewards/pull/12",
          number: 1,
          state_reason: "completed",
          assignees: [
            {
              id: 1,
              login: "gentlementlegen",
            },
          ],
        },
        repository: {
          name: "conversation-rewards",
          owner: {
            login: "ubiquity-os",
            id: 76412717, // https://github.com/ubiquity
          },
        },
      },
      adapters: {
        supabase: {
          location: {
            getOrCreateIssueLocation: jest.fn(async () => 1),
          },
          wallet: {
            getWalletByUserId: jest.fn(async () => "0x1"),
          },
        },
      },
      config: cfg,
      logger: new Logs("debug"),
      octokit: new customOctokit({ auth: process.env.GITHUB_TOKEN }),
      env: {
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        SUPABASE_KEY: process.env.SUPABASE_KEY,
        SUPABASE_URL: process.env.SUPABASE_URL,
        X25519_PRIVATE_KEY: process.env.X25519_PRIVATE_KEY,
      },
    } as unknown as ContextPlugin;
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
      new EventIncentivesModule(ctx),
      new SimplificationIncentivizerModule(ctx),
    ];
    await processor.run(activity);
    const dump = processor.dump();
    const result = JSON.parse(dump);
    expect(result).toEqual(simplificationIncentivizerResults);
  }, 240000);

  it("Should generate permits", async () => {
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
      new EventIncentivesModule(ctx),
      new PaymentModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(paymentResults);
  });

  it("Should generate GitHub comment", async () => {
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
      new EventIncentivesModule(ctx),
      new PaymentModule(ctx),
      new GithubCommentModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(githubCommentResults);
    expect(fs.readFileSync("./output.html", "utf-8")).toEqual(
      fs.readFileSync("./tests/__mocks__/results/output.html", "utf-8")
    );
  }, 120000);

  it("Should generate GitHub comment without zero total", async () => {
    const githubCommentModule = new GithubCommentModule(ctx);
    const postBody = await githubCommentModule.getBodyContent(
      // @ts-expect-error only needed to fulfill the function signature
      {},
      githubCommentAltResults as unknown as Result
    );
    expect(postBody.raw).not.toContain("whilefoo");
  });

  it("Should generate GitHub comment marking claimed permits", async () => {
    web3Mocks.Permit2Wrapper.isNonceClaimed
      .mockImplementationOnce(async () => true)
      .mockImplementationOnce(async () => false)
      .mockImplementationOnce(async () => false);
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
      new PaymentModule(ctx),
      new GithubCommentModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result["gentlementlegen"].evaluationCommentHtml).toEqual(
      `<details><summary><b><h3>&nbsp;<a href="https://pay.ubq.fi?claim=W3sidHlwZSI6ImVyYzIwLXBlcm1pdCIsInBlcm1pdCI6eyJwZXJtaXR0ZWQiOnsidG9rZW4iOiIweGU5MUQxNTNFMGI0MTUxOEEyQ2U4RGQzRDc5NDRGYTg2MzQ2M2E5N2QiLCJhbW91bnQiOnsidHlwZSI6IkJpZ051bWJlciIsImhleCI6IjB4MWI2MmE0NWU3ZWEwMTUwMDAwIn19LCJub25jZSI6IjgzMDc2NDM3NDQ2NDk5NTg5MzA0NjExMTI4OTYzOTE2NzEwMTA2ODg2MTAyNDM2MDIzODgxNTIwMDU4MzQ2ODAwNTc4NzU0NDAxNzU1IiwiZGVhZGxpbmUiOiIwIn0sInRyYW5zZmVyRGV0YWlscyI6eyJ0byI6IjB4NEQwNzA0ZjQwMEQ1N0JhOTNlRWE4ODc2NUMzRmNEQkQ4MjZkQ0ZjNCIsInJlcXVlc3RlZEFtb3VudCI6eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgxYjYyYTQ1ZTdlYTAxNTAwMDAifX0sIm93bmVyIjoiMHhkOTUzMEYzZmJCRWExMWJlRDAxREMwOUU3OTMxOGYyZjIwMjIzNzE2Iiwic2lnbmF0dXJlIjoiMHhjMjM2ZTE5MDg5YzkxNjg4OWZjNWY0OTE2M2Q2YzM1NTZkOTkzZGNkNmVjYjZkZDY0OTgwZTg5YzU4Zjc5NWE5MDk5MzA1NzE4MDk5NzI2YTRlYTAyY2YwNGEwMWIyZTRmYjBjMjFlYmQ2N2YxMGY5YTRmODU2MzkzMWM0MjU2NzFjIiwibmV0d29ya0lkIjoxMDB9XQ==" target="_blank" rel="noopener">[ 505.17 WXDAI ]</a>&nbsp;</h3><h6>@gentlementlegen</h6></b></summary><h6>Contributions Overview</h6><table><thead><tr><th>View</th><th>Contribution</th><th>Count</th><th>Reward</th></tr></thead><tbody><tr><td>Issue</td><td>Task</td><td>1</td><td>400</td></tr><tr><td>Issue</td><td>Specification</td><td>1</td><td>12.11</td></tr><tr><td>Issue</td><td>Comment</td><td>9</td><td>93.06</td></tr></tbody></table><h6>Conversation Incentives</h6><table><thead><tr><th>Comment</th><th>Formatting</th><th>Relevance</th><th>Priority</th><th>Reward</th></tr></thead><tbody><tr><td><h6><a href="https://github.com/ubiquity-os/conversation-rewards/issues/5#issue-2218638141" target="_blank" rel="noopener">In the v1 of the Ubiquibot, when a result gets evaluated, a reca&hellip;</a></h6></td><td><details><summary>9.87</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 3&#13;    ul:&#13;      score: 1&#13;      elementCount: 1&#13;    li:&#13;      score: 1&#13;      elementCount: 3&#13;    a:&#13;      score: 1&#13;      elementCount: 1&#13;  result: 8&#13;regex:&#13;  wordCount: 87&#13;  wordValue: 0.1&#13;  result: 1.87&#13;authorship: 1&#13;</pre></details></td><td>Relevance: -<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 35.6</td><td>4</td><td>12.11</td></tr><tr><td><h6><a href="https://github.com/ubiquity-os/conversation-rewards/issues/5#issuecomment-2033404518" target="_blank" rel="noopener">This needs [https://github.com/ubiquity-os/conversation-rewards/&hellip;</a></h6></td><td><details><summary>4.88</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 1&#13;    a:&#13;      score: 1&#13;      elementCount: 2&#13;  result: 3&#13;regex:&#13;  wordCount: 17&#13;  wordValue: 0.2&#13;  result: 1.88&#13;authorship: 1&#13;</pre></details></td><td>Relevance: -<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 52.9</td><td>4</td><td>6.24</td></tr><tr><td><h6><a href="https://github.com/ubiquity-os/conversation-rewards/issues/5#issuecomment-2036174312" target="_blank" rel="noopener">To me 1 is the most straightforward to do for few reasons:- th&hellip;</a></h6></td><td><details><summary>10.66</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 2&#13;    ul:&#13;      score: 1&#13;      elementCount: 1&#13;    li:&#13;      score: 1&#13;      elementCount: 3&#13;    a:&#13;      score: 1&#13;      elementCount: 1&#13;  result: 7&#13;regex:&#13;  wordCount: 104&#13;  wordValue: 0.2&#13;  result: 3.66&#13;authorship: 1&#13;</pre></details></td><td>Relevance: -<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 60.8</td><td>4</td><td>13.83</td></tr><tr><td><h6><a href="https://github.com/ubiquity-os/conversation-rewards/issues/5#issuecomment-2036367126" target="_blank" rel="noopener">I think each plugin should output JSON not html as it is not rel&hellip;</a></h6></td><td><details><summary>10.65</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 3&#13;    code:&#13;      score: 1&#13;      elementCount: 3&#13;    a:&#13;      score: 1&#13;      elementCount: 1&#13;  result: 7&#13;regex:&#13;  wordCount: 106&#13;  wordValue: 0.2&#13;  result: 3.65&#13;authorship: 1&#13;</pre></details></td><td>Relevance: -<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 45.2</td><td>4</td><td>13.37</td></tr><tr><td><h6><a href="https://github.com/ubiquity-os/conversation-rewards/issues/5#issuecomment-2036385985" target="_blank" rel="noopener">If you want to manipulate and convey data, HTML really is not ma&hellip;</a></h6></td><td><details><summary>7.37</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 3&#13;    a:&#13;      score: 1&#13;      elementCount: 1&#13;  result: 4&#13;regex:&#13;  wordCount: 134&#13;  wordValue: 0.2&#13;  result: 3.37&#13;authorship: 1&#13;</pre></details></td><td>Relevance: -<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 53.5</td><td>4</td><td>9.44</td></tr><tr><td><h6><a href="https://github.com/ubiquity-os/conversation-rewards/issues/5#issuecomment-2036411811" target="_blank" rel="noopener">But then how do we consider the formatting of that output?Pr&hellip;</a></h6></td><td><details><summary>7.03</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 4&#13;  result: 4&#13;regex:&#13;  wordCount: 159&#13;  wordValue: 0.2&#13;  result: 3.03&#13;authorship: 1&#13;</pre></details></td><td>Relevance: -<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 66.7</td><td>4</td><td>9</td></tr><tr><td><h6><a href="https://github.com/ubiquity-os/conversation-rewards/issues/5#issuecomment-2036458775" target="_blank" rel="noopener">This can work, but we skyrocket coupling and to me defeat purpos&hellip;</a></h6></td><td><details><summary>4.48</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 1&#13;  result: 1&#13;regex:&#13;  wordCount: 55&#13;  wordValue: 0.2&#13;  result: 3.48&#13;authorship: 1&#13;</pre></details></td><td>Relevance: -<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 49.7</td><td>4</td><td>5.69</td></tr><tr><td><h6><a href="https://github.com/ubiquity-os/conversation-rewards/issues/5#issuecomment-2036535332" target="_blank" rel="noopener">@pavlovcik To mitigate that that's why inside the comment reward&hellip;</a></h6></td><td><details><summary>5.73</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 1&#13;    code:&#13;      score: 1&#13;      elementCount: 1&#13;  result: 2&#13;regex:&#13;  wordCount: 85&#13;  wordValue: 0.2&#13;  result: 3.73&#13;authorship: 1&#13;</pre></details></td><td>Relevance: -<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 61.8</td><td>4</td><td>7.42</td></tr><tr><td><h6><a href="https://github.com/ubiquity-os/conversation-rewards/issues/5#issuecomment-2051094255" target="_blank" rel="noopener">I realized that to carry this task properly we need to handle fl&hellip;</a></h6></td><td><details><summary>6.53</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 1&#13;    code:&#13;      score: 1&#13;      elementCount: 2&#13;  result: 3&#13;regex:&#13;  wordCount: 58&#13;  wordValue: 0.2&#13;  result: 3.53&#13;authorship: 1&#13;</pre></details></td><td>Relevance: -<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 58.9</td><td>4</td><td>8.47</td></tr><tr><td><h6><a href="https://github.com/ubiquity-os/conversation-rewards/issues/5#issuecomment-2054424028" target="_blank" rel="noopener">Agreed, I think currently there are 3 possible things to annotat&hellip;</a></h6></td><td><details><summary>16.46</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 2&#13;    ul:&#13;      score: 1&#13;      elementCount: 1&#13;    li:&#13;      score: 1&#13;      elementCount: 3&#13;    code:&#13;      score: 1&#13;      elementCount: 7&#13;  result: 13&#13;regex:&#13;  wordCount: 54&#13;  wordValue: 0.2&#13;  result: 3.46&#13;authorship: 1&#13;</pre></details></td><td>Relevance: -<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 23.6</td><td>4</td><td>19.6</td></tr></tbody></table></details>`
    );
  });

  describe("Reward limits", () => {
    it("Should return infinity if disabled", async () => {
      const processor = new Processor({
        ...ctx,
        config: {
          ...ctx.config,
          incentives: {
            ...ctx.config.incentives,
            limitRewards: false,
          },
        },
      });
      const result = await processor._getRewardsLimit({} as unknown as GitHubIssue);
      expect(result).toBe(Infinity);
    });
  });

  it("Should return 0 when priceTagReward is 0 (due to Price: 0 label)", async () => {
    const processor = new Processor({
      ...ctx,
      config: {
        ...ctx.config,
        incentives: {
          ...ctx.config.incentives,
          limitRewards: true,
        },
      },
    });

    const mockIssueWithZeroPrice = { labels: [{ name: "Price: 0 USD" }] } as unknown as GitHubIssue;

    const rewardLimit = await processor._getRewardsLimit(mockIssueWithZeroPrice);
    expect(rewardLimit).toBe(0);

    const priceTagReward = 0;
    const oldImplementationResult = priceTagReward || Infinity;
    expect(oldImplementationResult).toBe(Infinity);

    const newImplementationResult = priceTagReward ?? Infinity;
    expect(newImplementationResult).toBe(0);
  });

  it("Should return the max corresponding to the label of the issue if enabled", async () => {
    const processor = new Processor({
      ...ctx,
      config: {
        ...ctx.config,
        incentives: {
          ...ctx.config.incentives,
          limitRewards: true,
        },
      },
    });
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
    ];
    processor["_result"] = {
      user1: {
        total: 999,
        task: {
          multiplier: 0.5,
          reward: 18.5,
          timestamp: PLACEHOLDER_TIMESTAMP,
          url: PLACEHOLDER_URL,
        },
        userId: 0,
      },
      user2: {
        total: 11111111,
        userId: 1,
      },
    };
    const result = await processor._getRewardsLimit({
      labels: [{ name: "Price: 9.25 USD" }],
    } as unknown as GitHubIssue);
    expect(result).toBe(9.25);
    let oldLabels = null;
    if (activity.self?.labels) {
      oldLabels = activity.self.labels;
      activity.self.labels = [{ name: "Price: 9.25 USD" }];
    }
    const total = await processor.run(activity);
    expect(total).toMatchObject({
      user1: { total: 9.25, task: { multiplier: 0.5, reward: 18.5 }, userId: 0 },
      user2: { total: 0, userId: 1 },
      "0x4007": {
        total: 9.25,
      },
      whilefoo: {
        total: 1.568,
      },
    });
    if (oldLabels && activity.self) {
      activity.self.labels = oldLabels;
    }
  });

  it("Should not limit the assigned user", async () => {
    const processor = new Processor({
      ...ctx,
      config: {
        ...ctx.config,
        incentives: {
          ...ctx.config.incentives,
          limitRewards: true,
        },
      },
    });
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
    ];
    processor["_result"] = {
      gentlementlegen: {
        total: 999,
        task: {
          multiplier: 0.5,
          reward: 18.5,
          timestamp: PLACEHOLDER_TIMESTAMP,
          url: PLACEHOLDER_URL,
        },
        comments: [
          {
            id: 1,
            content: PLACEHOLDER_CONTENT,
            url: PLACEHOLDER_URL,
            timestamp: PLACEHOLDER_TIMESTAMP,
            commentType: CommentAssociation.ASSIGNEE,
            score: {
              reward: 50000,
              multiplier: 3,
              authorship: 1,
            },
          },
        ],
        userId: 9807008,
      },
      user2: {
        total: 11111111,
        userId: 1,
      },
    };
    const result = await processor._getRewardsLimit({
      labels: [{ name: "Price: 9.25 USD" }],
    } as unknown as GitHubIssue);
    expect(result).toBe(9.25);
    const total = await processor.run(activity);
    expect(total).toMatchObject({
      gentlementlegen: { total: 800, task: { multiplier: 1, reward: 400 }, userId: 9807008 },
      user2: { total: 0, userId: 1 },
      "0x4007": {
        total: 272.8,
      },
      whilefoo: {
        total: 6.272,
      },
    });
  });

  it("It should warn the user if wallet is not set", async () => {
    const context = {
      ...ctx,
      adapters: {
        ...ctx.adapters,
        supabase: {
          location: {
            getOrCreateIssueLocation: jest.fn(async () => 1),
          },
          wallet: {
            getWalletByUserId: jest.fn(async (userId: number) => {
              if (userId === githubCommentResults["whilefoo"].userId) {
                return null;
              }
              return "0x1";
            }),
          },
        },
      },
    } as unknown as ContextPlugin;
    const processor = new Processor(context);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(context),
      new DataPurgeModule(context),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(context),
      new PaymentModule(context),
      new GithubCommentModule(context),
    ];
    // This catches calls by getFastestRpc
    server.use(http.post("https://*", () => passthrough()));
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result["whilefoo"].evaluationCommentHtml).toContain("Wallet address is not set");
  }, 120000);

  it("It should warn the user if wallet could not be fetched", async () => {
    const context = {
      ...ctx,
      adapters: {
        ...ctx.adapters,
        supabase: {
          location: {
            getOrCreateIssueLocation: jest.fn(async () => 1),
          },
          wallet: {
            getWalletByUserId: jest.fn(async (userId: number) => {
              if (userId === githubCommentResults["whilefoo"].userId) {
                throw new Error("Connection error");
              }
              return "0x1";
            }),
          },
        },
      },
    } as unknown as ContextPlugin;
    const processor = new Processor(context);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(context),
      new DataPurgeModule(context),
      getExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(context),
      new PaymentModule(context),
      new GithubCommentModule(context),
    ];
    // This catches calls by getFastestRpc
    server.use(http.post("https://*", () => passthrough()));
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result["whilefoo"].evaluationCommentHtml).toContain("Error fetching wallet");
  }, 120000);
});

describe("Retry", () => {
  const openAi = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, maxRetries: 0 });

  async function testFunction() {
    return openAi.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: OPENAI_SYSTEM_PROMPT,
        },
      ],
    });
  }

  it("should return correct value", async () => {
    server.use(
      http.post("https://api.openai.com/v1/*", () => {
        return HttpResponse.json({ choices: [{ text: "Hello" }] });
      })
    );

    const res = await retry(testFunction, { maxRetries: 3 });
    expect(res).toMatchObject({ choices: [{ text: "Hello" }] });
  });

  it("should retry on any error", async () => {
    let called = 0;
    server.use(
      http.post("https://api.openai.com/v1/*", () => {
        called += 1;
        if (called === 1) {
          return HttpResponse.text("error", { status: 500 });
        } else if (called === 2) {
          return HttpResponse.text("rate limited", { status: 429 });
        } else {
          return HttpResponse.json({ choices: [{ text: "Hello" }] });
        }
      })
    );

    const res = await retry(testFunction, { maxRetries: 3 });
    expect(res).toMatchObject({ choices: [{ text: "Hello" }] });
  });

  it("should throw error if maxRetries is reached", async () => {
    server.use(
      http.post("https://api.openai.com/v1/*", () => {
        return HttpResponse.text("error", { status: 500 });
      })
    );

    await expect(
      retry(testFunction, {
        maxRetries: 3,
        isErrorRetryable: (err) => {
          return err instanceof OpenAI.APIError && err.status === 500;
        },
      })
    ).rejects.toMatchObject({ status: 500 });
  });

  it("should retry on 500 but fail on 429", async () => {
    let called = 0;
    server.use(
      http.post("https://api.openai.com/v1/*", () => {
        called += 1;
        if (called === 1) {
          return HttpResponse.text("error", { status: 500 });
        } else if (called === 2) {
          return HttpResponse.text("rate limited", { status: 429 });
        } else {
          return HttpResponse.json({ choices: [{ text: "Hello" }] });
        }
      })
    );
    const onErrorHandler = jest.fn<() => void>();

    await expect(
      retry(testFunction, {
        maxRetries: 3,
        isErrorRetryable: (err) => {
          return err instanceof OpenAI.APIError && err.status === 500;
        },
        onError: onErrorHandler,
      })
    ).rejects.toMatchObject({ status: 429 });
    expect(onErrorHandler).toHaveBeenCalledTimes(2);
  });
});
