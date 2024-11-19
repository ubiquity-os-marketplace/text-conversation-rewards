export const LINKED_PULL_REQUESTS = /* GraphQL */ `
  query collectLinkedPullRequests($owner: String!, $repo: String!, $issue_number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issue_number) {
        id
        closedByPullRequestsReferences(first: 10, includeClosedPrs: false, after: $cursor) {
          edges {
            node {
              id
              title
              number
              url
              state
              author {
                login
                ... on User {
                  id: databaseId
                }
              }
              repository {
                owner {
                  login
                }
                name
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

/**
 * Note: you cannot pass more than 100 node ids at once, otherwise the query will fail.
 */
export const QUERY_COMMENT_DETAILS = /* GraphQL */ `
  query commentDetails($node_ids: [ID!]!) {
    nodes(ids: $node_ids) {
      ... on IssueComment {
        id
        isMinimized
      }
    }
  }
`;
