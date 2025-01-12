import { http, HttpResponse } from "msw";
import { db } from "./db";
import issue5Get from "./routes/issue-5-conversation-rewards/issue-5-get.json";
import issue22CommentsGet from "./routes/issue-22-comments-get.json";
import issue5EventsGet from "./routes/issue-5-conversation-rewards/issue-5-events-get.json";
import issue22Get from "./routes/issue-22-get.json";
import issue13Get from "./routes/issue-13-get.json";
import issue25CommentsGet from "./routes/issue-25-comments-get.json";
import issue69EventsGet from "./routes/issue-69-events-get.json";
import issue13EventsGet from "./routes/issue-13-events-get.json";
import issue69CommentsGet from "./routes/issue-69-comments-get.json";
import issue13CommentsGet from "./routes/issue-13-comments-get.json";
import issue69Get from "./routes/issue-69-get.json";
import issueEvents2Get from "./routes/issue-events-2-get.json";
import issueEventsGet from "./routes/issue-events-get.json";
import issue5CommentsGet from "./routes/issue-5-conversation-rewards/issue-5-comments-get.json";
import issue12CommentsGet from "./routes/pull-12-conversation-rewards/issue-12-comments-get.json";
import pull12Get from "./routes/pull-12-conversation-rewards/pull-12-get.json";
import pull12ReviewsGet from "./routes/pull-12-conversation-rewards/pull-12-reviews-get.json";
import pull12CommentsGet from "./routes/pull-12-conversation-rewards/pull-12-comments-get.json";
import issueTimelineGet from "./routes/issue-timeline-get.json";
import issue69TimelineGet from "./routes/issue-69-timeline-get.json";
import issue70CommentsGet from "./routes/issue-70-comments-get.json";
import pullsCommentsGet from "./routes/pulls-comments-get.json";
import issue5TimelineGet from "./routes/issue-5-conversation-rewards/issue-5-timeline-get.json";
import pullsGet from "./routes/pulls-get.json";
import pulls70Get from "./routes/issue-70-get.json";
import pullsReviewsGet from "./routes/pulls-reviews-get.json";

/**
 * Intercepts the routes and returns a custom payload
 */
export const handlers = [
  http.post("https://api.github.com/graphql", () => {
    return HttpResponse.json();
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
  http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/5/timeline", () => {
    return HttpResponse.json(issue5TimelineGet);
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
          role: "admin"
        }
      });
    } else if (username === "non-collaborator") {
      return HttpResponse.json({}, { status: 404 });
    }
    return HttpResponse.json({
      data: {
        role: "member"
      }
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
];
