// cspell:disable
import { GitHubPullRequestReviewComment } from "../../github-types";
export const pullRequestReviewComment: GitHubPullRequestReviewComment = {
  url: "https://api.github.com/repos/ubiquity/ubiquity-dollar/pulls/comments/1502796553",
  pull_request_review_id: 1901175611,
  id: 1502796553,
  node_id: "PRRC_kwDOF4fVBs5ZktsJ",
  diff_hunk:
    "@@ -321,6 +321,11 @@ library LibDiamond {\n" +
    "             _facetAddress != address(0),\n" +
    `             "LibDiamondCut: Can't remove function that doesn't exist"\n` +
    "         );\n" +
    "+        // precomputed bytes4(keccak256()) diamondCut function selector 0x1f931c1c to save gas\n" +
    "+        require(\n" +
    "+            _selector != bytes4(0x1f931c1c),",
  path: "packages/contracts/src/dollar/libraries/LibDiamond.sol",
  commit_id: "f81cdb2e9899283dd197489d629b01d32cdcddce",
  original_commit_id: "694f5a119bd6e1197f9ae46219e5e7b556c580a4",
  user: {
    login: "rndquu",
    id: 119500907,
    node_id: "U_kgDOBx9waw",
    avatar_url: "https://avatars.githubusercontent.com/u/119500907?v=4",
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
  body: "@gitcoindev  Can we make it explicit without hard to read magic bytes?",
  created_at: "2024-02-26T15:21:14Z",
  updated_at: "2024-02-26T15:21:14Z",
  html_url: "https://github.com/ubiquity/ubiquity-dollar/pull/904#discussion_r1502796553",
  pull_request_url: "https://api.github.com/repos/ubiquity/ubiquity-dollar/pulls/904",
  author_association: "MEMBER",
  _links: {
    self: {
      href: "https://api.github.com/repos/ubiquity/ubiquity-dollar/pulls/comments/1502796553",
    },
    html: {
      href: "https://github.com/ubiquity/ubiquity-dollar/pull/904#discussion_r1502796553",
    },
    pull_request: {
      href: "https://api.github.com/repos/ubiquity/ubiquity-dollar/pulls/904",
    },
  },
  reactions: {
    url: "https://api.github.com/repos/ubiquity/ubiquity-dollar/pulls/comments/1502796553/reactions",
    total_count: 1,
    "+1": 0,
    "-1": 0,
    laugh: 1,
    hooray: 0,
    confused: 0,
    heart: 0,
    rocket: 0,
    eyes: 0,
  },
  start_line: null,
  original_start_line: null,
  start_side: null,
  line: 327,
  original_line: 326,
  side: "RIGHT",
  original_position: 6,
  position: 7,
  subject_type: "line",
};
