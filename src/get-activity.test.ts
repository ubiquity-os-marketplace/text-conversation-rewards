import { GetActivity } from "./get-activity";
import { parseGitHubUrl } from "./start";
import { config } from "dotenv";

config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.warn("GITHUB_TOKEN is not set");
}
// Mock process.argv
process.argv = ["path/to/node", "path/to/script", `--auth=${GITHUB_TOKEN}`];

describe("GetActivity class", () => {
  let activity: GetActivity;

  beforeAll(async () => {
    const issue22 = parseGitHubUrl("https://github.com/ubiquibot/comment-incentives/issues/22");
    activity = new GetActivity(issue22);
    // Wait for all promises to resolve
    await Promise.all([activity.self, activity.events, activity.comments, activity.linkedReviews]);
    console.dir(activity, { depth: null, colors: true });
  });

  it("should create an instance of GetActivity", () => {
    expect(activity).toBeInstanceOf(GetActivity);
  });

  it("should initialize self as an object", () => {
    expect(typeof activity.self).toBe("object");
  });

  it("should initialize events as an object", () => {
    expect(typeof activity.events).toBe("object");
  });

  it("should initialize comments as an object", () => {
    expect(typeof activity.comments).toBe("object");
  });

  it("should initialize linkedReviews as an array", () => {
    expect(Array.isArray(activity.linkedReviews)).toBe(true);
  });
});
