/* eslint @typescript-eslint/no-var-requires: 0 */
import { CommentKind } from "../../src/configuration/comment-types";
import { PermitGenerationModule } from "../../src/parser/permit-generation-module";
import { Result } from "../../src/parser/processor";

const DOLLAR_ADDRESS = "0xb6919Ef2ee4aFC163BC954C5678e2BB570c2D103";
const WXDAI_ADDRESS = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";

jest.mock("../../src/parser/command-line", () => {
  // Require is needed because mock cannot access elements out of scope
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cfg = require("../__mocks__/results/valid-configuration.json");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv");
  dotenv.config();
  return {
    stateId: 1,
    eventName: "issues.closed",
    authToken: process.env.GITHUB_TOKEN,
    ref: "",
    eventPayload: {
      issue: {
        html_url: "https://github.com/ubiquibot/comment-incentives/issues/22",
        number: 1,
        state_reason: "not_planned",
      },
      repository: {
        name: "conversation-rewards",
        owner: {
          login: "ubiquibot",
        },
      },
    },
    settings: JSON.stringify(cfg),
  };
});

jest.mock("../../src/octokit", () => ({
  getOctokitInstance: () => ({
    users: {
      getByUsername: () => ({
        data: {
          id: 3,
        },
      }),
    },
  }),
}));

jest.mock("@supabase/supabase-js", () => {
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
        },
      },
    ],
  },
};

