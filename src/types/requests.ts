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

export const QUERY_COMMENT_DETAILS = /* GraphQL */ `
  query commentDetails($owner: String!, $repo: String!, $issue_number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      issueOrPullRequest(number: $issue_number) {
        ... on Issue {
          id
          comments(first: 100, after: $cursor) {
            nodes {
              id
              isMinimized
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
        ... on PullRequest {
          id
          comments(first: 100, after: $cursor) {
            nodes {
              id
              isMinimized
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  }
`;
