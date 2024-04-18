import { parseGitHubUrl } from "../src/start";
import { IssueActivity } from "../src/issue-activity";
import { Processor } from "../src/parser/processor";
import { UserExtractorModule } from "../src/parser/user-extractor-module";
import { server } from "./__mocks__/node";
import { DataPurgeModule } from "../src/parser/data-purge-module";

const issueUrl = process.env.TEST_ISSUE_URL || "https://github.com/ubiquibot/comment-incentives/issues/22";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Modules tests", () => {
  const issue = parseGitHubUrl(issueUrl);
  const activity = new IssueActivity(issue);

  beforeAll(async () => {
    await activity.init();
  });

  it("Should extract users from comments", async () => {
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule()];
    await processor.run(activity);
    processor.dump();
  });

  it("Should purge data", async () => {
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule(), new DataPurgeModule()];
    await processor.run(activity);
    processor.dump();
  });
});
