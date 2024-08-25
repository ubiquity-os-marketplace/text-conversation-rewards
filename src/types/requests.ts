export const LINKED_PULL_REQUESTS = /* GraphQL */ `
  query collectLinkedPullRequests($owner: String!, $repo: String!, $issue_number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issue_number) {
        id
        closedByPullRequestsReferences(first: 10, includeClosedPrs: true, after: $cursor) {
          edges {
            node {
              id
              title
              number
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
