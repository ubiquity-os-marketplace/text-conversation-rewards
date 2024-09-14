import { drop } from "@mswjs/data";
import { IssueActivity } from "../src/issue-activity";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { DataPurgeModule } from "../src/parser/data-purge-module";
import { Processor } from "../src/parser/processor";
import { UserExtractorModule } from "../src/parser/user-extractor-module";
import { parseGitHubUrl } from "../src/start";
import "../src/parser/command-line";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import hiddenCommentPurged from "./__mocks__/results/hidden-comment-purged.json";
import { GitHubIssueComment } from "../src/github-types";

const issueUrl = "https://github.com/Meniole/conversation-rewards/issues/13";

jest.spyOn(ContentEvaluatorModule.prototype, "_evaluateComments").mockImplementation((specification, comments) => {
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

jest.mock("@actions/github", () => ({
  context: {
    runId: "1",
    payload: {
      repository: {
        html_url: "https://github.com/ubiquibot/conversation-rewards",
      },
    },
  },
}));

jest.mock("@octokit/plugin-paginate-graphql", () => ({
  paginateGraphQL() {
    return {
      graphql: {
        paginate() {
          return {
            repository: {
              issue: {
                closedByPullRequestsReferences: {
                  edges: [],
                },
              },
            },
          };
        },
      },
    };
  },
}));

jest.mock("../src/start", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const comments = require("./__mocks__/routes/issue-13-comments-get.json");
  return {
    ...jest.requireActual("../src/start"),
    getIssueComments: jest.fn(() => Promise.resolve(comments)),
  };
});

jest.mock("../src/parser/command-line", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cfg = require("./__mocks__/results/valid-configuration.json");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv");
  dotenv.config();
  return {
    stateId: 1,
    eventName: "issues.closed",
    authToken: process.env.GITHUB_TOKEN,
    ref: "",
    eventPayload: {
      issue: {
        html_url: issueUrl,
        number: 13,
        state_reason: "completed",
      },
      repository: {
        name: "conversation-rewards",
        owner: {
          login: "ubiquibot",
          id: 76412717,
        },
      },
    },
    settings: JSON.stringify(cfg),
  };
});

jest.mock("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn((comments: GitHubIssueComment[]) => {
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      comment.isMinimized = i === 1;
    }
  }),
}));

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Purging tests", () => {
  const issue = parseGitHubUrl(issueUrl);
  const activity = new IssueActivity(issue);

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

  it("Should purge collapsed comments", async () => {
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule(), new DataPurgeModule()];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    console.log(JSON.stringify(result));
    expect(result).toEqual(hiddenCommentPurged);
  });
});
