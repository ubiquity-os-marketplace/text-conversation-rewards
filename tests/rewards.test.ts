/* eslint-disable sonarjs/no-nested-functions */

import { afterAll, afterEach, beforeAll, beforeEach, describe, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import fs from "fs";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import authorshipRewardResult from "./__mocks__/results/authorship-reward.json";
import rewardSplitResult from "./__mocks__/results/reward-split.json";
import cfg from "./__mocks__/results/valid-configuration.json";
import "./helpers/permit-mock";
import { mockWeb3Module } from "./helpers/web3-mocks";
import { Result } from "../src/types/results";
import { ContextPlugin } from "../src/types/plugin-input";

const issueUrl = "https://github.com/ubiquity/work.ubq.fi/issues/69";

mockWeb3Module();

jest.unstable_mockModule("@actions/github", () => ({
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

jest.unstable_mockModule("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(() => ({
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

const collectLinkedMergedPulls = jest.fn(() => [
  {
    id: "PR_kwDOKzVPS85zXUoj",
    title: "fix: add state to sorting manager for bottom and top",
    number: 70,
    url: "https://github.com/ubiquity/work.ubq.fi/pull/70",
    author: {
      login: "0x4007",
      id: 4975670,
    },
    state: "MERGED",
    repository: {
      owner: {
        login: "ubiquity",
      },
      name: "work.ubq.fi",
    },
  },
]);

jest.unstable_mockModule("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
}));

jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
  collectLinkedMergedPulls: collectLinkedMergedPulls,
}));

