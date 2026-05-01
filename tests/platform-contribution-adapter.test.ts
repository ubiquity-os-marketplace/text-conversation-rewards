import { CommentAssociation, CommentKind } from "../src/configuration/comment-types";
import {
  buildPlatformSpecification,
  normalizePlatformContributions,
  PlatformContributionInput,
} from "../src/helpers/platform-contribution-adapter";

describe("platform contribution adapter", () => {
  const input: PlatformContributionInput = {
    platform: "google-docs",
    specification: "Reward users based on edits that survive in the final launch plan.",
    contributors: [
      { id: "alice@example.com", displayName: "alice", githubUserId: 101, walletAddress: "0xalice" },
      { id: "bob@example.com", displayName: "bob" },
    ],
    contributions: [
      {
        id: "rev-1",
        authorId: "alice@example.com",
        body: "Added the launch-risk section.",
        url: "https://docs.example/revisions/rev-1",
        timestamp: "2026-01-01T00:00:00.000Z",
        kind: "revision",
        authorship: 0.65,
      },
      {
        id: "c-2",
        authorId: "bob@example.com",
        body: "Pointed out missing acceptance criteria.",
        kind: "comment",
      },
    ],
  };

  it("normalizes third-party contributions into the existing reward result shape", () => {
    const result = normalizePlatformContributions(input);

    expect(result.alice).toMatchObject({
      total: 0,
      userId: 101,
      walletAddress: "0xalice",
    });
    expect(result.alice.comments?.[0]).toMatchObject({
      platform: "google-docs",
      sourceContributionId: "rev-1",
      sourceKind: "revision",
      content: "Added the launch-risk section.",
      url: "https://docs.example/revisions/rev-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      commentType: CommentKind.ISSUE | CommentAssociation.CONTRIBUTOR,
      score: {
        multiplier: 1,
        reward: 0,
        authorship: 0.65,
      },
    });
    expect(result.bob.comments?.[0]).toMatchObject({
      platform: "google-docs",
      sourceContributionId: "c-2",
      url: "google-docs:c-2",
      score: {
        authorship: 1,
      },
    });
  });

  it("marks normalized specifications distinctly from other contributions", () => {
    const result = normalizePlatformContributions({
      ...input,
      contributions: [
        {
          id: "spec-1",
          authorId: "alice@example.com",
          body: "Drafted the initial product specification.",
          kind: "specification",
        },
      ],
    });

    expect(result.alice.comments?.[0].commentType).toBe(CommentKind.ISSUE | CommentAssociation.SPECIFICATION);
  });

  it("clamps authorship weights and exposes a portable specification object", () => {
    const result = normalizePlatformContributions({
      ...input,
      contributors: [{ id: "carol" }],
      contributions: [{ id: "rev-3", authorId: "carol", body: "Overweighted edit", authorship: 2 }],
    });

    expect(result.carol.comments?.[0].score?.authorship).toBe(1);
    expect(buildPlatformSpecification(input)).toEqual({
      body: "Reward users based on edits that survive in the final launch plan.",
      platform: "google-docs",
    });
  });
});
