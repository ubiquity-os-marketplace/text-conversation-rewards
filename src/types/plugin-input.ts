import { StaticDecode, Type as T } from "@sinclair/typebox";
import { Context } from "@ubiquity-os/plugin-sdk";
import { createAdapters } from "../adapters";
import { contentEvaluatorConfigurationType } from "../configuration/content-evaluator-config";
import { dataCollectionConfigurationType } from "../configuration/data-collection-config";
import { dataPurgeConfigurationType } from "../configuration/data-purge-config";
import { eventIncentivesConfigurationType } from "../configuration/event-incentives-config";
import { externalContentConfigurationType } from "../configuration/external-content-config";
import { formattingEvaluatorConfigurationType } from "../configuration/formatting-evaluator-config";
import { githubCommentConfigurationType } from "../configuration/github-comment-config";
import { paymentConfigurationType } from "../configuration/payment-configuration";
import { reviewIncentivizerConfigurationType } from "../configuration/review-incentivizer-config";
import { simplificationIncentivizerConfigurationType } from "../configuration/simplification-incentivizer-config";
import { userExtractorConfigurationType } from "../configuration/user-extractor-config";
import { Command } from "./command";
import { EnvConfig } from "./env-type";

const rewardSettingsType = T.Object(
  {
    evmNetworkId: T.Number({
      default: 100,
      description: "Network ID to run in, default to 100",
      examples: ["100"],
    }),
    evmPrivateEncrypted: T.String({
      description: "The encrypted Ethereum private key to use for funding rewards.",
      examples: ["0x000..."],
    }),
    erc20RewardToken: T.String({ default: "0xC6ed4f520f6A4e4DC27273509239b7F8A68d2068" }),
  },
  { additionalProperties: false }
);

const rewardRoleSettingsType = T.Partial(
  T.Object(
    {
      admin: rewardSettingsType,
      collaborator: rewardSettingsType,
      contributor: rewardSettingsType,
      billingManager: rewardSettingsType,
    },
    { additionalProperties: false }
  ),
  { default: {} }
);

export const pluginSettingsSchema = T.Object(
  {
    rewards: T.Optional(T.Union([rewardSettingsType, rewardRoleSettingsType])),
    incentives: T.Object(
      {
        closeTaskReward: T.Object(
          {
            rewardAmount: T.Number({
              default: 5,
              description: "Reward amount that the user should get on closing a stale task",
            }),
            stalenessDuration: T.String({
              default: "30 days",
              description: "Minimum time an issue must stay open before the close-task reward applies",
            }),
          },
          { default: {} }
        ),
        shouldProcessUnlinkedPullRequests: T.Boolean({
          default: false,
          description: "Should pull-requests that are not linked to an issue be processed?",
        }),
        /**
         * Optionally, specify a file to write the results in
         */
        file: T.Optional(
          T.String({ description: "Specify a file to write the results in", examples: ["./result.json"] })
        ),
        /**
         * If set to false, the plugin runs even if the price label is missing.
         * If set to 'auto', it will attempt to fetch the price from an external API if no price label is found.
         * If set to true (default), the plugin requires a price label to be present.
         */
        requirePriceLabel: T.Union([T.Boolean(), T.Literal("auto")], {
          default: true,
          description:
            "If set to false, the plugin runs even if the price label is missing. If set to 'auto', it will attempt to fetch the price from an external API if no price label is found. If set to true (default), the plugin requires a price label to be present.",
        }),
        limitRewards: T.Boolean({
          default: true,
          description: "Should the rewards of non-assignees be limited to the task reward?",
        }),
        collaboratorOnlyPaymentInvocation: T.Boolean({
          default: true,
          description: "If false, will allow contributors to generate permits.",
        }),
        contentEvaluator: T.Union([contentEvaluatorConfigurationType, T.Null()], { default: null }),
        userExtractor: T.Union([userExtractorConfigurationType, T.Null()], { default: null }),
        dataPurge: T.Union([dataPurgeConfigurationType, T.Null()], { default: null }),
        reviewIncentivizer: T.Union([reviewIncentivizerConfigurationType, T.Null()], { default: null }),
        eventIncentives: T.Union([eventIncentivesConfigurationType, T.Null()], { default: null }),
        simplificationIncentivizer: T.Union([simplificationIncentivizerConfigurationType, T.Null()], { default: null }),
        formattingEvaluator: T.Union([formattingEvaluatorConfigurationType, T.Null()], { default: null }),
        payment: T.Union([paymentConfigurationType, T.Null()], { default: null }),
        githubComment: T.Union([githubCommentConfigurationType, T.Null()], { default: null }),
        specialUsers: T.Array(
          T.Array(
            T.String({
              minLength: 1,
              description:
                "GitHub login treated as equivalent to the other members of the same group when matching issue assignees to pull request authors.",
              examples: ["Copilot", "copilot-swe-agent"],
            }),
            {
              minItems: 1,
              description:
                "Logins that belong to the same group of interchangeable special users. Place all aliases for the same person or role in a single group.",
            }
          ),
          {
            default: [["Copilot", "copilot-swe-agent"]],
            description:
              "Optional alias groups for users whose logins should be treated as interchangeable when validating linked pull requests. Use this when a contributor appears under one login on the issue and another on the pull request, but they represent the same special user.",
          }
        ),
        externalContent: T.Union([externalContentConfigurationType, T.Null()], { default: null }),
      },
      { default: {} }
    ),
    dataCollection: dataCollectionConfigurationType,
  },
  { default: {} }
);

export type RewardSettings = StaticDecode<typeof rewardSettingsType>;
export type RewardRoleSettings = StaticDecode<typeof rewardRoleSettingsType>;
export type RewardConfiguration = RewardSettings | RewardRoleSettings;

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;

export type SupportedEvents = "issues.closed" | "issue_comment.created" | "pull_request.closed";
export type ContextPlugin<T extends SupportedEvents = SupportedEvents> = Context<
  PluginSettings,
  EnvConfig,
  Command,
  T
> & {
  adapters: ReturnType<typeof createAdapters>;
};
