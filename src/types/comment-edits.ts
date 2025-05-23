export type UserContentEdits = {
  nodes: {
    createdAt: string;
    editedAt: string;
    diff: string;
    editor: {
      login: string;
    };
  }[];
};

export type IssueEdits = {
  repository: {
    issue: {
      userContentEdits: UserContentEdits;
    };
  };
};

export const QUERY_ISSUE_EDITS = /* GraphQL */ `
  query IssueEdits($owner: String!, $repo: String!, $issue_number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issue_number) {
        userContentEdits(first: 100, after: $cursor) {
          nodes {
            createdAt
            editedAt
            diff
            editor {
              login
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
