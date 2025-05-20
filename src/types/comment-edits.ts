export const QUERY_ISSUE_EDITS = /* GraphQL */ `
  query IssueEdits($owner: String!, $repo: String!, $issue_number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issue_number) {
        userContentEdits(first: 100, after: $cursor) {
          nodes {
            createdAt
            diff
            editor {
              ... on Bot {
                botLogin: login
              }
              ... on User {
                login
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
