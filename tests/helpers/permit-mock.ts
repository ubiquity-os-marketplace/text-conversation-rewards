/*
 ** Import this file in your tests if you want to mock permits generation
 */
import { jest } from "@jest/globals";
import { ContextPlugin } from "../../src/types/plugin-input";
import { customEncodePermits, generatePermitUrlPayload } from "../__mocks__/local-permits";
import { db as mockDb } from "../__mocks__/db";

jest.unstable_mockModule("@ubiquity-os/permit-generation", () => {
  const originalModule: object = jest.requireActual("@ubiquity-os/permit-generation");

  return {
    __esModule: true,
    ...originalModule,
    generatePayoutPermit: (
      context: ContextPlugin,
      permitRequests: {
        type: string;
        username: string;
        amount: number;
        tokenAddress: string;
      }[]
    ) => generatePermitUrlPayload(context, permitRequests),
    encodePermits: (obj: object) => customEncodePermits(obj),
    createAdapters: jest.fn(() => {
      return {
        supabase: {
          wallet: {
            getWalletByUserId: jest.fn((userId: number) => {
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
