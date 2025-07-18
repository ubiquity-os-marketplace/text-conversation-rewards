/*
 ** Import this file in your tests if you want to mock permits generation
 */
import type { Context } from "@ubiquity-os/permit-generation";
import * as permitGeneration from "@ubiquity-os/permit-generation";
import { mock } from "bun:test";
import { db as mockDb } from "../__mocks__/db";
import { customEncodePermits, generatePermitUrlPayload } from "../__mocks__/local-permits";

mock.module("@ubiquity-os/permit-generation", async () => {
  return {
    __esModule: true,
    ...permitGeneration,
    generatePayoutPermit: (
      context: Context,
      permitRequests: {
        type: string;
        username: string;
        amount: number;
        tokenAddress: string;
      }[]
    ) => generatePermitUrlPayload(context, permitRequests),
    encodePermits: (obj: object) => customEncodePermits(obj),
    createAdapters: mock(() => {
      return {
        supabase: {
          wallet: {
            getWalletByUserId: mock((userId: number) => {
              const wallet = mockDb.wallets.findFirst({
                where: {
                  userId: {
                    equals: userId,
                  },
                },
              });
              if (!wallet) {
                return Promise.resolve(`[mock] Could not find wallet for user ${userId}`);
              }
              return Promise.resolve(wallet.address);
            }),
          },
        },
      };
    }),
  };
});