describe("permit-generation-module.ts", () => {
  describe("applyFees()", () => {
    beforeEach(() => {
      // set fee related env variables
      // treasury fee applied to the final permits, ex: 100 = 100%, 0.1 = 0.1%
      process.env.PERMIT_FEE_RATE = "10";
      // github account associated with EVM treasury address allowed to claim permit fees, ex: "ubiquibot-treasury"
      process.env.PERMIT_TREASURY_GITHUB_USERNAME = "ubiquibot-treasury";
      // comma separated list of token addresses which should not incur any fees, ex: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d, 0x4ECaBa5870353805a9F068101A40E0f32ed605C6"
      process.env.PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST = `${DOLLAR_ADDRESS}`;
    });

    afterEach(() => {
      // restore the spy created with spyOn
      jest.restoreAllMocks();
    });

    it("Should not apply fees if PERMIT_FEE_RATE is empty", async () => {
      process.env.PERMIT_FEE_RATE = "";
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");
      await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);
      expect(spyConsoleLog).toHaveBeenCalledWith("PERMIT_FEE_RATE is not set, skipping permit fee generation");
    });

    it("Should not apply fees if PERMIT_FEE_RATE is 0", async () => {
      process.env.PERMIT_FEE_RATE = "0";
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");
      await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);
      expect(spyConsoleLog).toHaveBeenCalledWith("PERMIT_FEE_RATE is not set, skipping permit fee generation");
    });

    it("Should not apply fees if PERMIT_TREASURY_GITHUB_USERNAME is empty", async () => {
      process.env.PERMIT_TREASURY_GITHUB_USERNAME = "";
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");
      await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);
      expect(spyConsoleLog).toHaveBeenCalledWith(
        "PERMIT_TREASURY_GITHUB_USERNAME is not set, skipping permit fee generation"
      );
    });

    it("Should not apply fees if ERC20 reward token is included in PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");
      await permitGenerationModule._applyFees(resultOriginal, DOLLAR_ADDRESS);
      expect(spyConsoleLog).toHaveBeenCalledWith(
        `Token address ${DOLLAR_ADDRESS} is whitelisted to be fee free, skipping permit fee generation`
      );
    });

    it("Should apply fees", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const resultAfterFees = await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);

      // check that 10% fee is subtracted from rewards
      expect(resultAfterFees["user1"].total).toEqual(90);
      expect(resultAfterFees["user1"].task?.reward).toEqual(81);
      expect(resultAfterFees["user1"].comments?.[0].score?.reward).toEqual(9);
      expect(resultAfterFees["user2"].total).toEqual(10);
      expect(resultAfterFees["user2"].task?.reward).toEqual(8.99);
      expect(resultAfterFees["user2"].comments?.[0].score?.reward).toEqual(1.01);

      // check that treasury item is added
      expect(resultAfterFees["ubiquibot-treasury"].total).toEqual(11.11);
    });
  });

  describe("_isPrivateKeyAllowed()", () => {
    beforeEach(() => {
      // set dummy X25519_PRIVATE_KEY
      process.env.X25519_PRIVATE_KEY = "wrQ9wTI1bwdAHbxk2dfsvoK1yRwDc0CEenmMXFvGYgY";
    });

    it("Should return false if private key could not be decrypted", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");

      // format: "PRIVATE_KEY"
      // encrypted value: ""
      const privateKeyEncrypted = "Y-29-JttQ7xNBMOQylST_9kgVjVKnvkYlyihbqsBwGDmuBi7ZlaIh1I6cTDzrMiR";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;
      
      const result = await permitGenerationModule._isPrivateKeyAllowed(privateKeyEncrypted, githubContextOrganizationId, githubContextRepositoryId);
      
      expect(result).toEqual(false);
      expect(spyConsoleLog).toHaveBeenCalledWith("Private key could not be decrypted");
    });

    it("Should return false if private key is used in plain format outside ubiquity related organizations", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");

      // format: "PRIVATE_KEY"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
      const privateKeyEncrypted = "Php81Y5mOJcuXDf9H9BOG74SHKVBG0xnKipnFpGrcDz0yQqNS_l3mWh06Tki_J1WLdjzcBx-ZVs3OrRpMCRFYeJ588kgxRwHFlAvZGQFdTohIClOwyHMw1t-mG4KZoLMyFmqxFTtFs64JezRB1dJDA";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;
      
      const result = await permitGenerationModule._isPrivateKeyAllowed(privateKeyEncrypted, githubContextOrganizationId, githubContextRepositoryId);
      
      expect(result).toEqual(false);
      expect(spyConsoleLog).toHaveBeenCalledWith("Current organization id 1 is not allowed to use this type of private key");
    });

    it("Should return true if private key is used in plain format in ubiquity related organizations", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");

      // format: "PRIVATE_KEY"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
      const privateKeyEncrypted = "Php81Y5mOJcuXDf9H9BOG74SHKVBG0xnKipnFpGrcDz0yQqNS_l3mWh06Tki_J1WLdjzcBx-ZVs3OrRpMCRFYeJ588kgxRwHFlAvZGQFdTohIClOwyHMw1t-mG4KZoLMyFmqxFTtFs64JezRB1dJDA";
      const githubContextOrganizationId = 76412717; // ubiquity
      const githubContextRepositoryId = 2;
      
      const result = await permitGenerationModule._isPrivateKeyAllowed(privateKeyEncrypted, githubContextOrganizationId, githubContextRepositoryId);
      
      expect(result).toEqual(true);
    });

    it("Should return false if private key is used in unallowed organization", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1"
      const privateKeyEncrypted = "fdsmuUN_jTF-VAWMe55ozcg6AuLOKiyJm8unRg1QwnY9u_fsKmczRtekx6aq59ndQ0RDJ803SkeTOlUW87cd93rDTiq57ErxkRwq4j4SKYTitChIWAZw0-LCJAd2IvRmN9qVzA7oXEdkUihXkErGGtqK";
      const githubContextOrganizationId = 99;
      const githubContextRepositoryId = 2;
      
      const result = await permitGenerationModule._isPrivateKeyAllowed(privateKeyEncrypted, githubContextOrganizationId, githubContextRepositoryId);
      
      expect(result).toEqual(false);
      expect(spyConsoleLog).toHaveBeenCalledWith("Current organization id 99 is not allowed to use this private key");
    });

    it("Should return true if private key is used in allowed organization", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1"
      const privateKeyEncrypted = "fdsmuUN_jTF-VAWMe55ozcg6AuLOKiyJm8unRg1QwnY9u_fsKmczRtekx6aq59ndQ0RDJ803SkeTOlUW87cd93rDTiq57ErxkRwq4j4SKYTitChIWAZw0-LCJAd2IvRmN9qVzA7oXEdkUihXkErGGtqK";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;
      
      const result = await permitGenerationModule._isPrivateKeyAllowed(privateKeyEncrypted, githubContextOrganizationId, githubContextRepositoryId);
      
      expect(result).toEqual(true);
    });

    it("Should return false if private key is used in unallowed organization and allowed repository", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1:2"
      const privateKeyEncrypted = "mgLMdW_zfTYn3oNB5O0RBvPQOU4SkE1dOnhc6IGrgTQkkEJB7tvaEHdbZS0dEnq4VK21yShd5zdaRMbl6W2B6ij5tkrODH5-NEd8Uvp4Ks-NqrG-V3GkKrCJqCz3Cci3jrXU_rdn3Uil03d41eB4xluR_g8";
      const githubContextOrganizationId = 99;
      const githubContextRepositoryId = 2;
      
      const result = await permitGenerationModule._isPrivateKeyAllowed(privateKeyEncrypted, githubContextOrganizationId, githubContextRepositoryId);
      
      expect(result).toEqual(false);
      expect(spyConsoleLog).toHaveBeenCalledWith("Current organization id 99 and repository id 2 are not allowed to use this private key");
    });

    it("Should return false if private key is used in allowed organization and unallowed repository", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1:2"
      const privateKeyEncrypted = "mgLMdW_zfTYn3oNB5O0RBvPQOU4SkE1dOnhc6IGrgTQkkEJB7tvaEHdbZS0dEnq4VK21yShd5zdaRMbl6W2B6ij5tkrODH5-NEd8Uvp4Ks-NqrG-V3GkKrCJqCz3Cci3jrXU_rdn3Uil03d41eB4xluR_g8";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 99;
      
      const result = await permitGenerationModule._isPrivateKeyAllowed(privateKeyEncrypted, githubContextOrganizationId, githubContextRepositoryId);
      
      expect(result).toEqual(false);
      expect(spyConsoleLog).toHaveBeenCalledWith("Current organization id 1 and repository id 99 are not allowed to use this private key");
    });

    it("Should return true if private key is used in allowed organization and repository", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:1:2"
      const privateKeyEncrypted = "mgLMdW_zfTYn3oNB5O0RBvPQOU4SkE1dOnhc6IGrgTQkkEJB7tvaEHdbZS0dEnq4VK21yShd5zdaRMbl6W2B6ij5tkrODH5-NEd8Uvp4Ks-NqrG-V3GkKrCJqCz3Cci3jrXU_rdn3Uil03d41eB4xluR_g8";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;
      
      const result = await permitGenerationModule._isPrivateKeyAllowed(privateKeyEncrypted, githubContextOrganizationId, githubContextRepositoryId);
      
      expect(result).toEqual(true);
    });

    it("Should return false if private key format is invalid", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");

      // format: "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID"
      // encrypted value: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80:0:2"
      const privateKeyEncrypted = "RIocCo0h_tMvLWieOZYPWzP7l7jVnVAno_QELfyUrRwVsN8aOHlx5hw5Be41bX74_Xaqef-gwTToXfdbgbqgLhLG0fxtw-QxKkWtzVnMlqO-WA2WVuaf3BpyiGFbVyyvFyFY_Q_O9gxY_F3xBPmHNfAwCPs";
      const githubContextOrganizationId = 1;
      const githubContextRepositoryId = 2;
      
      const result = await permitGenerationModule._isPrivateKeyAllowed(privateKeyEncrypted, githubContextOrganizationId, githubContextRepositoryId);
      
      expect(result).toEqual(false);
      expect(spyConsoleLog).toHaveBeenCalledWith("Invalid private key format");
    });
  });
});
