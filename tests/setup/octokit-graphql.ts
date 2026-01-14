import { jest } from "@jest/globals";

jest.mock("@ubiquity-os/plugin-sdk/octokit", () => {
  const actual = jest.requireActual("@ubiquity-os/plugin-sdk/octokit");

  class MockOctokit extends actual.customOctokit {
    constructor(...args: ConstructorParameters<typeof actual.customOctokit>) {
      super(...args);

      const graphql = (this as { graphql?: unknown }).graphql as {
        paginate?: unknown;
      };

      if (typeof graphql !== "function") {
        const graphqlFn = Object.assign(jest.fn(), { paginate: jest.fn() });
        // @ts-expect-error - test-only shim for graphql paginate
        this.graphql = graphqlFn;
      } else if (typeof graphql.paginate !== "function") {
        graphql.paginate = jest.fn();
      }
    }
  }

  return { ...actual, customOctokit: MockOctokit };
});
