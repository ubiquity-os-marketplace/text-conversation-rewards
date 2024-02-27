import { config } from "dotenv";
import { GetActivity } from "./get-activity";
import { parseGitHubUrl } from "./start";

config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.warn("GITHUB_TOKEN is not set");
}
// Mock process.argv
process.argv = ["path/to/node", "path/to/script", `--auth=${GITHUB_TOKEN}`];

describe("GetActivity class", () => {
  const issue22 = parseGitHubUrl("https://github.com/ubiquibot/comment-incentives/issues/22");
  const activity = new GetActivity(issue22);
  beforeAll(async () => await activity.init());

  it("should resolve all promises", async () => {
    await activity.init();

    expect(activity.self).toBeTruthy();
    expect(activity.events).toBeTruthy();
    expect(activity.comments).toBeTruthy();
    expect(Array.isArray(activity.linkedReviews)).toBeTruthy();
    console.dir(activity.linkedReviews, { depth: 4, colors: true });
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
