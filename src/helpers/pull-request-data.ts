import { RestEndpointMethodTypes } from "@octokit/rest";
import { ContextPlugin } from "../types/plugin-input";
import { PullRequestCommitsQuery } from "../types/pull-request-commits";
import { PullRequestFilesQuery } from "../types/pull-request-files";
import { QUERY_PULL_REQUEST_COMMITS, QUERY_PULL_REQUEST_FILES } from "../types/requests";

type CommitFile = NonNullable<RestEndpointMethodTypes["repos"]["getCommit"]["response"]["data"]["files"]>[number];

export class PullRequestData {
  private readonly _fileMap = new Map<string, CommitFile>();
  private _pullCommits: RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"] = [];

  constructor(
    private _context: ContextPlugin,
    private _owner: string,
    private _repo: string,
    private _pullNumber: number
  ) {}

  public async fetchData() {
    const commitsData = await this._context.octokit.graphql.paginate<PullRequestCommitsQuery>(
      QUERY_PULL_REQUEST_COMMITS,
      {
        owner: this._owner,
        repo: this._repo,
        pull_number: this._pullNumber,
      }
    );
    const commitEdges = commitsData?.repository?.pullRequest?.commits?.edges || [];
    this._pullCommits = commitEdges
      .map((edge) => ({
        sha: edge.node.oid,
        parents: edge.node.commit.parents.nodes.map((n) => ({ sha: n.oid })),
      }))
      .filter(
        (commit) => commit.parents.length < 2
      ) as unknown as RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"];

    const filesData = await this._context.octokit.graphql.paginate<PullRequestFilesQuery>(QUERY_PULL_REQUEST_FILES, {
      owner: this._owner,
      repo: this._repo,
      pull_number: this._pullNumber,
    });
    const fileEdges = filesData?.repository?.pullRequest?.files?.edges || [];
    for (const edge of fileEdges) {
      const f = edge.node;
      if (!f.path) continue;
      if (!this._fileMap.has(f.path)) {
        this._fileMap.set(f.path, {
          filename: f.path,
          additions: f.additions,
          deletions: f.deletions,
          status: mapChangeTypeToStatus(f.changeType),
        } as CommitFile);
      }
    }
  }
  public get fileList(): ReadonlyArray<CommitFile> {
    return Object.freeze(Array.from(this._fileMap.values()));
  }

  public get pullCommits() {
    return this._pullCommits;
  }
}

function mapChangeTypeToStatus(changeType: string | undefined): string | undefined {
  switch (changeType) {
    case "ADDED":
      return "added";
    case "MODIFIED":
      return "modified";
    case "REMOVED":
      return "removed";
    case "RENAMED":
      return "renamed";
    default:
      return changeType?.toLowerCase();
  }
}
