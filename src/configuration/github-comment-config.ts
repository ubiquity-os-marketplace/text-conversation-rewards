import { Static, Type } from "@sinclair/typebox";

const githubCommentConfigurationType = Type.Object({
  enabled: Type.Boolean({ default: true }),
  post: Type.Boolean({ default: true }),
});

export type GithubCommentConfiguration = Static<typeof githubCommentConfigurationType>;

export default githubCommentConfigurationType;
