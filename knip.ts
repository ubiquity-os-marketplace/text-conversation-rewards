import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/index.ts", "src/web/api/index.ts"],
  project: ["src/**/*.ts"],
  ignore: ["src/data-collection/examples/*.ts", "src/configuration/common-config-type.ts", "dist/**"],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: ["ts-node", "msw", "@mswjs/data", "@uniswap/permit2-sdk"],
  jest: {
    config: ["jest.config.ts"],
    entry: ["src/**/*.test.ts"],
  },
};

export default config;
