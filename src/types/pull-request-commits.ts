export interface PullRequestCommitsQuery {
  repository: {
    pullRequest: {
      commits: {
        edges: Array<{
          node: {
            commit: {
              oid: string;
              parents: {
                totalCount: number;
                nodes?: {
                  oid: string;
                }[];
              };
            };
          };
        }>;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
    } | null;
  } | null;
}
