import { http, HttpResponse } from "msw";
import issueGet from "./issue-get.json";
import issueEventsGet from "./issue-events-get.json";
import issueCommentsGet from "./issue-comments-get.json";
import issueTimelineGet from "./issue-timeline-get.json";
import pullsGet from "./pulls-get.json";
import pullsReviewsGet from "./pulls-reviews-get.json";
import pullsCommentsGet from "./pulls-comments-get.json";

/**
 * Intercepts the routes and returns a custom payload
 */
export const handlers = [
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/22", () => {
    return HttpResponse.json(issueGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/events", () => {
    return HttpResponse.json(issueEventsGet);
  }),
  http.get("https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/comments", () => {
    return HttpResponse.json(issueCommentsGet);
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
];
