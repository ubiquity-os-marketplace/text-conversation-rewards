import { RestEndpointMethodTypes } from "@octokit/rest";
import { ContextPlugin } from "../types/plugin-input";

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
    this._pullCommits = (
      await this._context.octokit.rest.pulls.listCommits({
        owner: this._owner,
        repo: this._repo,
        pull_number: this._pullNumber,
      })
    ).data.filter((commit) => commit.parents.length < 2); // This ignores merged commits

    const files = await this._context.octokit.rest.pulls.listFiles({
      owner: this._owner,
      repo: this._repo,
      pull_number: this._pullNumber,
    });
    files?.data.forEach((file) => {
      if (!file.filename) return;
      if (!this._fileMap.has(file.filename)) {
        this._fileMap.set(file.filename, file);
      }
    });
    // for (const commit of this._pullCommits) {
    //   const changes = await this._context.octokit.rest.repos.getCommit({
    //     owner: this._owner,
    //     repo: this._repo,
    //     ref: commit.sha,
    //   });
    //
    //   files?.data.forEach((file) => {
    //     if (!file.filename) return;
    //     if (!this._fileMap.has(file.filename)) {
    //       this._fileMap.set(file.filename, file);
    //     }
    //   });
    // }
  }

  public get fileList(): ReadonlyArray<CommitFile> {
    return Object.freeze(Array.from(this._fileMap.values()));
  }

  public get pullCommits() {
    return this._pullCommits;
  }
}
