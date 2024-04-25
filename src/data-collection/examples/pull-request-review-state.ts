// cspell:disable
import { GitHubPullRequestReviewState } from "../../github-types";

export const pullRequestReviewState: GitHubPullRequestReviewState = {
  id: 1901175611,
  node_id: "PRR_kwDOF4fVBs5xUaM7",
  user: {
    login: "rndquu",
    id: 119500907,
    node_id: "U_kgDOBx9waw",
    avatar_url: "https://avatars.githubusercontent.com/u/119500907?u=e09210950ab0571b2d06e06431d02db4e938db67&v=4",
    gravatar_id: "",
    url: "https://api.github.com/users/rndquu",
    html_url: "https://github.com/rndquu",
    followers_url: "https://api.github.com/users/rndquu/followers",
    following_url: "https://api.github.com/users/rndquu/following{/other_user}",
    gists_url: "https://api.github.com/users/rndquu/gists{/gist_id}",
    starred_url: "https://api.github.com/users/rndquu/starred{/owner}{/repo}",
    subscriptions_url: "https://api.github.com/users/rndquu/subscriptions",
    organizations_url: "https://api.github.com/users/rndquu/orgs",
    repos_url: "https://api.github.com/users/rndquu/repos",
    events_url: "https://api.github.com/users/rndquu/events{/privacy}",
    received_events_url: "https://api.github.com/users/rndquu/received_events",
    type: "User",
    site_admin: false,
  },
  body: "", // this represents the conclusion of the review's comment,
  // like normally when you add your comments to a batch and then
  // click approve, comment, or request changes at the end.
  // If there is a comment conversation happening (where you can resolve them)
  // then it is associated with every individual comment on the files view as well,
  // even though the body is an empty string, which is a bit confusing.
  state: "COMMENTED",
  html_url: "https://github.com/ubiquity/ubiquity-dollar/pull/904#pullrequestreview-1901175611",
  pull_request_url: "https://api.github.com/repos/ubiquity/ubiquity-dollar/pulls/904",
  author_association: "MEMBER",
  _links: {
    html: {
      href: "https://github.com/ubiquity/ubiquity-dollar/pull/904#pullrequestreview-1901175611",
    },
    pull_request: {
      href: "https://api.github.com/repos/ubiquity/ubiquity-dollar/pulls/904",
    },
  },
  submitted_at: "2024-02-26T15:21:14Z",
  commit_id: "694f5a119bd6e1197f9ae46219e5e7b556c580a4",
};
