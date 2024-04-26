import { http, HttpResponse } from "msw";
import issueGet from "./routes/issue-get.json";
import issueEventsGet from "./routes/issue-events-get.json";
import issueEvents2Get from "./routes/issue-events-2-get.json";
import issueCommentsGet from "./routes/issue-comments-get.json";
import issue25CommentsGet from "./routes/issue-25-comments-get.json";
import issueTimelineGet from "./routes/issue-timeline-get.json";
import pullsGet from "./routes/pulls-get.json";
import pullsReviewsGet from "./routes/pulls-reviews-get.json";
import pullsCommentsGet from "./routes/pulls-comments-get.json";
import { db } from "./db";

/**
 * Intercepts the routes and returns a custom payload
 */
export const handlers = [
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/22", () => {
    return HttpResponse.json(issueGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/events", ({ params: { page } }) => {
    return HttpResponse.json(!page ? issueEventsGet : issueEvents2Get);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/comments", () => {
    return HttpResponse.json(issueCommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/25/comments", () => {
    return HttpResponse.json(issue25CommentsGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/timeline", () => {
    return HttpResponse.json(issueTimelineGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/pulls/25", () => {
    return HttpResponse.json(pullsGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/pulls/25/reviews", () => {
    return HttpResponse.json(pullsReviewsGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/pulls/25/comments", () => {
    return HttpResponse.json(pullsCommentsGet);
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
      return HttpResponse.json("User was not found", { status: 404 });
    }
    return HttpResponse.json(user);
  }),
];
