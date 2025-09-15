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
      // We need to manually paginate because the API acts differently for getCommits.
      // https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#get-a-commit
      await this.fetchCommitFiles(commit.sha);
    }
  }

  public get fileList(): ReadonlyArray<PullRequestFile> {
    return Object.freeze(Array.from(this._fileMap.values()));
  }

  public get pullCommits(): ReadonlyArray<LightweightCommit> {
    return this._pullCommits;
  }

  private async fetchCommitFiles(sha: string) {
    let page = 1;
    let shouldLoop: boolean;
    do {
      const { files, link } = await this.fetchCommitPage(sha, page);
      for (const file of files) {
        this.addFileIfNew(file);
      }
      shouldLoop = this.shouldContinue(link, files.length);
      if (shouldLoop) {
        page += 1;
      }
    } while (shouldLoop);
  }

  private addFileIfNew(file: PullRequestFile) {
    if (!file.filename) return;
    if (!this._fileMap.has(file.filename)) this._fileMap.set(file.filename, file);
  }

  private async fetchCommitPage(sha: string, page: number) {
    const response = await this._context.octokit.rest.repos.getCommit({
      owner: this._owner,
      repo: this._repo,
      ref: sha,
      per_page: 100,
      page,
    });
    const files = response.data.files || [];
    this._context.logger.debug("Fetched changes page for commit", {
      sha,
      page,
      fileCount: files.length,
      url: response.data.url,
    });
    return { files, link: response.headers.link };
  }

  private shouldContinue(link: string | undefined, fileCount: number) {
    return !!(link && fileCount);
  }
}
