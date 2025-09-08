import { ContextPlugin } from "../types/plugin-input";
import { PullRequestCommitsQuery } from "../types/pull-request-commits";
import { QUERY_PULL_REQUEST_COMMITS } from "../types/requests";

interface LightweightCommit {
  sha: string;
  parentCount: number;
  parents?: {
    sha: string;
  }[];
}
interface PullRequestFile {
  filename: string;
  additions: number;
  deletions: number;
  status?: string;
}

export class PullRequestData {
  private readonly _fileMap = new Map<string, PullRequestFile>();
  private _pullCommits: LightweightCommit[] = [];

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
        sha: edge.node.commit.oid,
        parentCount: edge.node.commit.parents.totalCount,
        parents: edge.node.commit.parents.nodes?.map((p) => ({ sha: p.oid })),
      }))
      .filter((commit) => commit.parentCount < 2);

    for (const commit of this._pullCommits) {
      const changes = await this._context.octokit.rest.repos.getCommit({
        owner: this._owner,
        repo: this._repo,
        ref: commit.sha,
      });
      if (changes.headers.link) {
        console.log("paginate");
      }
      this._context.logger.debug("Fetched changes for commit", {
        url: changes.data.url,
        files: changes.data.files?.map((o) => o.filename),
      });
      changes.data.files?.forEach((file) => {
        if (!file.filename) return;
        if (!this._fileMap.has(file.filename)) {
          this._fileMap.set(file.filename, file);
        }
      });
    }
  }
  public get fileList(): ReadonlyArray<PullRequestFile> {
    return Object.freeze(Array.from(this._fileMap.values()));
  }

  public get pullCommits(): ReadonlyArray<LightweightCommit> {
    return this._pullCommits;
  }
}
