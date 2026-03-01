/**
 * Tests for Differential Reward Distribution
 * 
 * Issue: https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/301
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { DifferentialDistribution, DifferentialResult } from "../../src/parser/differential-distribution";
import { Result } from "../../src/types/results";
import { IssueActivity } from "../../src/issue-activity";
import { ContextPlugin } from "../../src/types/plugin-input";

// Mock Supabase client
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn()
  }))
}));

describe("DifferentialDistribution", () => {
  let mockContext: ContextPlugin;
  let mockSupabaseRpc: jest.Mock;
  let distributor: DifferentialDistribution;

  beforeEach(() => {
    mockSupabaseRpc = jest.fn();
    
    mockContext = {
      env: {
        SUPABASE_URL: "https://test.supabase.co",
        SUPABASE_KEY: "test-key"
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        ok: jest.fn()
      }
    } as unknown as ContextPlugin;

    const { createClient } = require("@supabase/supabase-js");
    createClient.mockReturnValue({
      rpc: mockSupabaseRpc
    });

    distributor = new DifferentialDistribution(mockContext);
  });

  describe("calculateDifferentials", () => {
    it("should calculate positive difference for increased rewards", async () => {
      // Mock previous distribution: user1 received 100
      mockSupabaseRpc.mockResolvedValueOnce({ data: 100, error: null });

      const mockData = {
        self: {
          number: 123,
          html_url: "https://github.com/test/repo/issues/123"
        }
      } as unknown as IssueActivity;

      const mockResult: Result = {
        user1: {
          total: 150, // New amount is 150
          userId: 1
        }
      };

      const differentials = await distributor.calculateDifferentials(mockData, mockResult);

      expect(differentials).toHaveLength(1);
      expect(differentials[0]).toEqual({
        username: "user1",
        previousTotal: 100,
        newAmount: 150,
        difference: 50,
        shouldPay: true
      });
    });

    it("should mark shouldPay=false for no difference", async () => {
      // Mock previous distribution: user1 received 100
      mockSupabaseRpc.mockResolvedValueOnce({ data: 100, error: null });

      const mockData = {
        self: {
          number: 123
        }
      } as unknown as IssueActivity;

      const mockResult: Result = {
        user1: {
          total: 100, // Same as before
          userId: 1
        }
      };

      const differentials = await distributor.calculateDifferentials(mockData, mockResult);

      expect(differentials[0].shouldPay).toBe(false);
      expect(differentials[0].difference).toBe(0);
    });

    it("should mark shouldPay=false for decreased rewards", async () => {
      // Mock previous distribution: user1 received 100
      mockSupabaseRpc.mockResolvedValueOnce({ data: 100, error: null });

      const mockData = {
        self: {
          number: 123
        }
      } as unknown as IssueActivity;

      const mockResult: Result = {
        user1: {
          total: 80, // Less than before
          userId: 1
        }
      };

      const differentials = await distributor.calculateDifferentials(mockData, mockResult);

      expect(differentials[0].shouldPay).toBe(false);
      expect(differentials[0].difference).toBe(-20);
    });

    it("should handle multiple beneficiaries", async () => {
      // Mock previous distributions
      mockSupabaseRpc
        .mockResolvedValueOnce({ data: 100, error: null }) // user1
        .mockResolvedValueOnce({ data: 50, error: null })   // user2
        .mockResolvedValueOnce({ data: 0, error: null });   // user3 (no previous)

      const mockData = {
        self: {
          number: 123
        }
      } as unknown as IssueActivity;

      const mockResult: Result = {
        user1: { total: 150, userId: 1 }, // +50
        user2: { total: 50, userId: 2 },  // 0
        user3: { total: 25, userId: 3 }   // +25 (no previous)
      };

      const differentials = await distributor.calculateDifferentials(mockData, mockResult);

      expect(differentials).toHaveLength(3);
      expect(differentials.find(d => d.username === "user1")?.shouldPay).toBe(true);
      expect(differentials.find(d => d.username === "user2")?.shouldPay).toBe(false);
      expect(differentials.find(d => d.username === "user3")?.shouldPay).toBe(true);
    });

    it("should return 0 for no previous distribution", async () => {
      // Mock no previous distribution
      mockSupabaseRpc.mockResolvedValueOnce({ data: 0, error: null });

      const mockData = {
        self: {
          number: 123
        }
      } as unknown as IssueActivity;

      const mockResult: Result = {
        user1: {
          total: 100,
          userId: 1
        }
      };

      const differentials = await distributor.calculateDifferentials(mockData, mockResult);

      expect(differentials[0].previousTotal).toBe(0);
      expect(differentials[0].difference).toBe(100);
      expect(differentials[0].shouldPay).toBe(true);
    });
  });

  describe("filterPositiveDifferences", () => {
    it("should filter out beneficiaries with no positive difference", async () => {
      // Mock previous distributions
      mockSupabaseRpc
        .mockResolvedValueOnce({ data: 100, error: null }) // user1
        .mockResolvedValueOnce({ data: 50, error: null })   // user2
        .mockResolvedValueOnce({ data: 0, error: null });   // user3

      const mockData = {
        self: {
          number: 123
        }
      } as unknown as IssueActivity;

      const mockResult: Result = {
        user1: { total: 150, userId: 1 }, // +50
        user2: { total: 50, userId: 2 },  // 0
        user3: { total: 25, userId: 3 }   // +25
      };

      const filtered = await distributor.filterPositiveDifferences(mockData, mockResult);

      expect(Object.keys(filtered)).toHaveLength(2);
      expect(filtered.user1).toBeDefined();
      expect(filtered.user2).toBeUndefined(); // Filtered out
      expect(filtered.user3).toBeDefined();
      
      // Verify the total is updated to the difference
      expect(filtered.user1?.total).toBe(50);
      expect(filtered.user3?.total).toBe(25);
    });

    it("should include metadata about differential calculation", async () => {
      mockSupabaseRpc.mockResolvedValueOnce({ data: 100, error: null });

      const mockData = {
        self: {
          number: 123
        }
      } as unknown as IssueActivity;

      const mockResult: Result = {
        user1: { total: 150, userId: 1 }
      };

      const filtered = await distributor.filterPositiveDifferences(mockData, mockResult);

      expect(filtered.user1?.metadata).toEqual({
        previousTotal: 100,
        newAmount: 150,
        difference: 50,
        distributionRound: expect.any(Number)
      });
    });
  });

  describe("recordDistribution", () => {
    it("should record distribution successfully", async () => {
      mockSupabaseRpc.mockResolvedValueOnce({
        data: {
          success: true,
          distribution_round: 2
        },
        error: null
      });

      const result = await distributor.recordDistribution(
        123, // issueId
        456, // locationId
        789, // beneficiaryId
        50,  // amount
        'transfer',
        '0x123abc', // transactionHash
        1    // permitId
      );

      expect(result.success).toBe(true);
      expect(result.distributionRound).toBe(2);
      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        'insert_distribution',
        expect.objectContaining({
          p_issue_id: 123,
          p_beneficiary_id: 789,
          p_new_amount: 50,
          p_payout_mode: 'transfer'
        })
      );
    });

    it("should handle RPC error gracefully", async () => {
      mockSupabaseRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" }
      });

      const result = await distributor.recordDistribution(
        123, 456, 789, 50, 'permit'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("generateDistributionComment", () => {
    it("should generate formatted GitHub comment", () => {
      const differentials: DifferentialResult[] = [
        {
          username: "user1",
          previousTotal: 100,
          newAmount: 150,
          difference: 50,
          shouldPay: true
        },
        {
          username: "user2",
          previousTotal: 50,
          newAmount: 50,
          difference: 0,
          shouldPay: false
        },
        {
          username: "user3",
          previousTotal: 0,
          newAmount: 25,
          difference: 25,
          shouldPay: true
        }
      ];

      const comment = distributor.generateDistributionComment(differentials, 'transfer');

      expect(comment).toContain("## 💰 Differential Reward Distribution");
      expect(comment).toContain("| user1 | 100.00 | 150.00 | **50.00** | ✅ +50.00 |");
      expect(comment).toContain("| user2 | 50.00 | 50.00 | **0.00** | ⏭️ No change |");
      expect(comment).toContain("| user3 | 0.00 | 25.00 | **25.00** | ✅ +25.00 |");
      expect(comment).toContain("**Total Distribution**: 75.00 tokens");
      expect(comment).toContain("**Payout Mode**: transfer");
      expect(comment).toContain("How differential distribution works");
    });
  });
});
