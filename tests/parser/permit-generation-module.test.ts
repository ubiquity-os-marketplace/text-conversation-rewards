import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { CommentKind } from "../../src/configuration/comment-types";
import { EnvConfig } from "../../src/types/env-type";
import { ContextPlugin } from "../../src/types/plugin-input";
import { Result } from "../../src/types/results";
import { db } from "../__mocks__/db";
import dbSeed from "../__mocks__/db-seed.json";
import { server } from "../__mocks__/node";
import cfg from "../__mocks__/results/valid-configuration.json";

const DOLLAR_ADDRESS = "0xb6919Ef2ee4aFC163BC954C5678e2BB570c2D103";
const WXDAI_ADDRESS = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";

const ctx = {
  eventName: "issues.closed",
  payload: {
    issue: {
      html_url: "https://github.com/ubiquity-os/comment-incentives/issues/22",
      number: 1,
      state_reason: "not_planned",
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
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
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

// original rewards object before fees are applied
const resultOriginal: Result = {
  user1: {
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
        type: CommentKind.ISSUE,
        score: {
          reward: 10,
          multiplier: 1,
        },
      },
    ],
  },
  user2: {
    total: 11.11,
    task: {
      reward: 9.99,
      multiplier: 1,
    },
    userId: 1,
    comments: [
      {
        id: 57,
        content: "comment 3",
        url: "https://github.com/user-org/test-repo/issues/57#issuecomment-2172704421",
        type: CommentKind.ISSUE,
        score: {
          reward: 1.12,
          multiplier: 1,
        },
      },
    ],
  },
};

const { PermitGenerationModule } = await import("../../src/parser/permit-generation-module");

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("permit-generation-module.ts", () => {
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
      const permitGenerationModule = new PermitGenerationModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");
      await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(/.*PERMIT_FEE_RATE is not set, skipping permit fee generation/);
      spyConsoleLog.mockReset();
    });

    it("Should not apply fees if PERMIT_FEE_RATE is 0", async () => {
      ctx.env.PERMIT_FEE_RATE = "0";
      const permitGenerationModule = new PermitGenerationModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");
      await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(/.*PERMIT_FEE_RATE is not set, skipping permit fee generation/);
      spyConsoleLog.mockReset();
    });

    it("Should not apply fees if PERMIT_TREASURY_GITHUB_USERNAME is empty", async () => {
      process.env.PERMIT_TREASURY_GITHUB_USERNAME = "";
      ctx.env.PERMIT_TREASURY_GITHUB_USERNAME = "";
      const permitGenerationModule = new PermitGenerationModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");
      await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(/.*PERMIT_TREASURY_GITHUB_USERNAME is not set, skipping permit fee generation/);
      spyConsoleLog.mockReset();
    });

    it("Should not apply fees if ERC20 reward token is included in PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST", async () => {
      const permitGenerationModule = new PermitGenerationModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");
      await permitGenerationModule._applyFees(resultOriginal, DOLLAR_ADDRESS);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(
        new RegExp(`.*Token address ${DOLLAR_ADDRESS} is whitelisted to be fee free, skipping permit fee generation`)
      );
      spyConsoleLog.mockReset();
    });

    it("Should apply fees", async () => {
      const permitGenerationModule = new PermitGenerationModule(ctx);
      const resultAfterFees = await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);

      // check that 10% fee is subtracted from rewards
      expect(resultAfterFees["user1"].total).toEqual(90);
      expect(resultAfterFees["user1"].task?.reward).toEqual(81);
      expect(resultAfterFees["user1"].comments?.[0].score?.reward).toEqual(9);
      expect(resultAfterFees["user2"].total).toEqual(10);
      expect(resultAfterFees["user2"].task?.reward).toEqual(8.99);
      expect(resultAfterFees["user2"].comments?.[0].score?.reward).toEqual(1.01);

      // check that treasury item is added
      expect(resultAfterFees["ubiquity-os-treasury"].total).toEqual(11.11);
    });
  });

  describe("_isPrivateKeyAllowed()", () => {
    beforeEach(() => {
      // set dummy X25519_PRIVATE_KEY
      ctx.env.X25519_PRIVATE_KEY = "wrQ9wTI1bwdAHbxk2dfsvoK1yRwDc0CEenmMXFvGYgY";
    });

    it("Should return false if private key could not be decrypted", async () => {
      const permitGenerationModule = new PermitGenerationModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "warn");

      // format: "PRIVATE_KEY"
      // encrypted value: ""
      const privateKeyEncrypted = "Y-29-JttQ7xNBMOQylST_9kgVjVKnvkYlyihbqsBwGDmuBi7ZlaIh1I6cTDzrMiR";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;

      const isAllowed = await permitGenerationModule._isPrivateKeyAllowed(
        privateKeyEncrypted,
        githubContextOrganizationId,
        githubContextRepositoryId,
        process.env as unknown as EnvConfig
      );

      expect(isAllowed).toEqual(false);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(new RegExp(`.*Private key could not be decrypted`));
      spyConsoleLog.mockReset();
    });

    it("Should return false if private key is used in unallowed organization", async () => {
      const permitGenerationModule = new PermitGenerationModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1"
      const privateKeyEncrypted =
        "fdsmuUN_jTF-VAWMe55ozcg6AuLOKiyJm8unRg1QwnY9u_fsKmczRtekx6aq59ndQ0RDJ803SkeTOlUW87cd93rDTiq57ErxkRwq4j4SKYTitChIWAZw0-LCJAd2IvRmN9qVzA7oXEdkUihXkErGGtqK";
      const githubContextOrganizationId = 99;
      const githubContextRepositoryId = 2;

      const isAllowed = await permitGenerationModule._isPrivateKeyAllowed(
        privateKeyEncrypted,
        githubContextOrganizationId,
        githubContextRepositoryId,
        process.env as unknown as EnvConfig
      );

      expect(isAllowed).toEqual(false);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(/.*Current organization\/user id 99 is not allowed to use this private key/);
      spyConsoleLog.mockReset();
    });

    it("Should return true if private key is used in allowed organization", async () => {
      const permitGenerationModule = new PermitGenerationModule(ctx);

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1"
      const privateKeyEncrypted =
        "fdsmuUN_jTF-VAWMe55ozcg6AuLOKiyJm8unRg1QwnY9u_fsKmczRtekx6aq59ndQ0RDJ803SkeTOlUW87cd93rDTiq57ErxkRwq4j4SKYTitChIWAZw0-LCJAd2IvRmN9qVzA7oXEdkUihXkErGGtqK";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;

      const isAllowed = await permitGenerationModule._isPrivateKeyAllowed(
        privateKeyEncrypted,
        githubContextOrganizationId,
        githubContextRepositoryId,
        process.env as unknown as EnvConfig
      );

      expect(isAllowed).toEqual(true);
    });

    it("Should return false if private key is used in un-allowed organization and allowed repository", async () => {
      const permitGenerationModule = new PermitGenerationModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1:2"
      const privateKeyEncrypted =
        "mgLMdW_zfTYn3oNB5O0RBvPQOU4SkE1dOnhc6IGrgTQkkEJB7tvaEHdbZS0dEnq4VK21yShd5zdaRMbl6W2B6ij5tkrODH5-NEd8Uvp4Ks-NqrG-V3GkKrCJqCz3Cci3jrXU_rdn3Uil03d41eB4xluR_g8";
      const githubContextOrganizationId = 99;
      const githubContextRepositoryId = 2;

      const isAllowed = await permitGenerationModule._isPrivateKeyAllowed(
        privateKeyEncrypted,
        githubContextOrganizationId,
        githubContextRepositoryId,
        process.env as unknown as EnvConfig
      );

      expect(isAllowed).toEqual(false);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(
        /.*Current organization\/user id 99 and repository id 2 are not allowed to use this private key/
      );
      spyConsoleLog.mockReset();
    });

    it("Should return false if private key is used in allowed organization and unallowed repository", async () => {
      const permitGenerationModule = new PermitGenerationModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "info");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1:2"
      const privateKeyEncrypted =
        "mgLMdW_zfTYn3oNB5O0RBvPQOU4SkE1dOnhc6IGrgTQkkEJB7tvaEHdbZS0dEnq4VK21yShd5zdaRMbl6W2B6ij5tkrODH5-NEd8Uvp4Ks-NqrG-V3GkKrCJqCz3Cci3jrXU_rdn3Uil03d41eB4xluR_g8";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 99;

      const isAllowed = await permitGenerationModule._isPrivateKeyAllowed(
        privateKeyEncrypted,
        githubContextOrganizationId,
        githubContextRepositoryId,
        process.env as unknown as EnvConfig
      );

      expect(isAllowed).toEqual(false);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(
        /.*Current organization\/user id 1 and repository id 99 are not allowed to use this private key/
      );
      spyConsoleLog.mockReset();
    });

    it("Should return true if private key is used in allowed organization and repository", async () => {
      const permitGenerationModule = new PermitGenerationModule(ctx);

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1:2"
      const privateKeyEncrypted =
        "mgLMdW_zfTYn3oNB5O0RBvPQOU4SkE1dOnhc6IGrgTQkkEJB7tvaEHdbZS0dEnq4VK21yShd5zdaRMbl6W2B6ij5tkrODH5-NEd8Uvp4Ks-NqrG-V3GkKrCJqCz3Cci3jrXU_rdn3Uil03d41eB4xluR_g8";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;

      const isAllowed = await permitGenerationModule._isPrivateKeyAllowed(
        privateKeyEncrypted,
        githubContextOrganizationId,
        githubContextRepositoryId,
        process.env as unknown as EnvConfig
      );

      expect(isAllowed).toEqual(true);
    });

    it("Should return false if private key format is invalid", async () => {
      const permitGenerationModule = new PermitGenerationModule(ctx);
      const spyConsoleLog = jest.spyOn(console, "warn");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:0:2"
      const privateKeyEncrypted =
        "RIocCo0h_tMvLWieOZYPWzP7l7jVnVAno_QELfyUrRwVsN8aOHlx5hw5Be41bX74_Xaqef-gwTToXfdbgbqgLhLG0fxtw-QxKkWtzVnMlqO-WA2WVuaf3BpyiGFbVyyvFyFY_Q_O9gxY_F3xBPmHNfAwCPs";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;

      const isAllowed = await permitGenerationModule._isPrivateKeyAllowed(
        privateKeyEncrypted,
        githubContextOrganizationId,
        githubContextRepositoryId,
        process.env as unknown as EnvConfig
      );

      expect(isAllowed).toEqual(false);
      const logCallArgs = spyConsoleLog.mock.calls.map((call) => call[0]);
      expect(logCallArgs[0]).toMatch(/.*Invalid private key format/);
      spyConsoleLog.mockReset();
    });
  });
});
