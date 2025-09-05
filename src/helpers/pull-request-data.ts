import { ContextPlugin } from "../types/plugin-input";
import { RestEndpointMethodTypes } from "@octokit/rest";

type CommitFile = NonNullable<RestEndpointMethodTypes["repos"]["getCommit"]["response"]["data"]["files"]>[number];

export class PullRequestData {
  private readonly _fileList = new Set<CommitFile>();
  private _pullCommits: RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"] = [];

  constructor(
    private _context: ContextPlugin,
    private _owner: string,
    private _repo: string,
    private _pullNumber: number
  ) {}

  public async fetchData() {
    this._pullCommits = (
      await this._context.octokit.rest.pulls.listCommits({
        owner: this._owner,
        repo: this._repo,
        pull_number: this._pullNumber,
      })
    ).data.filter((commit) => commit.parents.length < 2); // This ignores merged commits

    for (const commit of this._pullCommits) {
      const changes = await this._context.octokit.rest.repos.getCommit({
        owner: this._owner,
        repo: this._repo,
        ref: commit.sha,
      });
      changes.data.files?.forEach((file) => {
        this._fileList.add(file);
      });
    }
  }

  public get fileList() {
    return this._fileList;
  }

  public get pullCommits() {
    return this._pullCommits;
  }
}
