import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/index.ts", "scripts/**/*.ts"],
  project: ["**/*.{js,ts}", "!dist/**", "!src/web/dist/**"],
  ignore: ["src/data-collection/examples/*.ts", "src/configuration/common-config-type.ts", "dist/**"],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: ["@uniswap/permit2-sdk", "@octokit/plugin-paginate-graphql"],
  jest: {
    config: ["jest.config.ts"],
    entry: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
};

export default config;
