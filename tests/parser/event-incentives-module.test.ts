import { EventIncentivesModule } from "../../src/parser/event-incentives-module";
import { EventIncentivesConfiguration } from "../../src/configuration/event-incentives-config";
import { Result } from "../../src/types/results";
import { IssueActivity } from "../../src/issue-activity";
import { ContextPlugin } from "../../src/types/plugin-input";

// Mock context
function createMockContext(config: EventIncentivesConfiguration) {
  return {
    config: {
      incentives: {
        eventIncentives: config,
      },
    },
    logger: {
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      verbose: jest.fn(),
    },
    octokit: {},
    payload: {
      repository: {
        owner: { login: "test-org" },
        name: "test-repo",
      },
    },
  } as unknown as ContextPlugin;
}

// Mock issue activity data
function createMockActivity(issueAuthor: string, assignees: string[] = [], prAuthors: string[] = []) {
  return {
    self: {
      user: { login: issueAuthor },
      assignees: assignees.map((login) => ({ login })),
      html_url: "https://github.com/test-org/test-repo/issues/1",
    },
    linkedMergedPullRequests: prAuthors.map((author) => ({
      self: { user: { login: author } },
    })),
  } as unknown as Readonly<IssueActivity>;
}

describe("EventIncentivesModule", () => {
  describe("_resolveContributorRole", () => {
    it("returns ISSUER for the issue author", () => {
      const config = { events: {} };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);
      const data = createMockActivity("alice");
      const roleCache = new Map();

      const role = module._resolveContributorRole("alice", data, roleCache);
      expect(role).toBe("ISSUER");
    });

    it("returns ASSIGNEE for an assignee", () => {
      const config = { events: {} };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);
      const data = createMockActivity("alice", ["bob"]);
      const roleCache = new Map();

      const role = module._resolveContributorRole("bob", data, roleCache);
      expect(role).toBe("ASSIGNEE");
    });

    it("returns CONTRIBUTOR for unknown users", () => {
      const config = { events: {} };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);
      const data = createMockActivity("alice", ["bob"]);
      const roleCache = new Map();

      const role = module._resolveContributorRole("charlie", data, roleCache);
      expect(role).toBe("CONTRIBUTOR");
    });

    it("uses cached role on subsequent calls", () => {
      const config = { events: {} };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);
      const data = createMockActivity("alice");
      const roleCache = new Map();

      module._resolveContributorRole("alice", data, roleCache);
      const role = module._resolveContributorRole("alice", data, roleCache);
      expect(role).toBe("ISSUER");
      expect(roleCache.size).toBe(1);
    });
  });

  describe("_getRewardForEvent", () => {
    it("returns 0 when no configuration is set", () => {
      const context = createMockContext(null as unknown as EventIncentivesConfiguration);
      const module = new EventIncentivesModule(context);
      // @ts-expect-error - testing with null config
      module["_configuration"] = null;

      const reward = module._getRewardForEvent("issue.labeled", "COLLABORATOR");
      expect(reward).toBe(0);
    });

    it("looks up reward from events shorthand config", () => {
      const config: EventIncentivesConfiguration = {
        events: {
          "issue.labeled": {
            targets: ["COLLABORATOR", "ISSUER"],
            value: 5,
          },
        },
      };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);

      expect(module._getRewardForEvent("issue.labeled", "COLLABORATOR")).toBe(5);
      expect(module._getRewardForEvent("issue.labeled", "ISSUER")).toBe(5);
      expect(module._getRewardForEvent("issue.labeled", "CONTRIBUTOR")).toBe(0);
      expect(module._getRewardForEvent("issue.labeled", "ASSIGNEE")).toBe(0);
    });

    it("returns 0 when role is not in targets", () => {
      const config: EventIncentivesConfiguration = {
        events: {
          "pull_request.commented": {
            targets: ["ASSIGNEE"],
            value: 10,
          },
        },
      };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);

      expect(module._getRewardForEvent("pull_request.commented", "CONTRIBUTOR")).toBe(0);
    });

    it("returns 0 for unknown events", () => {
      const config: EventIncentivesConfiguration = {
        events: {
          "issue.labeled": {
            targets: ["COLLABORATOR"],
            value: 5,
          },
        },
      };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);

      expect(module._getRewardForEvent("issue.commented", "COLLABORATOR")).toBe(0);
    });
  });

  describe("_applyEventRewards", () => {
    it("calculates rewards based on event counts and config", async () => {
      const config: EventIncentivesConfiguration = {
        events: {
          "issue.labeled": {
            targets: ["ISSUER"],
            value: 3,
          },
          "pull_request.commented": {
            targets: ["CONTRIBUTOR"],
            value: 2,
          },
        },
      };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);
      const data = createMockActivity("alice");

      const result: Result = {
        alice: {
          total: 0,
          userId: 1,
          events: {
            "issue.labeled": { count: 2, reward: 0 },
          },
        },
        bob: {
          total: 0,
          userId: 2,
          events: {
            "pull_request.commented": { count: 3, reward: 0 },
          },
        },
      };

      await module._applyEventRewards(data, result);

      // alice is ISSUER, labeled events = 2, reward = 2 * 3 = 6
      expect(result.alice.events!["issue.labeled"].reward).toBe(6);
      expect(result.alice.eventIncentives?.reward).toBe(6);

      // bob is CONTRIBUTOR, commented events = 3, reward = 3 * 2 = 6
      expect(result.bob.events!["pull_request.commented"].reward).toBe(6);
      expect(result.bob.eventIncentives?.reward).toBe(6);
    });

    it("gives no reward when role is not in targets", async () => {
      const config: EventIncentivesConfiguration = {
        events: {
          "issue.labeled": {
            targets: ["COLLABORATOR"],
            value: 5,
          },
        },
      };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);
      const data = createMockActivity("alice"); // alice is ISSUER, not COLLABORATOR

      const result: Result = {
        alice: {
          total: 0,
          userId: 1,
          events: {
            "issue.labeled": { count: 1, reward: 0 },
          },
        },
      };

      await module._applyEventRewards(data, result);

      expect(result.alice.events!["issue.labeled"].reward).toBe(0);
      expect(result.alice.eventIncentives).toBeUndefined();
    });

    it("handles multiple events per user", async () => {
      const config: EventIncentivesConfiguration = {
        events: {
          "issue.labeled": {
            targets: ["ISSUER"],
            value: 2,
          },
          "issue.commented": {
            targets: ["ISSUER"],
            value: 1,
          },
        },
      };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);
      const data = createMockActivity("alice");

      const result: Result = {
        alice: {
          total: 0,
          userId: 1,
          events: {
            "issue.labeled": { count: 3, reward: 0 },
            "issue.commented": { count: 5, reward: 0 },
          },
        },
      };

      await module._applyEventRewards(data, result);

      expect(result.alice.events!["issue.labeled"].reward).toBe(6);
      expect(result.alice.events!["issue.commented"].reward).toBe(5);
      expect(result.alice.eventIncentives?.reward).toBe(11);
    });
  });

  describe("increaseEventCount", () => {
    it("creates new event entry on first occurrence", () => {
      const config = { events: {} };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);

      const result: Result = {
        alice: { total: 0, userId: 1 },
      };

      module.increaseEventCount(result, "alice", "issue.labeled");

      expect(result.alice.events).toEqual({
        "issue.labeled": { count: 1, reward: 0 },
      });
    });

    it("increments existing event count", () => {
      const config = { events: {} };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);

      const result: Result = {
        alice: { total: 0, userId: 1, events: { "issue.labeled": { count: 1, reward: 0 } } },
      };

      module.increaseEventCount(result, "alice", "issue.labeled");

      expect(result.alice.events!["issue.labeled"].count).toBe(2);
    });

    it("skips unknown users", () => {
      const config = { events: {} };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);

      const result: Result = {};

      module.increaseEventCount(result, "unknown", "issue.labeled");

      expect(result["unknown"]).toBeUndefined();
    });
  });

  describe("enabled", () => {
    it("is disabled when config is invalid", () => {
      const context = createMockContext({ invalid: true } as unknown as EventIncentivesConfiguration);
      const module = new EventIncentivesModule(context);

      expect(module.enabled).toBe(false);
    });

    it("is enabled when config is valid empty object", () => {
      const context = createMockContext({});
      const module = new EventIncentivesModule(context);

      expect(module.enabled).toBe(true);
    });

    it("is enabled when config has valid events", () => {
      const config: EventIncentivesConfiguration = {
        events: {
          "issue.labeled": {
            targets: ["COLLABORATOR"],
            value: 5,
          },
        },
      };
      const context = createMockContext(config);
      const module = new EventIncentivesModule(context);

      expect(module.enabled).toBe(true);
    });
  });
});
