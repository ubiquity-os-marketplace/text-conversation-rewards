import { Value } from "@sinclair/typebox/value";
import Decimal from "decimal.js";
import * as fs from "fs";
import { stringify } from "yaml";
import configuration from "../configuration/config-reader";
import githubCommentConfig, { GithubCommentConfiguration } from "../configuration/github-comment-config";
import { CommentType, IssueActivity } from "../issue-activity";
import { getPayoutConfigByNetworkId } from "../types/payout";
import program from "./command-line";
import { GithubCommentScore, Module, Result } from "./processor";

/**
 * Posts a GitHub comment according to the given results.
 */
export class GithubContentModule implements Module {
  private readonly _configuration: GithubCommentConfiguration = configuration.githubComment;

  transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    if (this._configuration.debug) {
      fs.writeFileSync("./output.html", "");
    }
    for (const [key, value] of Object.entries(result)) {
      result[key].evaluationCommentHtml = this._generateHtml(key, value);
      if (this._configuration.debug) {
        fs.appendFileSync("./output.html", result[key].evaluationCommentHtml as string);
      }
    }
    if (this._configuration.post) {
      console.log("post comment");
    }
    return Promise.resolve(result);
  }

  get enabled(): boolean {
    if (!Value.Check(githubCommentConfig, this._configuration)) {
      console.warn("Invalid configuration detected for GithubContentModule, disabling.");
      return false;
    }
    return true;
  }

  _generateHtml(username: string, result: Result[0]) {
    const sorted = result.comments?.reduce<{
      issues: { task: GithubCommentScore[]; comments: GithubCommentScore[] };
      reviews: GithubCommentScore[];
    }>(
      (acc, curr) => {
        if (curr.type & CommentType.ISSUE) {
          if (curr.type & CommentType.TASK) {
            acc.issues.task.push(curr);
          } else {
            acc.issues.comments.push(curr);
          }
        } else if (curr.type & CommentType.REVIEW) {
          acc.reviews.push(curr);
        }
        return acc;
      },
      { issues: { task: [], comments: [] }, reviews: [] }
    );

    function createContributionRows() {
      let content = "";

      if (!sorted) {
        return "";
      }
      if (result.task?.reward) {
        content += `
          <tr>
            <td>Issue</td>
            <td>Task</td>
            <td>Count</td>
            <td>1</td>
            <td>${result.task.reward}</td>
          </tr>`;
      }
      for (const issue of sorted.issues.task) {
        content += `
          <tr>
            <td>Issue</td>
            <td>Specification</td>
            <td>Count</td>
            <td>1</td>
            <td>${issue.score?.reward ?? "-"}</td>
          </tr>`;
      }
      if (sorted.issues.comments.length) {
        content += `
          <tr>
            <td>Issue</td>
            <td>Comment</td>
            <td>Count</td>
            <td>${sorted.issues.comments.length}</td>
            <td>${sorted.issues.comments.reduce((acc, curr) => acc.add(curr.score?.reward ?? 0), new Decimal(0)) ?? "-"}</td>
          </tr>`;
      }
      if (sorted.reviews.length) {
        content += `
          <tr>
            <td>Review</td>
            <td>Comment</td>
            <td>Count</td>
            <td>${sorted.reviews.length}</td>
            <td>${sorted.reviews.reduce((acc, curr) => acc + (curr.score?.reward ?? 0), 0) ?? "-"}</td>
          </tr>`;
      }
      return content;
    }

    function createIncentiveRows() {
      let content = "";
      if (!sorted) {
        return "";
      }

      function buildIncentiveRow(commentScore: GithubCommentScore) {
        return `
          <tr>
            <td>
              <h6>
                <a href="${commentScore.url}" target="_blank" rel="noopener">${commentScore.content}</a>
              </h6>
            </td>
            <td>
            <details>
              <summary>
                ${Object.values(commentScore.score?.formatting?.content || {}).reduce((acc, curr) => {
                  return acc.add(curr.score * curr.count);
                }, new Decimal(0))}
              </summary>
              <pre>
                ${Object.entries(commentScore.score?.formatting?.content || {}).reduce((acc, curr) => {
                  return acc + stringify(curr);
                }, "")}
              </pre>
             </details>
            </td>
            <td>${commentScore.score?.relevance ?? "-"}</td>
            <td>${commentScore.score?.reward ?? "-"}</td>
          </tr>`;
      }

      for (const issueComment of sorted.issues.comments) {
        content += buildIncentiveRow(issueComment);
      }
      for (const reviewComment of sorted.reviews) {
        content += buildIncentiveRow(reviewComment);
      }
      return content;
    }

    return `
    <details>
      <summary>
        <b>
          <h3>
            <a href="${result.permitUrl}" target="_blank" rel="noopener">
              [ ${result.total} ${getPayoutConfigByNetworkId(program.opts().evmNetworkId).symbol} ]
            </a>
          </h3>
          <h6>
            @${username}
          </h6>
        </b>
      </summary>
      <h6>Contributions Overview</h6>
      <table>
        <thead>
          <tr>
            <th>View</th>
            <th>Contribution</th>
            <th>Count</th>
            <th>Reward</th>
          </tr>
        </thead>
        <tbody>
          ${createContributionRows()}
        </tbody>
      </table>
      <h6>Conversation Incentives</h6>
      <table>
        <thead>
          <tr>
            <th>Comment</th>
            <th>Formatting</th>
            <th>Relevance</th>
            <th>Reward</th>
          </tr>
        </thead>
        <tbody>
            ${createIncentiveRows()}
        </tbody>
      </table>
    </details>
    `
      .replace(/\s+/g, " ")
      .trim();
  }
}
