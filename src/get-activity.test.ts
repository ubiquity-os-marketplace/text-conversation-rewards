import { GetActivity } from "./get-activity";
import { ContentEvaluatorTransformer } from "./parser/content-evaluator-transformer";
import { DataPurgeTransformer } from "./parser/data-purge-transformer";
import { FormattingEvaluatorTransformer } from "./parser/formatting-evaluator-transformer";
import { Processor } from "./parser/processor";
import { UserExtractorTransformer } from "./parser/user-extractor-transformer";
import { parseGitHubUrl } from "./start";

// Mock process.argv
const issueUrl = process.env.TEST_ISSUE_URL || "https://github.com/ubiquibot/comment-incentives/issues/22";

describe("GetActivity class", () => {
  const issue = parseGitHubUrl(issueUrl);
  const activity = new GetActivity(issue);
  beforeAll(async () => {
    await activity.init();
  });

  it("should resolve all promises", async () => {
    expect(activity.self).toBeTruthy();
    expect(activity.events).toBeTruthy();
    expect(activity.comments).toBeTruthy();
    expect(Array.isArray(activity.linkedReviews)).toBeTruthy();
    const processor = new Processor();
    processor
      .add(new UserExtractorTransformer())
      .add(new DataPurgeTransformer())
      .add(new FormattingEvaluatorTransformer())
      .add(new ContentEvaluatorTransformer());
    await processor.run(activity);
    processor.dump();
    // TODO: the data purge should add more details about the comment
    // a GithubComment module could be added
    // an event action module should be applied
  });

  // it("should create an instance of GetActivity", () => {
  //   expect(activity).toBeInstanceOf(GetActivity);
  // });
  //
  // it("should initialize `activity.self` as an object", () => {
  //   expect(typeof activity.self).toBe("object");
  // });
  //
  // it("should initialize `activity.events` as an object", () => {
  //   expect(typeof activity.events).toBe("object");
  // });
  //
  // it("should initialize `activity.comments` as an object", () => {
  //   expect(typeof activity.comments).toBe("object");
  // });
  //
  // it("should initialize `activity.linkedReviews` as an array", () => {
  //   expect(Array.isArray(activity.linkedReviews)).toBe(true);
  // });
});
