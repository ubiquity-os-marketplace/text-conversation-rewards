import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Database } from "../src/adapters/supabase/types/database";
import { CommentAssociation, CommentKind } from "../src/configuration/comment-types";
import type { ContextPlugin } from "../src/types/plugin-input";
import type { Result } from "../src/types/results";

type RpcResponse = { error: { message?: string; code?: string } | null };
type InsertResponse = { error: unknown };
type MaybeSingleResponse = {
  data: { id: number; amount: string; transaction: string | null } | null;
  error: unknown;
};
type UpdateResponse = { data: Array<{ id: number }> | null; error: unknown };

const mockRpc = jest.fn<() => Promise<RpcResponse>>();
const mockInsert = jest.fn<() => Promise<InsertResponse>>();
const mockUpsert = jest.fn<() => Promise<InsertResponse>>();
const mockMaybeSingle = jest.fn<() => Promise<MaybeSingleResponse>>();
const mockSelect = jest.fn();
const selectBuilder = {
  eq: jest.fn(),
  maybeSingle: mockMaybeSingle,
};
selectBuilder.eq.mockImplementation(() => selectBuilder);
const updateResult: UpdateResponse = { data: [{ id: 123 }], error: null };
const updateBuilder = {
  eq: jest.fn(),
  is: jest.fn(),
  select: jest.fn(),
  then: (resolve: (value: UpdateResponse) => void) => resolve(updateResult),
};
updateBuilder.eq.mockImplementation(() => updateBuilder);
updateBuilder.is.mockImplementation(() => updateBuilder);
updateBuilder.select.mockImplementation(() => updateBuilder);
const mockUpdate = jest.fn(() => updateBuilder);
mockSelect.mockImplementation(() => selectBuilder);
const mockFrom = jest.fn(() => ({
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
  upsert: mockUpsert,
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

jest.mock("@actions/github", () => ({
  context: {
    payload: {
      repository: {
        owner: { id: 1 },
        name: "repo",
      },
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/naming-convention
let PaymentModule: typeof import("../src/parser/payment-module").PaymentModule;

beforeAll(async () => {
  PaymentModule = (await import("../src/parser/payment-module")).PaymentModule;
});

function makeContext(): ContextPlugin {
  return {
    config: { incentives: { payment: null } },
    env: {
      SUPABASE_URL: "https://supabase.local",
      SUPABASE_KEY: "supabase-key",
    },
    logger: {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    },
    adapters: {},
  } as unknown as ContextPlugin;
}

const baseInsertData: Database["public"]["Tables"]["permits"]["Insert"] = {
  amount: "1",
  nonce: "1",
  deadline: "1",
  signature: "0xsignature",
  beneficiary_id: 1,
  location_id: 1,
  token_id: 1,
  partner_id: 1,
  network_id: 1,
  permit2_address: "0xpermit2",
};

type UpsertModule = {
  _upsertPermitRecord: (data: Database["public"]["Tables"]["permits"]["Insert"]) => Promise<boolean>;
  _applyPositiveRewardDifferences: (previousRewards: unknown, result: Result) => void;
  _getPreviousRewardSummary: (data: { comments: unknown[] }) => unknown;
};

describe("PaymentModule _upsertPermitRecord", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockInsert.mockReset();
    mockUpsert.mockReset();
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockMaybeSingle.mockReset();
    mockUpdate.mockClear();
    updateResult.error = null;
    updateResult.data = [{ id: 123 }];
    selectBuilder.eq.mockClear();
    updateBuilder.eq.mockClear();
    updateBuilder.is.mockClear();
    updateBuilder.select.mockClear();
    mockRpc.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockUpsert.mockResolvedValue({ error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("returns true when RPC succeeds", async () => {
    const paymentModule = new PaymentModule(makeContext());
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(didUpsert).toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpcName, rpcArgs] = mockRpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(rpcName).toBe("upsert_permit_max");
    expect(rpcArgs).toEqual({
      p_amount: baseInsertData.amount,
      p_nonce: baseInsertData.nonce,
      p_deadline: baseInsertData.deadline,
      p_signature: baseInsertData.signature,
      p_beneficiary_id: baseInsertData.beneficiary_id,
      p_location_id: baseInsertData.location_id,
      p_token_id: baseInsertData.token_id,
      p_partner_id: baseInsertData.partner_id,
      p_network_id: baseInsertData.network_id,
      p_permit2_address: baseInsertData.permit2_address,
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("falls back to insert when RPC is missing", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(didUpsert).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("falls back to insert when RPC is missing in schema cache", async () => {
    mockRpc.mockResolvedValue({
      error: {
        message: "Could not find the function public.upsert_permit_max in the schema cache",
        code: "PGRST202",
      },
    });
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(didUpsert).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("falls back to insert when RPC permission is denied", async () => {
    mockRpc.mockResolvedValue({
      error: { message: "permission denied for function upsert_permit_max", code: "42501" },
    });
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(didUpsert).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns false when RPC fails for other errors", async () => {
    mockRpc.mockResolvedValue({ error: { message: "data too long", code: "22001" } });
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(didUpsert).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns false when insert fails after RPC fallback", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    mockInsert.mockResolvedValue({ error: { message: "insert failed", code: "XX000" } });
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(didUpsert).toBe(false);
  });

  it("updates existing unclaimed permit when incoming amount is higher", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    mockInsert.mockResolvedValue({
      error: {
        message: "duplicate key value violates unique constraint",
        code: "23505",
      },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 123,
        amount: "1",
        transaction: null,
      },
      error: null,
    });
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord({
      ...baseInsertData,
      amount: "2",
    });
    expect(didUpsert).toBe(true);
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(context.logger.info).toHaveBeenCalledWith(
      "Updated existing permit after RPC fallback",
      expect.objectContaining({
        id: 123,
        nonce: baseInsertData.nonce,
        beneficiary_id: baseInsertData.beneficiary_id,
      })
    );
  });

  it("returns false when existing permit lookup fails after unique violation", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    mockInsert.mockResolvedValue({
      error: {
        message: "duplicate key value violates unique constraint",
        code: "23505",
      },
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: "select failed" });
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(didUpsert).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns false when existing permit is missing after unique violation", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    mockInsert.mockResolvedValue({
      error: {
        message: "duplicate key value violates unique constraint",
        code: "23505",
      },
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(didUpsert).toBe(false);
  });

  it("returns false when amount comparison fails after unique violation", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    mockInsert.mockResolvedValue({
      error: {
        message: "duplicate key value violates unique constraint",
        code: "23505",
      },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 123,
        amount: "not-a-number",
        transaction: null,
      },
      error: null,
    });
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord({
      ...baseInsertData,
      amount: "2",
    });
    expect(didUpsert).toBe(false);
  });

  it("returns false when update fails after RPC fallback", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    mockInsert.mockResolvedValue({
      error: {
        message: "duplicate key value violates unique constraint",
        code: "23505",
      },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 123,
        amount: "1",
        transaction: null,
      },
      error: null,
    });
    updateResult.error = "update failed";
    updateResult.data = null;
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord({
      ...baseInsertData,
      amount: "2",
    });
    expect(didUpsert).toBe(false);
  });

  it("skips update when permit changes concurrently after RPC fallback", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    mockInsert.mockResolvedValue({
      error: {
        message: "duplicate key value violates unique constraint",
        code: "23505",
      },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 123,
        amount: "1",
        transaction: null,
      },
      error: null,
    });
    updateResult.data = [];
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord({
      ...baseInsertData,
      amount: "2",
    });
    expect(didUpsert).toBe(true);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(context.logger.info).toHaveBeenCalledWith(
      "Skipped updating permit after RPC fallback; permit changed concurrently",
      expect.objectContaining({
        id: 123,
        nonce: baseInsertData.nonce,
        beneficiary_id: baseInsertData.beneficiary_id,
      })
    );
  });

  it("keeps claimed permits when fallback hits a duplicate", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    mockInsert.mockResolvedValue({
      error: {
        message: "duplicate key value violates unique constraint",
        code: "23505",
      },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 456,
        amount: "1",
        transaction: "0xclaimed",
      },
      error: null,
    });
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(didUpsert).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(context.logger.info).toHaveBeenCalledWith(
      "Permit already claimed; keeping existing record after RPC fallback",
      expect.objectContaining({
        id: 456,
        nonce: baseInsertData.nonce,
        beneficiary_id: baseInsertData.beneficiary_id,
      })
    );
  });

  it("keeps existing permit when incoming amount is lower or equal", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    mockInsert.mockResolvedValue({
      error: {
        message: "duplicate key value violates unique constraint",
        code: "23505",
      },
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 789,
        amount: "5",
        transaction: null,
      },
      error: null,
    });
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord({
      ...baseInsertData,
      amount: "2",
    });
    expect(didUpsert).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(context.logger.info).toHaveBeenCalledWith(
      "Existing permit amount is higher or equal; keeping existing record",
      expect.objectContaining({
        id: 789,
        nonce: baseInsertData.nonce,
        beneficiary_id: baseInsertData.beneficiary_id,
      })
    );
  });

  it("returns false when network metadata is missing", async () => {
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord({
      ...baseInsertData,
      network_id: null,
    });
    expect(didUpsert).toBe(false);
  });

  it("returns false when permit2 metadata is missing", async () => {
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord({
      ...baseInsertData,
      permit2_address: null,
    });
    expect(didUpsert).toBe(false);
  });

  it("keeps only positive reward differences from previous bot reward comments", async () => {
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const result: Result = {
      alice: {
        total: 15,
        userId: 1,
        task: {
          reward: 10,
          multiplier: 1,
          timestamp: "2026-05-25T00:00:00.000Z",
          url: "https://github.com/org/repo/issues/1",
        },
        comments: [
          {
            id: 1,
            content: "extra review",
            url: "https://github.com/org/repo/issues/1#issuecomment-1",
            timestamp: "2026-05-25T00:00:00.000Z",
            commentType: CommentKind.ISSUE | CommentAssociation.COLLABORATOR,
            score: {
              multiplier: 1,
              reward: 5,
              authorship: 1,
            },
          },
        ],
      },
      bob: {
        total: 8,
        userId: 2,
      },
      carol: {
        total: 4,
        userId: 3,
      },
    };

    const previousRewards = (paymentModule as unknown as UpsertModule)._getPreviousRewardSummary({
      comments: [
        {
          user: { type: "Bot" },
          body: `<!-- Ubiquity - GithubCommentModule - GithubCommentModule.getBodyContent - sha
{
  "workflowUrl": "https://github.com/org/repo/actions/runs/1",
  "output": {
    "alice": {
      "total": 10,
      "userId": 1,
      "payoutMode": "transfer"
    },
    "bob": {
      "total": 8,
      "userId": 2,
      "payoutMode": "transfer"
    }
  }
}
-->`,
        },
      ],
    });

    (paymentModule as unknown as UpsertModule)._applyPositiveRewardDifferences(previousRewards, result);

    expect(result.alice.total).toBe(5);
    expect(result.alice.task?.reward).toBe(3.33);
    expect(result.alice.comments?.[0].score?.reward).toBe(1.67);
    expect(result.bob).toBeUndefined();
    expect(result.carol.total).toBe(4);
  });

  it("returns false when partner metadata is missing", async () => {
    const context = makeContext();
    const paymentModule = new PaymentModule(context);
    const didUpsert = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord({
      ...baseInsertData,
      partner_id: null,
    });
    expect(didUpsert).toBe(false);
  });
});
