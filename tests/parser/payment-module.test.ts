import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { CommentKind } from "../../src/configuration/comment-types";
import { ContextPlugin } from "../../src/types/plugin-input";
import { db } from "../__mocks__/db";
import dbSeed from "../__mocks__/db-seed.json";
import { server } from "../__mocks__/node";
import cfg from "../__mocks__/results/valid-configuration.json";
import { parseUnits } from "ethers/lib/utils";
import { BigNumber } from "ethers";
import { ERC20_ABI, PERMIT2_ABI } from "../../src/helpers/web3";
import { IssueActivity } from "../../src/issue-activity";

const DOLLAR_ADDRESS = "0xb6919Ef2ee4aFC163BC954C5678e2BB570c2D103";
const WXDAI_ADDRESS = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";
const PAYOUT_MODE_TRANSFER = '"payoutMode": "transfer"';
const PAYOUT_MODE_PERMIT = '"payoutMode": "permit"';
const ctx = {
  eventName: "issues.closed",
  payload: {
    issue: {
      html_url: "https://github.com/ubiquity-os/comment-incentives/issues/22",
      number: 1,
      state_reason: "not_planned",
      assignees: [
        {
          id: 1,
          login: "gentlementlegen",
        },
      ],
    },
    repository: {
      name: "conversation-rewards",
      owner: {
        login: "ubiquity-os",
      },
    },
  },
  config: cfg,
  logger: new Logs("debug"),
  octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
  env: {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    X25519_PRIVATE_KEY: process.env.X25519_PRIVATE_KEY,
    // set fee related env variables
    // treasury fee applied to the final permits, ex: 100 = 100%, 0.1 = 0.1%
    PERMIT_FEE_RATE: "10",
    // GitHub account associated with EVM treasury address allowed to claim permit fees, ex: "ubiquity-os-treasury"
    PERMIT_TREASURY_GITHUB_USERNAME: "ubiquity-os-treasury",
    // comma separated list of token addresses which should not incur any fees, ex: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d, 0x4ECaBa5870353805a9F068101A40E0f32ed605C6"
    PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST: `${DOLLAR_ADDRESS}`,
  },
} as unknown as ContextPlugin;

jest.unstable_mockModule("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(),
  };
});

const mockRewardTokenBalance = jest.fn().mockReturnValue(parseUnits("200", 18) as BigNumber);
jest.unstable_mockModule("../../src/helpers/web3", () => {
  class MockErc20Wrapper {
    getBalance = mockRewardTokenBalance;
    getSymbol = jest.fn().mockReturnValue("WXDAI");
    getDecimals = jest.fn().mockReturnValue(18);
    getAllowance = mockRewardTokenBalance;
  }
  class MockPermit2Wrapper {
    generateBatchTransferPermit = jest.fn();
    sendPermitTransferFrom = jest.fn().mockReturnValue({ hash: `0xSent`, wait: async () => Promise.resolve({}) });
    estimatePermitTransferFromGas = jest.fn().mockReturnValue(parseUnits("0.02", 18));
  }
  return {
    PERMIT2_ABI: PERMIT2_ABI,
    ERC20_ABI: ERC20_ABI,
    Erc20Wrapper: MockErc20Wrapper,
    Permit2Wrapper: MockPermit2Wrapper,
    getContract: jest.fn().mockReturnValue({ provider: "dummy" }),
    getEvmWallet: jest.fn(() => ({
      address: "0xAddress",
      getBalance: jest.fn().mockReturnValue(parseUnits("1", 18)),
    })),
  };
});

// original rewards object before fees are applied
function getResultOriginal() {
  return {
    molecula451: {
      total: 100,
      task: {
        reward: 90,
        multiplier: 1,
      },
      userId: 1,
      comments: [
        {
          id: 57,
          content: "comment 3",
          url: "https://github.com/user-org/test-repo/issues/57#issuecomment-2172704421",
          commentType: CommentKind.ISSUE,
          score: {
            reward: 10,
            multiplier: 1,
          },
        },
      ],
    },
    "0x4007": {
      total: 11.11,
      task: {
        reward: 9.99,
        multiplier: 1,
      },
      userId: 2,
      comments: [
        {
          id: 57,
          content: "comment 3",
          url: "https://github.com/user-org/test-repo/issues/57#issuecomment-2172704421",
          commentType: CommentKind.ISSUE,
          score: {
            reward: 1.12,
            multiplier: 1,
          },
        },
      ],
    },
  };
}

