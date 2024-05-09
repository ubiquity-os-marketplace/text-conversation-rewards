import { Static, Type } from "@sinclair/typebox";

export const githubCommentConfigurationType = Type.Object({
  /**
   * Enables or disables this module
   */
  enabled: Type.Boolean({ default: true }),
  /**
   * Enables posting to the related GitHub Issue
   */
  post: Type.Boolean({ default: false }),
  /**
   * Enables debug by creating a local html file of the rendered comment
   */
  debug: Type.Boolean({ default: false }),
});

export type GithubCommentConfiguration = Static<typeof githubCommentConfigurationType>;
