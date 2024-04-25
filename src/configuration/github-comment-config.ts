import { Static, Type } from "@sinclair/typebox";

const githubCommentConfigurationType = Type.Object({
  enabled: Type.Boolean({ default: true }),
  post: Type.Boolean({ default: true }),
  debug: Type.Boolean({ default: false }),
});

export type GithubCommentConfiguration = Static<typeof githubCommentConfigurationType>;

export default githubCommentConfigurationType;
