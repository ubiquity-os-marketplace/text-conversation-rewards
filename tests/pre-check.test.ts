import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { http, HttpResponse } from "msw";
import { isUserAllowedToGenerateRewards } from "../src/helpers/permissions";
import { ContextPlugin } from "../src/types/plugin-input";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import "./helpers/permit-mock";

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
          assignees: [
            {
              id: 1,
              login: "gentlementlegen",
            },
            {
              id: 2,
              login: "0x4007",
            },
          ],
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
      commentHandler: {
        postComment: jest.fn(),
      },
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
          assignees: [
            {
              id: 1,
              login: "gentlementlegen",
            },
            {
              id: 2,
              login: "0x4007",
            },
          ],
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
      commentHandler: {
        postComment: jest.fn(),
      },
    } as unknown as ContextPlugin);

    expect(result).toEqual("You are not allowed to generate rewards.");
  });

  it("Should post a warning message that bots cannot trigger reward generation", async () => {
    jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
      collectLinkedMergedPulls: jest.fn(() => []),
    }));
    jest.unstable_mockModule("@ubiquity-os/plugin-sdk", () => ({
      postComment: jest.fn(),
    }));
    const { run } = await import("../src/run");

    const result = await run({
      eventName: "issues.closed",
      payload: {
        issue: {
          html_url: issueUrl,
          number: 1,
          state_reason: "completed",
          assignees: [
            {
              id: 1,
              login: "ubiquity-os",
            },
          ],
        },
        repository: {
          name: "conversation-rewards",
          owner: {
            login: "ubiquity-os",
            id: 76412717,
          },
        },
        sender: {
          login: "bot-user",
          type: "Bot",
        },
      },
      config: cfg,
      logger: new Logs("debug"),
      octokit: {
        rest: {
          orgs: {
            getMembershipForUser: jest.fn(() => {
              throw new Error();
            }),
          },
          repos: {
            getCollaboratorPermissionLevel: jest.fn(() => {
              return { data: { role_name: "read" } };
            }),
          },
        },
      },
      commentHandler: {
        postComment: jest.fn(),
      },
    } as unknown as ContextPlugin);

    expect(result).toEqual("Bots can not generate rewards.");
  });

  it("Should deny a user to generate rewards if non-admin and allow admins", async () => {
    const getMembershipForUser = jest.fn(() => ({}));
    const getCollaboratorPermissionLevel = jest.fn(() => ({
      data: {
        role_name: "read",
      },
    }));
    const ctx = {
      payload: {
        issue: {
          html_url: issueUrl,
          number: 1,
          state_reason: "completed",
          assignees: [
            {
              id: 1,
              login: "gentlementlegen",
            },
            {
              id: 2,
              login: "0x4007",
            },
          ],
        },
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
      commentHandler: {
        postComment: jest.fn(),
      },
    } as unknown as ContextPlugin;

    expect(await isUserAllowedToGenerateRewards(ctx)).toEqual(true);
    getMembershipForUser.mockImplementationOnce(() => {
      throw new Error();
    });
    expect(await isUserAllowedToGenerateRewards(ctx)).toEqual(false);
    getMembershipForUser.mockImplementationOnce(() => {
      throw new Error();
    });
    getCollaboratorPermissionLevel.mockImplementationOnce(() => {
      return { data: { role_name: "write" } };
    });
    expect(await isUserAllowedToGenerateRewards(ctx)).toEqual(true);
  });

  it("Should deny unknown commands and accept know commands", async () => {
    jest.unstable_mockModule("../src/issue-activity", () => ({
      IssueActivity: jest.fn(() => ({
        init: jest.fn(),
      })),
    }));
    const { run } = await import("../src/run");
    const payload = {
      comment: {
        body: "/finish",
      },
      issue: {
        html_url: issueUrl,
        number: 1,
        state_reason: "completed",
        assignees: [
          {
            id: 1,
            login: "gentlementlegen",
          },
          {
            id: 2,
            login: "0x4007",
          },
        ],
      },
      repository: {
        name: "conversation-rewards",
        owner: {
          login: "ubiquity-os",
          id: 76412717,
        },
      },
      sender: {
        login: "ubiquity-os",
      },
    };
    const ctx = {
      eventName: "issue_comment.created",
      payload,
      config: cfg,
      logger: new Logs("debug"),
      octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
      commentHandler: {
        postComment: jest.fn(),
      },
    } as unknown as ContextPlugin;

    let result = await run(ctx);
    expect(result).toEqual("No price label has been set. Skipping permit generation.");
    payload.comment.body = "/unknown";
    result = await run(ctx);
    expect(result).toEqual("/unknown is not a valid command, skipping.");
  });
});
