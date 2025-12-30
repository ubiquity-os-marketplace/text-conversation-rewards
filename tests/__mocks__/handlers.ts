import { http, HttpResponse } from "msw";
import { db } from "./db";
import gqlPullCommits from "./results/gql-commits.json";
import issue100CommentsGet from "./routes/issue-100-comments-get.json";
import issue100Edits from "./routes/issue-100-edits.json";
import issue100EventsGet from "./routes/issue-100-events-get.json";
import issue100Get from "./routes/issue-100-get.json";
import issue100TimelineGet from "./routes/issue-100-timeline-get.json";
import issue13CommentsGet from "./routes/issue-13-comments-get.json";
import issue13EventsGet from "./routes/issue-13-events-get.json";
import issue13Get from "./routes/issue-13-get.json";
import issue22CommentsGet from "./routes/issue-22-comments-get.json";
import issue22Get from "./routes/issue-22-get.json";
import issue25CommentsGet from "./routes/issue-25-comments-get.json";
import issue5CommentsGet from "./routes/issue-5-conversation-rewards/issue-5-comments-get.json";
import issue5EventsGet from "./routes/issue-5-conversation-rewards/issue-5-events-get.json";
import issue5Get from "./routes/issue-5-conversation-rewards/issue-5-get.json";
import issue5TimelineGet from "./routes/issue-5-conversation-rewards/issue-5-timeline-get.json";
import issue69CommentsGet from "./routes/issue-69-comments-get.json";
import issue69EventsGet from "./routes/issue-69-events-get.json";
import issue69Get from "./routes/issue-69-get.json";
import issue69TimelineGet from "./routes/issue-69-timeline-get.json";
import issue70CommentsGet from "./routes/issue-70-comments-get.json";
import pulls70Get from "./routes/issue-70-get.json";
import issue71CommentsGet from "./routes/issue-71-comments-get.json";
import issue71EventsGet from "./routes/issue-71-events-get.json";
import issue71Get from "./routes/issue-71-get.json";
import issue71TimelineGet from "./routes/issue-71-timeline-get.json";
import issue71WorkUbqFiCommentsGet from "./routes/issue-71-work-ubq-fi-comments-get.json";
import issueEvents2Get from "./routes/issue-events-2-get.json";
import issueEventsGet from "./routes/issue-events-get.json";
import issueTimelineGet from "./routes/issue-timeline-get.json";
import issue101CommentsGet from "./routes/pull-101-work-ubq-fi/issue-101-comments-get.json";
import pull101CommentsGet from "./routes/pull-101-work-ubq-fi/pull-101-comments-get.json";
import pull101Get from "./routes/pull-101-work-ubq-fi/pull-101-get.json";
import pull101ReviewsGet from "./routes/pull-101-work-ubq-fi/pull-101-reviews-get.json";
import issue12CommentsGet from "./routes/pull-12-conversation-rewards/issue-12-comments-get.json";
import pull12CommentsGet from "./routes/pull-12-conversation-rewards/pull-12-comments-get.json";
import pull12Get from "./routes/pull-12-conversation-rewards/pull-12-get.json";
import pull12ReviewsGet from "./routes/pull-12-conversation-rewards/pull-12-reviews-get.json";
import pull71Get from "./routes/pull-71-work-ubq-fi/pull-71-get.json";
import pullsCommentsGet from "./routes/pulls-comments-get.json";
import pullsGet from "./routes/pulls-get.json";
import pullsReviewsGet from "./routes/pulls-reviews-get.json";
import issue12Get from "./routes/issue-12-get.json";
import issue12EventsGet from "./routes/issue-12-events-get.json";
import issue12TimelineGet from "./routes/issue-12-timeline-get.json";
import contentsPrettierignoreDevelopmentGet from "./routes/contents-prettierignore-development-get.json";
import contentsTsconfigDevelopmentGet from "./routes/contents-tsconfig-development-get.json";
import issue5ReactionsGet from "./routes/issue-5-reactions-get.json";
import issueComment2036516869ReactionsGet from "./routes/issue-comment-2036516869-reactions-get.json";
import issueComment2053332029ReactionsGet from "./routes/issue-comment-2053332029-reactions-get.json";
import issueComment2055783331ReactionsGet from "./routes/issue-comment-2055783331-reactions-get.json";
import pullComment1570133378ReactionsGet from "./routes/pull-comment-1570133378-reactions-get.json";
import pullComment1570591425ReactionsGet from "./routes/pull-comment-1570591425-reactions-get.json";
import pullComment1573413974ReactionsGet from "./routes/pull-comment-1573413974-reactions-get.json";
import pullComment1573733603ReactionsGet from "./routes/pull-comment-1573733603-reactions-get.json";
import pullComment1574427305ReactionsGet from "./routes/pull-comment-1574427305-reactions-get.json";
import pullComment1574702577ReactionsGet from "./routes/pull-comment-1574702577-reactions-get.json";
import pullComment1575659438ReactionsGet from "./routes/pull-comment-1575659438-reactions-get.json";
import pullComment1578040543ReactionsGet from "./routes/pull-comment-1578040543-reactions-get.json";
import pullComment1579556333ReactionsGet from "./routes/pull-comment-1579556333-reactions-get.json";

