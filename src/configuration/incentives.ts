import { StaticDecode, Type as T } from "@sinclair/typebox";
import { StandardValidator } from "typebox-validators";
import { contentEvaluatorConfigurationType } from "./content-evaluator-config";
import { dataCollectionConfigurationType } from "./data-collection-config";
import { dataPurgeConfigurationType } from "./data-purge-config";
import { formattingEvaluatorConfigurationType } from "./formatting-evaluator-config";
import { githubCommentConfigurationType } from "./github-comment-config";
import { permitGenerationConfigurationType } from "./permit-generation-configuration";
import { userExtractorConfigurationType } from "./user-extractor-config";

export const incentivesConfigurationSchema = T.Object({
  /**
   * Network ID to run in, default to 100
   */
  evmNetworkId: T.Number({ default: 100 }),
  /**
   * The encrypted key to use for permit generation
   */
  evmPrivateEncrypted: T.String(),
  /**
   * Reward token for ERC20 permits, default WXDAI for gnosis chain
   */
  erc20RewardToken: T.String({ default: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d" }),
  incentives: T.Object({
    /**
     * Enables or disables the incentive plugin
     */
    enabled: T.Boolean({ default: true }),
    /**
     * Optionally specify a file to write the results in
     */
    file: T.Optional(T.String()),
    /**
     * If set to true, the plugin runs even if the price label is missing, and will evaluate comments.
     */
    requirePriceLabel: T.Boolean({ default: true }),
    contentEvaluator: contentEvaluatorConfigurationType,
    userExtractor: userExtractorConfigurationType,
    dataPurge: dataPurgeConfigurationType,
    formattingEvaluator: formattingEvaluatorConfigurationType,
    permitGeneration: permitGenerationConfigurationType,
    githubComment: githubCommentConfigurationType,
  }),
  dataCollection: dataCollectionConfigurationType,
});

export const validateIncentivesConfiguration = new StandardValidator(incentivesConfigurationSchema);

export type IncentivesConfiguration = StaticDecode<typeof incentivesConfigurationSchema>;
