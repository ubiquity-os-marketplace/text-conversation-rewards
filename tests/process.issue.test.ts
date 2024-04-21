import { parseGitHubUrl } from "../src/start";
import { IssueActivity } from "../src/issue-activity";
import { Processor } from "../src/parser/processor";
import { UserExtractorModule } from "../src/parser/user-extractor-module";
import { server } from "./__mocks__/node";
import { DataPurgeModule } from "../src/parser/data-purge-module";
import userCommentResults from "./__mocks__/results/user-comment-results.json";
import dataPurgeResults from "./__mocks__/results/data-purge-result.json";
import formattingEvaluatorResults from "./__mocks__/results/formatting-evaluator-results.json";
import contentEvaluatorResults from "./__mocks__/results/content-evaluator-results.json";
import { FormattingEvaluatorModule } from "../src/parser/formatting-evaluator-module";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import Decimal from "decimal.js";

const issueUrl = process.env.TEST_ISSUE_URL || "https://github.com/ubiquibot/comment-incentives/issues/22";

jest.spyOn(ContentEvaluatorModule.prototype, "_evaluateComments").mockImplementation((specification, comments) => {
  return Promise.resolve(comments.map(() => new Decimal(0.8)));
});

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
    const logSpy = jest.spyOn(console, "log");
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule()];
    await processor.run(activity);
    processor.dump();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(userCommentResults, undefined, 2));
  });

  it("Should purge data", async () => {
    const logSpy = jest.spyOn(console, "log");
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule(), new DataPurgeModule()];
    await processor.run(activity);
    processor.dump();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(dataPurgeResults, undefined, 2));
  });

  it("Should evaluate formatting", async () => {
    const logSpy = jest.spyOn(console, "log");
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule(), new DataPurgeModule(), new FormattingEvaluatorModule()];
    await processor.run(activity);
    processor.dump();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(formattingEvaluatorResults, undefined, 2));
  });

  it("Should evaluate content", async () => {
    const logSpy = jest.spyOn(console, "log");
    const processor = new Processor();
    processor["_transformers"] = [
      new UserExtractorModule(),
      new DataPurgeModule(),
      new FormattingEvaluatorModule(),
      new ContentEvaluatorModule(),
    ];
    await processor.run(activity);
    processor.dump();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(contentEvaluatorResults, undefined, 2));
  });
});
