import { drop } from "@mswjs/data";
import fs from "fs";
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
import rewardSplitResult from "./__mocks__/results/reward-split.json";

const issueUrl = "https://github.com/ubiquibot/conversation-rewards/issues/110";

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
          return {};
        },
      },
    };
  },
}));

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
        number: 110,
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

// jest.mock("@supabase/supabase-js", () => {
//   return {
//     createClient: jest.fn(() => ({
//       from: jest.fn(() => ({
//         insert: jest.fn(() => ({})),
//         select: jest.fn(() => ({
//           eq: jest.fn(() => ({
//             single: jest.fn(() => ({
//               data: {
//                 id: 1,
//               },
//             })),
//             eq: jest.fn(() => ({
//               single: jest.fn(() => ({
//                 data: {
//                   id: 1,
//                 },
//               })),
//             })),
//           })),
//         })),
//       })),
//     })),
//   };
// });

// jest.mock("../src/helpers/web3", () => ({
//   getERC20TokenSymbol() {
//     return "WXDAI";
//   },
// }));

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
    // server.use(
    //   http.post("https://*", () =>
    //     HttpResponse.json([
    //       {
    //         jsonrpc: "2.0",
    //         id: 1,
    //         result: "0x64",
    //       },
    //       {
    //         jsonrpc: "2.0",
    //         id: 2,
    //         result: "0x0000000000000000000000000000000000000000000000000000000000000012",
    //       },
    //     ])
    //   )
    // );
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(rewardSplitResult);
    expect(fs.readFileSync("./output.html", "utf-8")).toEqual(
      fs.readFileSync("./tests/__mocks__/results/output-reward-split.html", "utf-8")
    );
  });
});
