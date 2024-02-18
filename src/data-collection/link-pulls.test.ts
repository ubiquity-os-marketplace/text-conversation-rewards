import linkPulls from "./link-pulls";

describe("linkPulls", () => {
  it("should return null if there is no link event on the issue", async () => {
    const issue = {
      /* mock issue object */
    };
    const result = await linkPulls(issue);
    expect(result).toBeNull();
  });

  it("should find the linked pull request in the current repository", async () => {
    const issue = {
      /* mock issue object with a link event */
    };
    const result = await linkPulls(issue);
    expect(result).toEqual(/* expected linked pull request */);
  });

  it("should search across other repositories if linked pull request is not found in the current repository", async () => {
    const issue = {
      /* mock issue object with a link event */
    };
    const result = await linkPulls(issue);
    expect(result).toEqual(/* expected linked pull request from other repositories */);
  });
});