jest.unstable_mockModule("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          // eslint-disable-next-line sonarjs/no-nested-functions
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                wallets: { address: "0xAddress" },
              },
            })),
          })),
        })),
      })),
    })),
  };
});

const { PaymentModule } = await import("../../src/parser/payment-module");

beforeAll(() => {
  server.listen();
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PaymentModule.prototype._getNetworkExplorer = async (_networkId: number) => {
    return Promise.resolve("https://rpc");
  };
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("payment-module.ts", () => {
  describe("applyFees()", () => {
    beforeEach(() => {
      ctx.env.PERMIT_FEE_RATE = "10";
      ctx.env.PERMIT_TREASURY_GITHUB_USERNAME = "ubiquity-os-treasury";
      ctx.env.PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST = `${DOLLAR_ADDRESS}`;
      drop(db);
      for (const table of Object.keys(dbSeed)) {
        const tableName = table as keyof typeof dbSeed;
        for (const row of dbSeed[tableName]) {
          db[tableName].create(row);
        }
      }
    });

    afterEach(() => {
      // restore the spy created with spyOn
      jest.restoreAllMocks();
    });

    it("Should not apply fees if PERMIT_FEE_RATE is empty", async () => {
      ctx.env.PERMIT_FEE_RATE = "";
      const paymentModule = new PaymentModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");
      await paymentModule._applyFees(getResultOriginal(), WXDAI_ADDRESS);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(/.*PERMIT_FEE_RATE is not set, skipping permit fee generation/);
      spyConsoleLog.mockReset();
    });

    it("Should not apply fees if PERMIT_FEE_RATE is 0", async () => {
      ctx.env.PERMIT_FEE_RATE = "0";
      const paymentModule = new PaymentModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");
      await paymentModule._applyFees(getResultOriginal(), WXDAI_ADDRESS);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(/.*PERMIT_FEE_RATE is not set, skipping permit fee generation/);
      spyConsoleLog.mockReset();
    });

    it("Should not apply fees if PERMIT_TREASURY_GITHUB_USERNAME is empty", async () => {
      process.env.PERMIT_TREASURY_GITHUB_USERNAME = "";
      ctx.env.PERMIT_TREASURY_GITHUB_USERNAME = "";
      const paymentModule = new PaymentModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");
      await paymentModule._applyFees(getResultOriginal(), WXDAI_ADDRESS);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(/.*PERMIT_TREASURY_GITHUB_USERNAME is not set, skipping permit fee generation/);
      spyConsoleLog.mockReset();
    });

    it("Should not apply fees if ERC20 reward token is included in PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST", async () => {
      const paymentModule = new PaymentModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");
      await paymentModule._applyFees(getResultOriginal(), DOLLAR_ADDRESS);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(
        new RegExp(`.*Token address ${DOLLAR_ADDRESS} is whitelisted to be fee free, skipping permit fee generation`)
      );
      spyConsoleLog.mockReset();
    });

    it("Should apply fees", async () => {
      const paymentModule = new PaymentModule(ctx);
      const resultAfterFees = await paymentModule._applyFees(getResultOriginal(), WXDAI_ADDRESS);

      // check that 10% fee is subtracted from rewards
      expect(resultAfterFees["molecula451"].total).toEqual(90);
      expect(resultAfterFees["molecula451"].task?.reward).toEqual(81);
      expect(resultAfterFees["molecula451"].comments?.[0].score?.reward).toEqual(9);
      expect(resultAfterFees["0x4007"].total).toEqual(10);
      expect(resultAfterFees["0x4007"].task?.reward).toEqual(8.99);
      expect(resultAfterFees["0x4007"].comments?.[0].score?.reward).toEqual(1.01);

      // check that treasury item is added
      expect(resultAfterFees["ubiquity-os-treasury"].total).toEqual(11.11);
    });
  });

  describe("_getNetworkExplorer()", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("Should return a network explorer url", async () => {
      const paymentModule = new PaymentModule(ctx);
      const url = await paymentModule._getNetworkExplorer(100);
      expect(url).toMatch(/http.*/);
    });
  });

  describe("_getBeneficiaries()", () => {
    beforeEach(() => {
      ctx.env.PERMIT_FEE_RATE = "";
      drop(db);
      for (const table of Object.keys(dbSeed)) {
        const tableName = table as keyof typeof dbSeed;
        for (const row of dbSeed[tableName]) {
          db[tableName].create(row);
        }
      }
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("Should return the correct total payable amount", async () => {
      const paymentModule = new PaymentModule(ctx);
      const beneficiaries = await paymentModule._getBeneficiaries(getResultOriginal());
      expect(beneficiaries).not.toBeNull();
      const totalPayable = beneficiaries?.reduce((accumulator, current) => accumulator + current.amount, 0);
      expect(totalPayable).toEqual(111.11);
    });
  });

  describe("_automaticTransferMode", () => {
    beforeEach(() => {
      ctx.env.PERMIT_FEE_RATE = "";
      drop(db);
      for (const table of Object.keys(dbSeed)) {
        const tableName = table as keyof typeof dbSeed;
        for (const row of dbSeed[tableName]) {
          db[tableName].create(row);
        }
      }
    });
    it("Should set correct value for _automaticTransferMode", async () => {
      ctx.config.incentives.payment = { automaticTransferMode: false };
      let paymentModule = new PaymentModule(ctx);
      expect(paymentModule._autoTransferMode).toEqual(false);

      ctx.config.incentives.payment = { automaticTransferMode: true };
      paymentModule = new PaymentModule(ctx);
      expect(paymentModule._autoTransferMode).toEqual(true);

      ctx.config.incentives.payment = {};
      paymentModule = new PaymentModule(ctx);
      expect(paymentModule._autoTransferMode).toEqual(true);

      ctx.config.incentives.payment = null;
      paymentModule = new PaymentModule(ctx);
      expect(paymentModule._autoTransferMode).toEqual(true);
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });
  });
  describe("_getPayoutMode()", () => {
    beforeEach(() => {
      ctx.env.PERMIT_FEE_RATE = "";
      drop(db);
      for (const table of Object.keys(dbSeed)) {
        const tableName = table as keyof typeof dbSeed;
        for (const row of dbSeed[tableName]) {
          db[tableName].create(row);
        }
      }
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("Should return null if the `payoutMode` was already set to `direct`", async () => {
      ctx.config.incentives.payment = { automaticTransferMode: false };
      let paymentModule = new PaymentModule(ctx);

      let payoutMode = await paymentModule._getPayoutMode({
        comments: [{ body: `...${PAYOUT_MODE_TRANSFER}....`, user: { type: "Bot" } }],
      } as unknown as IssueActivity);
      expect(payoutMode).toEqual(null);

      ctx.config.incentives.payment = { automaticTransferMode: true };
      paymentModule = new PaymentModule(ctx);
      payoutMode = await paymentModule._getPayoutMode({
        comments: [{ body: `...${PAYOUT_MODE_TRANSFER}....`, user: { type: "Bot" } }],
      } as unknown as IssueActivity);
      expect(payoutMode).toEqual(null);
    });

    it("Should return `permit` if the `payoutMode` was already set to `permit` or `autoTransferMode` is set to `false`", async () => {
      ctx.config.incentives.payment = { automaticTransferMode: false };
      const paymentModule = new PaymentModule(ctx);

      let payoutMode = await paymentModule._getPayoutMode({
        comments: [{ body: `...${PAYOUT_MODE_PERMIT}...`, user: { type: "Bot" } }],
      } as unknown as IssueActivity);
      expect(payoutMode).toEqual("permit");

      payoutMode = await paymentModule._getPayoutMode({
        comments: [{ body: "", user: { type: "Bot" } }],
      } as unknown as IssueActivity);
      expect(payoutMode).toEqual("permit");
    });

    it("Should return `permit` if the `payoutMode` was already set to `permit` even if `autoTransferMode` is set to `true`", async () => {
      ctx.config.incentives.payment = { automaticTransferMode: true };

      const paymentModule = new PaymentModule(ctx);

      const payoutMode = await paymentModule._getPayoutMode({
        comments: [{ body: `...${PAYOUT_MODE_PERMIT}...`, user: { type: "Bot" } }],
      } as unknown as IssueActivity);
      expect(payoutMode).toEqual("permit");
    });

    it("Should return `direct` if the `payoutMode` was not set and `autoTransferMode` is set to `true`", async () => {
      ctx.config.incentives.payment = { automaticTransferMode: true };
      const paymentModule = new PaymentModule(ctx);

      const payoutMode = await paymentModule._getPayoutMode({
        comments: [{ body: "", user: { type: "Bot" } }],
      } as unknown as IssueActivity);
      expect(payoutMode).toEqual("transfer");
    });
  });

  const fundingWalletPrivateKey = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  describe("_canTransferDirectly()", () => {
    beforeEach(() => {
      ctx.env.PERMIT_FEE_RATE = "";
      ctx.env.X25519_PRIVATE_KEY = "wrQ9wTI1bwdAHbxk2dfsvoK1yRwDc0CEenmMXFvGYgY";
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("Should return a transferInfo when the funding wallet has enough reward tokens and gas", async () => {
      const paymentModule = new PaymentModule(ctx);
      const spyConsoleLog = jest.spyOn(ctx.logger, "info");

      const beneficiaries = await paymentModule._getBeneficiaries(getResultOriginal());
      const directTransferInfo = await paymentModule._getDirectTransferInfo(
        beneficiaries,
        fundingWalletPrivateKey,
        "0"
      );

      expect(directTransferInfo).not.toBeNull();

      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(
        /.*The funding wallet has sufficient gas and reward tokens to perform direct transfers/
      );
      const logCallMetadata = spyConsoleLog.mock.calls.map((call) => call[1])[0] as {
        [key: string]: { [key: string]: string };
      };
      expect(logCallMetadata).not.toBeUndefined();

      expect(logCallMetadata.gas.has).toEqual(parseUnits("1", 18).toString());
      expect(logCallMetadata.gas.required).toEqual(parseUnits("0.02", 18).toString());
      expect(logCallMetadata.rewardToken.has).toEqual(parseUnits("200", 18).toString());
      expect(logCallMetadata.rewardToken.allowed).toEqual(parseUnits("200", 18).toString());
      expect(logCallMetadata.rewardToken.required).toEqual(parseUnits("111.11", 18).toString());

      spyConsoleLog.mockReset();
    });

    it("Should reject if the funding wallet has enough reward tokens but insufficient gas", async () => {
      const { getEvmWallet } = await import("../../src/helpers/web3");

      const mockedGetEvmWallet = getEvmWallet as jest.Mock;
      mockedGetEvmWallet.mockImplementationOnce(() => ({
        address: "0xOverriddenAddress",
        getBalance: jest.fn().mockReturnValue(parseUnits("0.004", 18)),
      }));
      const paymentModule = new PaymentModule(ctx);
      const beneficiaries = await paymentModule._getBeneficiaries(getResultOriginal());
      await expect(
        paymentModule._getDirectTransferInfo(beneficiaries, fundingWalletPrivateKey, "0")
      ).rejects.toMatchObject({
        logMessage: {
          raw: "The funding wallet lacks sufficient gas to perform direct transfers",
        },
        metadata: {
          gas: {
            has: "4000000000000000",
            required: "20000000000000000",
          },
          rewardToken: {
            allowed: "200000000000000000000",
            has: "200000000000000000000",
            required: "111110000000000000000",
          },
        },
      });
    });

    it("Should reject if the funding wallet has insufficient reward tokens", async () => {
      const { getEvmWallet } = await import("../../src/helpers/web3");

      const mockedGetEvmWallet = getEvmWallet as jest.Mock;
      mockedGetEvmWallet.mockImplementationOnce(() => ({
        address: "0xOverriddenAddress",
        getBalance: jest.fn().mockReturnValue(parseUnits("0.004", 18)),
      }));
      mockRewardTokenBalance.mockReturnValueOnce(parseUnits("50", 18));

      const paymentModule = new PaymentModule(ctx);
      const beneficiaries = await paymentModule._getBeneficiaries(getResultOriginal());
      await expect(
        paymentModule._getDirectTransferInfo(beneficiaries, fundingWalletPrivateKey, "0")
      ).rejects.toMatchObject({
        logMessage: {
          raw: "The funding wallet lacks sufficient reward tokens to perform direct transfers",
        },
        metadata: {
          gas: {
            has: "4000000000000000",
            required: "Unavailable",
          },
          rewardToken: {
            allowed: "200000000000000000000",
            has: "50000000000000000000",
            required: "111110000000000000000",
          },
        },
      });
    });
  });

  describe("_isPrivateKeyAllowed()", () => {
    beforeEach(() => {
      // set dummy X25519_PRIVATE_KEY
      ctx.env.X25519_PRIVATE_KEY = "wrQ9wTI1bwdAHbxk2dfsvoK1yRwDc0CEenmMXFvGYgY";
    });

    it("Should return false if private key could not be decrypted", async () => {
      const paymentModule = new PaymentModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "warn");

      // format: "PRIVATE_KEY"
      // encrypted value: ""
      const privateKeyEncrypted = "Y-29-JttQ7xNBMOQylST_9kgVjVKnvkYlyihbqsBwGDmuBi7ZlaIh1I6cTDzrMiR";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;

      const privateKeyParsed = await paymentModule._parsePrivateKey(privateKeyEncrypted);
      const [isAllowed] = await paymentModule._isPrivateKeyAllowed(
        privateKeyParsed,
        githubContextOrganizationId,
        githubContextRepositoryId
      );

      expect(isAllowed).toEqual(false);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(new RegExp(`.*Private key could not be decrypted`));
      spyConsoleLog.mockReset();
    });

    it("Should decrypt private key correctly", async () => {
      const paymentModule = new PaymentModule(ctx);

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1"
      const privateKey = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      const privateKeyEncrypted =
        "fdsmuUN_jTF-VAWMe55ozcg6AuLOKiyJm8unRg1QwnY9u_fsKmczRtekx6aq59ndQ0RDJ803SkeTOlUW87cd93rDTiq57ErxkRwq4j4SKYTitChIWAZw0-LCJAd2IvRmN9qVzA7oXEdkUihXkErGGtqK";
      const decrypted = await paymentModule._parsePrivateKey(privateKeyEncrypted);

      expect(decrypted.privateKey).toEqual(privateKey);
    });

    it("Should return false if private key is used in unallowed organization", async () => {
      const paymentModule = new PaymentModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1"
      const privateKeyEncrypted =
        "fdsmuUN_jTF-VAWMe55ozcg6AuLOKiyJm8unRg1QwnY9u_fsKmczRtekx6aq59ndQ0RDJ803SkeTOlUW87cd93rDTiq57ErxkRwq4j4SKYTitChIWAZw0-LCJAd2IvRmN9qVzA7oXEdkUihXkErGGtqK";
      const githubContextOrganizationId = 99;
      const githubContextRepositoryId = 2;

      const privateKeyParsed = await paymentModule._parsePrivateKey(privateKeyEncrypted);
      const [isAllowed] = await paymentModule._isPrivateKeyAllowed(
        privateKeyParsed,
        githubContextOrganizationId,
        githubContextRepositoryId
      );

      expect(isAllowed).toEqual(false);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(/.*Current organization\/user id 99 is not allowed to use this private key/);
      spyConsoleLog.mockReset();
    });

    it("Should return true if private key is used in allowed organization", async () => {
      const paymentModule = new PaymentModule(ctx);

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1"
      const privateKeyEncrypted =
        "fdsmuUN_jTF-VAWMe55ozcg6AuLOKiyJm8unRg1QwnY9u_fsKmczRtekx6aq59ndQ0RDJ803SkeTOlUW87cd93rDTiq57ErxkRwq4j4SKYTitChIWAZw0-LCJAd2IvRmN9qVzA7oXEdkUihXkErGGtqK";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;

      const privateKeyParsed = await paymentModule._parsePrivateKey(privateKeyEncrypted);
      const [isAllowed] = await paymentModule._isPrivateKeyAllowed(
        privateKeyParsed,
        githubContextOrganizationId,
        githubContextRepositoryId
      );

      expect(isAllowed).toEqual(true);
    });

    it("Should return false if private key is used in un-allowed organization and allowed repository", async () => {
      const paymentModule = new PaymentModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1:2"
      const privateKeyEncrypted =
        "mgLMdW_zfTYn3oNB5O0RBvPQOU4SkE1dOnhc6IGrgTQkkEJB7tvaEHdbZS0dEnq4VK21yShd5zdaRMbl6W2B6ij5tkrODH5-NEd8Uvp4Ks-NqrG-V3GkKrCJqCz3Cci3jrXU_rdn3Uil03d41eB4xluR_g8";
      const githubContextOrganizationId = 99;
      const githubContextRepositoryId = 2;

      const privateKeyParsed = await paymentModule._parsePrivateKey(privateKeyEncrypted);
      const [isAllowed] = await paymentModule._isPrivateKeyAllowed(
        privateKeyParsed,
        githubContextOrganizationId,
        githubContextRepositoryId
      );

      expect(isAllowed).toEqual(false);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(
        /.*Current organization\/user id 99 and repository id 2 are not allowed to use this private key/
      );
      spyConsoleLog.mockReset();
    });

    it("Should return false if private key is used in allowed organization and unallowed repository", async () => {
      const paymentModule = new PaymentModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1:2"
      const privateKeyEncrypted =
        "mgLMdW_zfTYn3oNB5O0RBvPQOU4SkE1dOnhc6IGrgTQkkEJB7tvaEHdbZS0dEnq4VK21yShd5zdaRMbl6W2B6ij5tkrODH5-NEd8Uvp4Ks-NqrG-V3GkKrCJqCz3Cci3jrXU_rdn3Uil03d41eB4xluR_g8";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 99;

      const privateKeyParsed = await paymentModule._parsePrivateKey(privateKeyEncrypted);
      const [isAllowed] = await paymentModule._isPrivateKeyAllowed(
        privateKeyParsed,
        githubContextOrganizationId,
        githubContextRepositoryId
      );

      expect(isAllowed).toEqual(false);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(
        /.*Current organization\/user id 1 and repository id 99 are not allowed to use this private key/
      );
      spyConsoleLog.mockReset();
    });

    it("Should return true if private key is used in allowed organization and repository", async () => {
      const paymentModule = new PaymentModule(ctx);

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1:2"
      const privateKeyEncrypted =
        "mgLMdW_zfTYn3oNB5O0RBvPQOU4SkE1dOnhc6IGrgTQkkEJB7tvaEHdbZS0dEnq4VK21yShd5zdaRMbl6W2B6ij5tkrODH5-NEd8Uvp4Ks-NqrG-V3GkKrCJqCz3Cci3jrXU_rdn3Uil03d41eB4xluR_g8";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;

      const privateKeyParsed = await paymentModule._parsePrivateKey(privateKeyEncrypted);
      const [isAllowed] = await paymentModule._isPrivateKeyAllowed(
        privateKeyParsed,
        githubContextOrganizationId,
        githubContextRepositoryId
      );

      expect(isAllowed).toEqual(true);
    });

    it("Should return false if private key format is invalid", async () => {
      const paymentModule = new PaymentModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "warn");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:0:2"
      const privateKeyEncrypted =
        "RIocCo0h_tMvLWieOZYPWzP7l7jVnVAno_QELfyUrRwVsN8aOHlx5hw5Be41bX74_Xaqef-gwTToXfdbgbqgLhLG0fxtw-QxKkWtzVnMlqO-WA2WVuaf3BpyiGFbVyyvFyFY_Q_O9gxY_F3xBPmHNfAwCPs";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;

      const privateKeyParsed = await paymentModule._parsePrivateKey(privateKeyEncrypted);
      const [isAllowed] = await paymentModule._isPrivateKeyAllowed(
        privateKeyParsed,
        githubContextOrganizationId,
        githubContextRepositoryId
      );

      expect(isAllowed).toEqual(false);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(/.*Invalid private key format/);
      spyConsoleLog.mockReset();
    });
  });
});
