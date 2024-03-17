import { config } from "dotenv";
import { GetActivity } from "./get-activity";
import { ContentEvaluatorTransformer } from "./parser/content-evaluator-transformer";
import { DataPurgeTransformer } from "./parser/data-purge-transformer";
import { Processor } from "./parser/processor";
import { UserExtractorTransformer } from "./parser/user-extractor-transformer";
import { parseGitHubUrl } from "./start";

config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.warn("GITHUB_TOKEN is not set");
}
// Mock process.argv
process.argv = ["path/to/node", "path/to/script", `--auth=${GITHUB_TOKEN}`];
const issueUrl = process.env.TEST_ISSUE_URL || "https://github.com/ubiquibot/comment-incentives/issues/22";

describe("GetActivity class", () => {
  const issue = parseGitHubUrl(issueUrl);
  const activity = new GetActivity(issue);

  beforeAll(async () => await activity.init());
  it("should resolve all promises", async () => {
    expect(activity.self).toBeTruthy();
    expect(activity.events).toBeTruthy();
    expect(activity.comments).toBeTruthy();
    expect(Array.isArray(activity.linkedReviews)).toBeTruthy();
    const processor = new Processor();
    processor.add(new UserExtractorTransformer()).add(new DataPurgeTransformer()).add(new ContentEvaluatorTransformer());
    processor.run(activity);
    processor.dump();
  });

  it("should create an instance of GetActivity", () => {
    expect(activity).toBeInstanceOf(GetActivity);
  });

  it("should initialize `activity.self` as an object", () => {
    expect(typeof activity.self).toBe("object");
  });

  it("should initialize `activity.events` as an object", () => {
    expect(typeof activity.events).toBe("object");
  });

  it("should initialize `activity.comments` as an object", () => {
    expect(typeof activity.comments).toBe("object");
  });

  it("should initialize `activity.linkedReviews` as an array", () => {
    expect(Array.isArray(activity.linkedReviews)).toBe(true);
  });
});
