import { Static, Type } from "@sinclair/typebox";

export const githubCommentConfigurationType = Type.Object(
  {
    /**
     * Enables posting to the related GitHub Issue
     */
    post: Type.Boolean({ default: true, description: "Enables posting to the related GitHub Issue" }),
    /**
     * Enables debug by creating a local html file of the rendered comment
     */
    debug: Type.Boolean({
      default: false,
      description: "Enables debug by creating a local html file of the rendered comment",
    }),
  },
  { default: {} }
);

export type GithubCommentConfiguration = Static<typeof githubCommentConfigurationType>;
