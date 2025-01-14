import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { http, HttpResponse } from "msw";
import { ContextPlugin } from "../src/types/plugin-input";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { isUserAllowedToGeneratePermits } from "../src/helpers/permissions";

const issueUrl = "https://github.com/ubiquity/work.ubq.fi/issues/69";

jest.unstable_mockModule("@actions/github", () => {
  const context = {
    runId: "1",
    payload: {
      repository: {
        html_url: "https://github.com/ubiquity-os/conversation-rewards",
      },
    },
  };
  return {
    default: {
      context,
    },
    context,
  };
});

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Pre-check tests", () => {
  beforeEach(async () => {
    drop(db);
    for (const table of Object.keys(dbSeed)) {
      const tableName = table as keyof typeof dbSeed;
      for (const row of dbSeed[tableName]) {
        db[tableName].create(row);
      }
    }
    jest.resetModules();
    jest.resetAllMocks();
  });

  it("Should reopen the issue and not generate rewards if linked pull-requests are still open", async () => {
    jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
      collectLinkedMergedPulls: jest.fn(() => [
        {
          id: "PR_kwDOKzVPS85zXUoj",
          title: "fix: add state to sorting manager for bottom and top",
          number: 70,
          url: "https://github.com/ubiquity/work.ubq.fi/pull/70",
          state: "OPEN",
          author: {
            login: "0x4007",
            id: 4975670,
          },
          repository: {
            owner: {
              login: "ubiquity",
            },
            name: "work.ubq.fi",
          },
        },
        {
          id: "PR_kwDOKzVPS85zXUok",
          title: "fix: add state to sorting manager for bottom and top 2",
          number: 71,
          url: "https://github.com/ubiquity/work.ubq.fi/pull/71",
          state: "MERGED",
          author: {
            login: "0x4007",
            id: 4975670,
          },
          repository: {
            owner: {
              login: "ubiquity",
            },
            name: "work.ubq.fi",
          },
        },
      ]),
    }));
    const patchMock = jest.fn(() => HttpResponse.json({}));
    server.use(http.patch("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69", patchMock, { once: true }));
    const { run } = await import("../src/run");
    const result = await run({
      eventName: "issues.closed",
      payload: {
        issue: {
          html_url: issueUrl,
          number: 1,
          state_reason: "completed",
        },
        repository: {
          name: "conversation-rewards",
          owner: {
            login: "ubiquity-os",
            id: 76412717,
          },
        },
      },
      config: cfg,
      logger: new Logs("debug"),
      octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
    } as unknown as ContextPlugin);
    expect(result).toEqual("All linked pull requests must be closed to generate rewards.");
    expect(patchMock).toHaveBeenCalled();
  });

  it("Should not generate a permit if non-collaborator user is merging / closing the issue", async () => {
    jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
      collectLinkedMergedPulls: jest.fn(() => []),
    }));
    const patchMock = jest.fn(() => HttpResponse.json({}));
    server.use(
      http.patch("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69", patchMock, { once: true }),
      http.get(
        "https://api.github.com/repos/:owner/:repo/collaborators/:user/permission",
        () => {
          return HttpResponse.json({
            role_name: "read",
          });
        },
        { once: true }
      )
    );
    const { run } = await import("../src/run");

    const result = await run({
      eventName: "issues.closed",
      payload: {
        issue: {
          html_url: issueUrl,
          number: 1,
          state_reason: "completed",
        },
        repository: {
          name: "conversation-rewards",
          owner: {
            login: "ubiquity-os",
            id: 76412717,
          },
        },
        sender: {
          login: "non-collaborator",
        },
      },
      config: cfg,
      logger: new Logs("debug"),
      octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
    } as unknown as ContextPlugin);

    expect(result).toEqual("You are not allowed to generate permits.");
  });

  it("Should deny a user to generate permits if non-admin and allow admins", async () => {
    const getMembershipForUser = jest.fn(() => ({}));
    const getCollaboratorPermissionLevel = jest.fn(() => ({
      data: {
        role_name: "read",
      },
    }));
    const ctx = {
      payload: {
        sender: {
          login: "ubiquity-os",
        },
        repository: {
          owner: {
            login: "ubiquity-os-marketplace",
          },
        },
      },
      logger: new Logs("debug"),
      octokit: {
        rest: {
          orgs: {
            getMembershipForUser,
          },
          repos: {
            getCollaboratorPermissionLevel,
          },
        },
      },
    } as unknown as ContextPlugin;

    expect(await isUserAllowedToGeneratePermits(ctx)).toEqual(true);
    getMembershipForUser.mockImplementationOnce(() => {
      throw new Error();
    });
    expect(await isUserAllowedToGeneratePermits(ctx)).toEqual(false);
    getMembershipForUser.mockImplementationOnce(() => {
      throw new Error();
    });
    getCollaboratorPermissionLevel.mockImplementationOnce(() => {
      return { data: { role_name: "write" } };
    });
    expect(await isUserAllowedToGeneratePermits(ctx)).toEqual(true);
  });
});