beforeAll(() => {
  server.listen();
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PaymentModule.prototype._getNetworkExplorer = (_networkId: number) => {
    return "https://rpc";
  };
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const { IssueActivity } = await import("../src/issue-activity");
const { ContentEvaluatorModule } = await import("../src/parser/content-evaluator-module");
const { DataPurgeModule } = await import("../src/parser/data-purge-module");
const { FormattingEvaluatorModule } = await import("../src/parser/formatting-evaluator-module");
const { GithubCommentModule } = await import("../src/parser/github-comment-module");
const { PaymentModule } = await import("../src/parser/payment-module");
const { Processor } = await import("../src/parser/processor");
const { UserExtractorModule } = await import("../src/parser/user-extractor-module");
const { parseGitHubUrl } = await import("../src/start");
const { ExternalContentProcessor } = await import("../src/parser/external-content-module");

jest.spyOn(ContentEvaluatorModule.prototype, "_evaluateComments").mockImplementation((specificationBody, comments) => {
  return Promise.resolve(
    (() => {
      const relevance: { [k: string]: number } = {};
      comments.forEach((comment) => {
        relevance[`${comment.id}`] = 0.8;
      });
      return relevance;
    })()
  );
});

jest.spyOn(ContentEvaluatorModule.prototype, "_getRateLimitTokens").mockImplementation(() => Promise.resolve(Infinity));

describe("Rewards tests", () => {
  const issue = parseGitHubUrl(issueUrl);
  const ctx = {
    eventName: "issues.closed",
    payload: {
      issue: {
        html_url: issueUrl,
        number: 69,
        state_reason: "completed",
        assignees: [
          {
            id: 1,
            login: "gentlementlegen",
          },
          {
            id: 2,
            login: "0x4007",
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
        wallet: {
          getWalletByUserId: jest.fn(async () => "0x1"),
        },
      },
    },
    config: cfg,
    logger: new Logs("debug"),
    octokit: new Octokit(),
    env: process.env,
  } as unknown as ContextPlugin;
  const activity = new IssueActivity(ctx, issue);

  beforeEach(async () => {
    drop(db);
    for (const table of Object.keys(dbSeed)) {
      const tableName = table as keyof typeof dbSeed;
      for (const row of dbSeed[tableName]) {
        db[tableName].create(row);
      }
    }
    await activity.init();
  });

  it("Should split the rewards between multiple assignees", async () => {
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new PaymentModule(ctx),
      new GithubCommentModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(rewardSplitResult);
    expect(fs.readFileSync("./output.html", "utf-8")).toEqual(
      fs.readFileSync("./tests/__mocks__/results/output-reward-split.html", "utf-8")
    );
  }, 120000);

  it("Should distribute rewards based on authorship percentages in issue body edits", async () => {
    const author = {
      login: "contributor1",
      id: 4975670,
    };
    collectLinkedMergedPulls.mockReturnValueOnce([
      {
        id: "PR_kwDOKzVPS85zXUoj",
        title: "fix: add authorship to issue body edits",
        number: 101,
        url: "https://github.com/ubiquity/work.ubq.fi/pull/101",
        author,
        state: "MERGED",
        repository: {
          owner: {
            login: "ubiquity",
          },
          name: "work.ubq.fi",
        },
      },
    ]);
    const issueUrl = "https://github.com/ubiquity/work.ubq.fi/issues/100";
    const issue = parseGitHubUrl(issueUrl);
    const modifiedCtx = {
      ...ctx,
    };
    modifiedCtx.payload = structuredClone(ctx.payload);
    if ("issue" in modifiedCtx.payload) {
      modifiedCtx.payload.issue.html_url = issueUrl;
      modifiedCtx.payload.issue.id = 100;
      modifiedCtx.payload.issue.assignees = [author] as typeof modifiedCtx.payload.issue.assignees;
    }
    const activity = new IssueActivity(modifiedCtx, issue);
    await activity.init();
    const processor = new Processor(modifiedCtx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new GithubCommentModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(authorshipRewardResult);
    expect(fs.readFileSync("./output.html", "utf-8")).toEqual(
      fs.readFileSync("./tests/__mocks__/results/output-authorship-reward.html", "utf-8")
    );
  }, 120000);

  it("Should display a wallet warning on missing wallet, but none on XP mode", async () => {
    const modifiedCtx = {
      ...ctx,
      config: {
        ...ctx.config,
        rewards: undefined,
      },
    };
    modifiedCtx.config.rewards = undefined;
    const processor = new Processor(modifiedCtx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(modifiedCtx),
      new DataPurgeModule(modifiedCtx),
      new FormattingEvaluatorModule(modifiedCtx),
      new ContentEvaluatorModule(modifiedCtx),
      new PaymentModule(modifiedCtx),
      new GithubCommentModule(modifiedCtx),
    ];
    await processor.run(activity);
    const result: Result = JSON.parse(processor.dump());
    expect(Object.values(result)?.[0].evaluationCommentHtml).toMatch(
      `<details><summary><b><h3>&nbsp;[ 51.232 XP ]&nbsp;</h3><h6>@0x4007</h6></b></summary><h6>Contributions Overview</h6><table><thead><tr><th>View</th><th>Contribution</th><th>Count</th><th>Reward</th></tr></thead><tbody><tr><td>Issue</td><td>Task</td><td>0.5</td><td>25</td></tr><tr><td>Issue</td><td>Specification</td><td>1</td><td>5.95</td></tr><tr><td>Issue</td><td>Comment</td><td>2</td><td>6.8</td></tr><tr><td>Review</td><td>Comment</td><td>3</td><td>13.482</td></tr></tbody></table><h6>Conversation Incentives</h6><table><thead><tr><th>Comment</th><th>Formatting</th><th>Relevance</th><th>Priority</th><th>Reward</th></tr></thead><tbody><tr><td><h6><a href="https://github.com/ubiquity/work.ubq.fi/issues/69#issue-2370126310" target="_blank" rel="noopener">Looks like the filters are barely useable now that we have the s&hellip;</a></h6></td><td><details><summary>4.66</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 2&#13;    img:&#13;      score: 1&#13;      elementCount: 1&#13;  result: 3&#13;regex:&#13;  wordCount: 48&#13;  wordValue: 0.1&#13;  result: 1.66&#13;authorship: 1&#13;</pre></details></td><td>Relevance: 1<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 67.9</td><td>1</td><td>5.95</td></tr><tr><td><h6><a href="https://github.com/ubiquity/work.ubq.fi/issues/69#issuecomment-2186802545" target="_blank" rel="noopener">Okay both bots are broken @gentlementlegen We should have sp&hellip;</a></h6></td><td><details><summary>3.55</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 2&#13;  result: 2&#13;regex:&#13;  wordCount: 13&#13;  wordValue: 0.2&#13;  result: 1.55&#13;authorship: 1&#13;</pre></details></td><td>Relevance: 0.8<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 50.5</td><td>1</td><td>3.608</td></tr><tr><td><h6><a href="https://github.com/ubiquity/work.ubq.fi/issues/69#issuecomment-2186807999" target="_blank" rel="noopener">Actually, looks like it did the right thing for your reward on v&hellip;</a></h6></td><td><details><summary>3.16</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 1&#13;  result: 1&#13;regex:&#13;  wordCount: 21&#13;  wordValue: 0.2&#13;  result: 2.16&#13;authorship: 1&#13;</pre></details></td><td>Relevance: 0.8<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 72.7</td><td>1</td><td>3.192</td></tr><tr><td><h6><a href="https://github.com/ubiquity/work.ubq.fi/pull/70#issue-2370184795" target="_blank" rel="noopener">Resolves [https://github.com/ubiquity/work.ubq.fi/issues/69](htt&hellip;</a></h6></td><td><details><summary>2</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 1&#13;    a:&#13;      score: 1&#13;      elementCount: 1&#13;  result: 2&#13;regex:&#13;  wordCount: 1&#13;  wordValue: 0&#13;  result: 0&#13;authorship: 1&#13;</pre></details></td><td>Relevance: 0.7<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 68.9</td><td>1</td><td>0</td></tr><tr><td><h6><a href="https://github.com/ubiquity/work.ubq.fi/pull/70#issuecomment-2186530214" target="_blank" rel="noopener">I always struggle with Cypress</a></h6></td><td><details><summary>1.75</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 1&#13;  result: 1&#13;regex:&#13;  wordCount: 5&#13;  wordValue: 0.2&#13;  result: 0.75&#13;authorship: 1&#13;</pre></details></td><td>Relevance: 0.7<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 66.4</td><td>1</td><td>3.136</td></tr><tr><td><h6><a href="https://github.com/ubiquity/work.ubq.fi/pull/70#issuecomment-2186798329" target="_blank" rel="noopener">Only doesn't work on my local, the guess is token expiration aft&hellip;</a></h6></td><td><details><summary>6.05</summary><pre>content:&#13;  content:&#13;    p:&#13;      score: 1&#13;      elementCount: 2&#13;    a:&#13;      score: 1&#13;      elementCount: 1&#13;  result: 3&#13;regex:&#13;  wordCount: 39&#13;  wordValue: 0.2&#13;  result: 3.05&#13;authorship: 1&#13;</pre></details></td><td>Relevance: 0.7<br/><span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: 86.3</td><td>1</td><td>10.346</td></tr></tbody></table></details>`
    );
  });

  it("Should not display a wallet warning on XP mode", async () => {
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new PaymentModule(ctx),
      new GithubCommentModule(ctx),
    ];
    await processor.run(activity);
    const result: Result = JSON.parse(processor.dump());
    expect(Object.values(result)?.[0].evaluationCommentHtml).not.toMatch("Error fetching wallet");
  });

  it("Should display a capped messaged on capped rewards", async () => {
    const taskPrice = 0.01;
    let originalLabel: string | undefined = undefined;
    let labelIdx = -1;
    if (activity.self) {
      const idx = activity.self.labels.findIndex((item) => typeof item !== "string" && item.name?.includes("Price"));
      if (typeof activity.self.labels[idx] !== "string") {
        originalLabel = activity.self.labels[idx].name;
        labelIdx = idx;
        activity.self.labels[idx].name = `Price: ${taskPrice} USD`;
      }
    }
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new GithubCommentModule(ctx),
    ];
    await processor.run(activity);
    const result: Result = JSON.parse(processor.dump());
    if (activity.self && labelIdx > -1 && originalLabel) {
      // @ts-expect-error This is checked earlier
      activity.self.labels[labelIdx].name = originalLabel;
    }
    expect(Object.values(result)?.[0].evaluationCommentHtml).toMatch(
      `Your rewards have been limited to the task price of ${taskPrice} WXDAI`
    );
  });

  it("Should ignore invalid links", async () => {
    ctx.config.incentives.externalContent = {
      llmWebsiteModel: {
        model: "model",
        tokenCountLimit: 1000,
        endpoint: "endopint",
        maxRetries: 1,
      },
      llmImageModel: {
        model: "model",
        tokenCountLimit: 1000,
        endpoint: "endpoint",
        maxRetries: 1,
      },
    };
    const originalBody = activity.self?.body;
    const originalActivity = {
      comments: activity.comments,
      events: activity.events,
      linkedReviews: activity.linkedReviews,
    };
    const processor = new Processor(ctx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new ExternalContentProcessor(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
    ];
    if (activity.self) {
      activity.self.body =
        "### Getting Started\n" +
        "- Try out the commands you see. Feel free to experiment with different tasks and features.\n" +
        "- Create a [new issue](new) at any time to reset and begin anew.\n" +
        "- Use `/help` if you’d like to see additional commands.\n" +
        "\n" +
        "https://123-not-valid-url.com";
      activity.comments = [];
      activity.events = [];
      activity.linkedReviews = [];
    }
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    ctx.config.incentives.externalContent = null;
    if (activity.self) {
      activity.self.body = originalBody;
      activity.comments = originalActivity.comments;
      activity.events = originalActivity.events;
      activity.linkedReviews = originalActivity.linkedReviews;
    }
    expect(result).not.toBeUndefined();
  });
});
