import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { IssueActivity } from "../../src/issue-activity";
import { ContextPlugin } from "../../src/types/plugin-input";
import { Result } from "../../src/types/results";

// eslint-disable-next-line @typescript-eslint/naming-convention
let PaymentModule: typeof import("../../src/parser/payment-module").PaymentModule;

const DEFAULT_TIMESTAMP = "2024-01-01T00:00:00.000Z";
const DEFAULT_URL = "https://example.test/issues/1";

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

const mockContext = {
  config: {
    incentives: {
      payment: null,
    },
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ok: jest.fn(),
  },
  env: {},
} as unknown as ContextPlugin;

beforeAll(async () => {
  ({ PaymentModule } = await import("../../src/parser/payment-module"));
});

function makeResult(users: { [k: string]: { total: number; taskReward?: number; userId: number } }): Result {
  const result: Result = {};
  for (const [username, data] of Object.entries(users)) {
    result[username] = {
      total: data.total,
      userId: data.userId,
      task: data.taskReward
        ? {
            reward: data.taskReward,
            multiplier: 1,
            timestamp: DEFAULT_TIMESTAMP,
            url: DEFAULT_URL,
          }
        : undefined,
    };
  }
  return result;
}

describe("Differential Reward Distribution", () => {
  let paymentModule: InstanceType<typeof PaymentModule>;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentModule = new PaymentModule(mockContext);
  });

  describe("_extractPreviousRewards", () => {
    it("should extract previous rewards from bot comment metadata", () => {
      const metadata = `<!-- Ubiquity - GithubCommentModule - someCaller - abc123
{
  "workflowUrl": "https://github.com/test",
  "output": {
    "user1": {
      "total": 100,
      "payoutMode": "transfer",
      "userId": 1
    },
    "user2": {
      "total": 50,
      "payoutMode": "transfer",
      "userId": 2
    }
  }
}
-->`;
      const data = {
        comments: [
          {
            body: metadata,
            user: { type: "Bot" as const },
          },
        ],
      } as unknown as IssueActivity;

      const result = paymentModule._extractPreviousRewards(data);
      expect(result).toEqual({
        user1: { total: 100, payoutMode: "transfer" },
        user2: { total: 50, payoutMode: "transfer" },
      });
    });

    it("should return empty object when no bot comments exist", () => {
      const data = {
        comments: [
          {
            body: "Regular user comment",
            user: { type: "User" as const },
          },
        ],
      } as unknown as IssueActivity;

      const result = paymentModule._extractPreviousRewards(data);
      expect(result).toEqual({});
    });

    it("should return empty object when bot comment has no metadata", () => {
      const data = {
        comments: [
          {
            body: "Bot comment without metadata",
            user: { type: "Bot" as const },
          },
        ],
      } as unknown as IssueActivity;

      const result = paymentModule._extractPreviousRewards(data);
      expect(result).toEqual({});
    });

    it("should handle multiple bot comments and use the latest data", () => {
      const comment1 = `<!-- Ubiquity - GithubCommentModule - caller - abc
{
  "workflowUrl": "https://github.com/test",
  "output": {
    "user1": { "total": 80, "payoutMode": "permit", "userId": 1 }
  }
}
-->`;
      const comment2 = `<!-- Ubiquity - GithubCommentModule - caller - def
{
  "workflowUrl": "https://github.com/test",
  "output": {
    "user1": { "total": 100, "payoutMode": "transfer", "userId": 1 }
  }
}
-->`;
      const data = {
        comments: [
          { body: comment1, user: { type: "Bot" as const } },
          { body: comment2, user: { type: "Bot" as const } },
        ],
      } as unknown as IssueActivity;

      const result = paymentModule._extractPreviousRewards(data);
      // Last comment wins
      expect(result.user1).toEqual({ total: 100, payoutMode: "transfer" });
    });

    it("should default payoutMode to permit when not specified", () => {
      const metadata = `<!-- Ubiquity - GithubCommentModule - caller - abc
{
  "output": {
    "user1": { "total": 50, "userId": 1 }
  }
}
-->`;
      const data = {
        comments: [{ body: metadata, user: { type: "Bot" as const } }],
      } as unknown as IssueActivity;

      const result = paymentModule._extractPreviousRewards(data);
      expect(result.user1).toEqual({ total: 50, payoutMode: "permit" });
    });
  });

  describe("_computeDifferential", () => {
    it("should include full amount for new beneficiaries", () => {
      const result = makeResult({ user1: { total: 100, userId: 1 } });
      const previousRewards: Record<string, { total: number; payoutMode: "transfer" | "permit" }> = {};

      const differential = paymentModule._computeDifferential(result, previousRewards);
      expect(differential.user1.total).toBe(100);
    });

    it("should compute positive difference for existing beneficiaries", () => {
      const result = makeResult({ user1: { total: 150, userId: 1 } });
      const previousRewards = { user1: { total: 100, payoutMode: "transfer" as const } };

      const differential = paymentModule._computeDifferential(result, previousRewards);
      expect(differential.user1.total).toBe(50);
    });

    it("should exclude beneficiaries with no change", () => {
      const result = makeResult({ user1: { total: 100, userId: 1 } });
      const previousRewards = { user1: { total: 100, payoutMode: "transfer" as const } };

      const differential = paymentModule._computeDifferential(result, previousRewards);
      expect(differential.user1).toBeUndefined();
    });

    it("should exclude beneficiaries with decreased reward", () => {
      const result = makeResult({ user1: { total: 80, userId: 1 } });
      const previousRewards = { user1: { total: 100, payoutMode: "transfer" as const } };

      const differential = paymentModule._computeDifferential(result, previousRewards);
      expect(differential.user1).toBeUndefined();
    });

    it("should handle mixed scenario: new, increased, decreased, unchanged", () => {
      const result = makeResult({
        user1: { total: 150, userId: 1 }, // +50
        user2: { total: 50, userId: 2 }, // unchanged
        user3: { total: 25, userId: 3 }, // new
        user4: { total: 30, userId: 4 }, // decreased from 50
      });
      const previousRewards = {
        user1: { total: 100, payoutMode: "transfer" as const },
        user2: { total: 50, payoutMode: "transfer" as const },
        user4: { total: 50, payoutMode: "transfer" as const },
      };

      const differential = paymentModule._computeDifferential(result, previousRewards);
      expect(differential.user1.total).toBe(50);
      expect(differential.user2).toBeUndefined();
      expect(differential.user3.total).toBe(25);
      expect(differential.user4).toBeUndefined();
    });

    it("should cap task reward at the difference amount", () => {
      const result = makeResult({ user1: { total: 150, taskReward: 100, userId: 1 } });
      const previousRewards = { user1: { total: 100, payoutMode: "transfer" as const } };

      const differential = paymentModule._computeDifferential(result, previousRewards);
      expect(differential.user1.total).toBe(50);
      expect(differential.user1.task?.reward).toBe(50); // capped at difference
    });

    it("should keep task reward if less than difference", () => {
      const result = makeResult({ user1: { total: 150, taskReward: 30, userId: 1 } });
      const previousRewards = { user1: { total: 100, payoutMode: "transfer" as const } };

      const differential = paymentModule._computeDifferential(result, previousRewards);
      expect(differential.user1.total).toBe(50);
      expect(differential.user1.task?.reward).toBe(30); // kept as-is since < difference
    });
  });
});
