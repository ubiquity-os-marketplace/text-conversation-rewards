import { Static, Type } from "@sinclair/typebox";

export const dataCollectionConfigurationType = Type.Object(
  {
    /**
     * The maximum amount of retries on failure.
     */
    maxAttempts: Type.Number({ default: 10, minimum: 1, description: "The maximum amount of retries on failure" }),
    /**
     * The delay between each retry, in milliseconds.
     */
    delayMs: Type.Number({ default: 1000, minimum: 100, description: "The delay between each retry, in milliseconds" }),
  },
  { default: {} }
);

export type DataCollectionConfiguration = Static<typeof dataCollectionConfigurationType>;
