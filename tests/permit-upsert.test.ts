import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ContextPlugin } from "../src/types/plugin-input";

const mockRpc = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn(() => ({
  insert: mockInsert,
}));

jest.unstable_mockModule("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

jest.unstable_mockModule("@actions/github", () => ({
  context: {
    payload: {
      repository: {
        owner: { id: 1 },
        name: "repo",
      },
    },
  },
}));

const { PaymentModule } = await import("../src/parser/payment-module");

const makeContext = () =>
  ({
    config: { incentives: { payment: null } },
    env: {
      SUPABASE_URL: "http://supabase.local",
      SUPABASE_KEY: "supabase-key",
    },
    logger: {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    },
    adapters: {},
  }) as unknown as ContextPlugin;

const baseInsertData = {
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
  _upsertPermitRecord: (data: typeof baseInsertData) => Promise<boolean>;
};

describe("PaymentModule _upsertPermitRecord", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockInsert.mockReset();
    mockFrom.mockClear();
    mockRpc.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("returns true when RPC succeeds", async () => {
    const paymentModule = new PaymentModule(makeContext());
    const result = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(result).toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("falls back to insert when RPC is missing", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    const paymentModule = new PaymentModule(makeContext());
    const result = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(result).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns false when RPC fails for other errors", async () => {
    mockRpc.mockResolvedValue({ error: { message: "permission denied", code: "42501" } });
    const paymentModule = new PaymentModule(makeContext());
    const result = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(result).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns false when insert fails after RPC fallback", async () => {
    mockRpc.mockResolvedValue({ error: { message: "function upsert_permit_max does not exist", code: "42883" } });
    mockInsert.mockResolvedValue({ error: "insert failed" });
    const paymentModule = new PaymentModule(makeContext());
    const result = await (paymentModule as unknown as UpsertModule)._upsertPermitRecord(baseInsertData);
    expect(result).toBe(false);
  });
});
