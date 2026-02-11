 
const gqlPullCommits = require("../results/gql-commits.json");
const issue100Edits = require("../routes/issue-100-edits.json");

const linkedPullRequests = {
  repository: {
    issue: {
      closedByPullRequestsReferences: {
        edges: [
          {
            node: {
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
          },
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: "Y",
        },
      },
    },
  },
};

const linkedIssues = {
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
};

function resolveGraphqlResponse(query, variables) {
  if (typeof query === "string") {
    if (query.includes("collectLinkedIssues")) {
      return linkedIssues;
    }
    if (query.includes("collectLinkedPullRequests")) {
      return linkedPullRequests;
    }
    if (query.includes("IssueEdits") || query.includes("userContentEdits")) {
      return issue100Edits;
    }
    if (query.includes("commentDetails")) {
      const nodeIds = variables?.node_ids ?? [];
      return {
        nodes: nodeIds.map((id) => ({ id, isMinimized: false })),
      };
    }
    if (query.includes("PullRequestCommits")) {
      return gqlPullCommits.data ?? gqlPullCommits;
    }
  }
  return gqlPullCommits.data ?? gqlPullCommits;
}

function createMockGraphql() {
  const graphql = (query, variables) => Promise.resolve(resolveGraphqlResponse(query, variables));
  graphql.paginate = (query, variables) => Promise.resolve(resolveGraphqlResponse(query, variables));
  return graphql;
}

module.exports = {
  paginateGraphQL(octokit) {
    const graphql = typeof octokit?.graphql === "function" ? octokit.graphql : createMockGraphql();
    if (typeof graphql.paginate !== "function") {
      graphql.paginate = (query, variables) => Promise.resolve(resolveGraphqlResponse(query, variables));
    }
    return { graphql };
  },
};
