/* eslint-disable */

module.exports = {
  paginateGraphQL() {
    return {
      graphql: {
        paginate(query, args) {
          return {
            repository: {
              issue: {
                closedByPullRequestsReferences: {
                  edges: [],
                },
              },
            },
          };
        },
      },
    };
  },
};
