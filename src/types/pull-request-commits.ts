export interface PullRequestCommitsQuery {
  repository: {
    pullRequest: {
      commits: {
        edges: Array<{
          node: {
            oid: string;
            commit: {
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