/**
 * Intercepts the routes and returns a custom payload
 */
export const handlers = [
  http.get("https://123-not-valid-url.com/", () => {
    return HttpResponse.error();
  }),
  http.post("https://api.github.com/graphql", async (args) => {
    // Check if this is a request for issue edits
    const body = await args.request.text();
    if (body.includes("IssueEdits") && body.includes("userContentEdits")) {
      return HttpResponse.json({ data: issue100Edits });
    } else if (body.includes("collectLinkedIssues")) {
      return HttpResponse.json({
        data: {
          repository: {
            pullRequest: {
              closingIssuesReferences: {
                edges: [
                  {
                    node: {
                      author: { login: "0x4007" },
                      repository: { name: "conversation-rewards" },
                      labels: {
                        nodes: [{ name: "Time: <1 Hour" }, { name: "Priority: 3 (High)" }, { name: "Price: 150 USD" }],
                      },
                    },
                  },
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: "Y",
                },
              },
            },
          },
        },
      });
    }
    return HttpResponse.json(gqlPullCommits);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/5", () => {
    return HttpResponse.json(issue5Get);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/5/events", () => {
    return HttpResponse.json(issue5EventsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/5/comments", () => {
    return HttpResponse.json(issue5CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/12/comments", () => {
    return HttpResponse.json(issue12CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/12", () => {
    return HttpResponse.json(issue12Get);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/12/events", () => {
    return HttpResponse.json(issue12EventsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/12/timeline", () => {
    return HttpResponse.json(issue12TimelineGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/5/timeline", () => {
    return HttpResponse.json(issue5TimelineGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/5/reactions", () => {
    return HttpResponse.json(issue5ReactionsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/comments/:commentId/reactions", ({ params }) => {
    const commentId = params.commentId.toString();
    if (commentId === "2036516869") return HttpResponse.json(issueComment2036516869ReactionsGet);
    if (commentId === "2053332029") return HttpResponse.json(issueComment2053332029ReactionsGet);
    if (commentId === "2055783331") return HttpResponse.json(issueComment2055783331ReactionsGet);
    return HttpResponse.json(
      {
        error: "Missing MSW fixture for issue comment reactions",
        commentId,
      },
      { status: 500 }
    );
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/pulls/comments/:commentId/reactions", ({ params }) => {
    const commentId = params.commentId.toString();
    if (commentId === "1570133378") return HttpResponse.json(pullComment1570133378ReactionsGet);
    if (commentId === "1570591425") return HttpResponse.json(pullComment1570591425ReactionsGet);
    if (commentId === "1573413974") return HttpResponse.json(pullComment1573413974ReactionsGet);
    if (commentId === "1573733603") return HttpResponse.json(pullComment1573733603ReactionsGet);
    if (commentId === "1574427305") return HttpResponse.json(pullComment1574427305ReactionsGet);
    if (commentId === "1574702577") return HttpResponse.json(pullComment1574702577ReactionsGet);
    if (commentId === "1575659438") return HttpResponse.json(pullComment1575659438ReactionsGet);
    if (commentId === "1578040543") return HttpResponse.json(pullComment1578040543ReactionsGet);
    if (commentId === "1579556333") return HttpResponse.json(pullComment1579556333ReactionsGet);
    return HttpResponse.json(
      {
        error: "Missing MSW fixture for pull comment reactions",
        commentId,
      },
      { status: 500 }
    );
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/71", () => {
    return HttpResponse.json(issue71Get);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/71/events", () => {
    return HttpResponse.json(issue71EventsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/71/comments", () => {
    return HttpResponse.json(issue71CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/71/timeline", () => {
    return HttpResponse.json(issue71TimelineGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/pulls/12", () => {
    return HttpResponse.json(pull12Get);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/pulls/12/reviews", () => {
    return HttpResponse.json(pull12ReviewsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/pulls/12/comments", () => {
    return HttpResponse.json(pull12CommentsGet);
  }),
  http.get("https://api.github.com/repos/Meniole/conversation-rewards/issues/13", () => {
    return HttpResponse.json(issue13Get);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22", () => {
    return HttpResponse.json(issue22Get);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69", () => {
    return HttpResponse.json(issue69Get);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/100", () => {
    return HttpResponse.json(issue100Get);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/100/events", () => {
    return HttpResponse.json(issue100EventsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/100/comments", () => {
    return HttpResponse.json(issue100CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/100/timeline", () => {
    return HttpResponse.json(issue100TimelineGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/comment-incentives", () => {
    return HttpResponse.json(issue22Get);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/events", ({ params: { page } }) => {
    return HttpResponse.json(!page ? issueEventsGet : issueEvents2Get);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69/events", () => {
    return HttpResponse.json(issue69EventsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/comments", () => {
    return HttpResponse.json(issue22CommentsGet);
  }),
  http.get("https://api.github.com/repos/Meniole/conversation-rewards/issues/13/events", () => {
    return HttpResponse.json(issue13EventsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69/comments", () => {
    return HttpResponse.json(issue69CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/comment-incentives/issues/25/comments", () => {
    return HttpResponse.json(issue25CommentsGet);
  }),
  http.get("https://api.github.com/repos/Meniole/conversation-rewards/issues/13/comments", () => {
    return HttpResponse.json(issue13CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/timeline", () => {
    return HttpResponse.json(issueTimelineGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69/timeline", () => {
    return HttpResponse.json(issue69TimelineGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/comment-incentives/pulls/25", () => {
    return HttpResponse.json(pullsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/comment-incentives/pulls/25/reviews", () => {
    return HttpResponse.json(pullsReviewsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/comment-incentives/pulls/25/comments", () => {
    return HttpResponse.json(pullsCommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/pulls/70", () => {
    return HttpResponse.json(pulls70Get);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/pulls/70/reviews", () => {
    return HttpResponse.json(pullsReviewsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/pulls/70/comments", () => {
    return HttpResponse.json([]);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/70/comments", () => {
    return HttpResponse.json(issue70CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/pulls/71", () => {
    return HttpResponse.json(pull71Get);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/pulls/71/reviews", () => {
    return HttpResponse.json(pullsReviewsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/pulls/71/comments", () => {
    return HttpResponse.json([]);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/71/comments", () => {
    return HttpResponse.json(issue71WorkUbqFiCommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/pulls/101", () => {
    return HttpResponse.json(pull101Get);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/pulls/101/reviews", () => {
    return HttpResponse.json(pull101ReviewsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/pulls/101/comments", () => {
    return HttpResponse.json(pull101CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/101/comments", () => {
    return HttpResponse.json(issue101CommentsGet);
  }),
  http.get("https://api.github.com/users/:login", ({ params: { login } }) => {
    const user = db.users.findFirst({
      where: {
        login: {
          equals: login.toString(),
        },
      },
    });
    if (!user) {
      return HttpResponse.json("[mock] User was not found", { status: 404 });
    }
    return HttpResponse.json(user);
  }),
  http.get("https://api.github.com/orgs/:org/memberships/:username", ({ params }) => {
    const { username } = params;

    if (username === "0x4007") {
      return HttpResponse.json({
        data: {
          role: "admin",
        },
      });
    } else if (username === "non-collaborator") {
      return HttpResponse.json({}, { status: 404 });
    }
    return HttpResponse.json({
      data: {
        role: "member",
      },
    });
  }),
  http.post("https://api.github.com/app/installations/48381972/access_tokens", () => {
    return HttpResponse.json({});
  }),
  http.get("https://wfzpewmlyiozupulbuur.supabase.co/rest/v1/users", ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const userId = Number((id as string).match(/\d+/)?.[0]);
    const user = db.users.findFirst({
      where: {
        id: {
          equals: userId,
        },
      },
    });
    if (!user) {
      return HttpResponse.json("User not found", { status: 404 });
    }
    return HttpResponse.json(user);
  }),
  http.get("https://wfzpewmlyiozupulbuur.supabase.co/rest/v1/locations", ({ request }) => {
    const url = new URL(request.url);
    const issue = url.searchParams.get("issue_id");
    const node = url.searchParams.get("node_url");
    if (!issue) {
      return HttpResponse.json(db.locations.findMany({}));
    }
    const issueId = Number((issue as string).match(/\d+/)?.[0]);
    const nodeUrl = (node as string).match(/https.+/)?.[0];
    const location = db.locations.findFirst({
      where: {
        node_url: {
          equals: nodeUrl,
        },
        issue_id: {
          equals: issueId,
        },
      },
    });
    if (!location) {
      return HttpResponse.json("Location not found", { status: 404 });
    }
    return HttpResponse.json(location);
  }),
  http.post("https://wfzpewmlyiozupulbuur.supabase.co/rest/v1/locations", async ({ request }) => {
    const data = await request.json();
    if (!data) {
      return HttpResponse.error();
    }
    const createdLocation = db.locations.create(data as Record<string, string>);
    return HttpResponse.json(createdLocation);
  }),
  http.post("https://wfzpewmlyiozupulbuur.supabase.co/rest/v1/permits", async ({ request }) => {
    const data = (await request.json()) as Record<string, string | number>;
    if (!data) {
      return HttpResponse.error();
    }
    data.id = db.permits.count() + 1;
    const createdPermit = db.permits.create(data);
    return HttpResponse.json(createdPermit);
  }),
  http.post("https://api.github.com/repos/:owner/:repo/issues/:id/comments", () => {
    return HttpResponse.json({});
  }),
  http.get("https://api.github.com/repos/:owner/:repo/collaborators/:user/permission", () => {
    return HttpResponse.json({
      role_name: "admin",
    });
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/contents/.gitattributes", () => {
    return HttpResponse.json({
      data: {
        content: Buffer.from(
          "dist/** linguist-generated\nbun.lockb linguist-generated\nbun.lock linguist-generated\ntest/__mocks__/ linguist-generated"
        ).toString("base64"),
      },
    });
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/contents/.prettierignore", () => {
    return HttpResponse.json(contentsPrettierignoreDevelopmentGet);
  }),
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/contents/tsconfig.json", () => {
    return HttpResponse.json(contentsTsconfigDevelopmentGet);
  }),
];
