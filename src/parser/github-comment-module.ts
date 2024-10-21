import { Value } from "@sinclair/typebox/value";
import Decimal from "decimal.js";
import * as fs from "fs";
import { JSDOM } from "jsdom";
import { stringify } from "yaml";
import { CommentAssociation, CommentKind } from "../configuration/comment-types";
import configuration from "../configuration/config-reader";
import { GithubCommentConfiguration, githubCommentConfigurationType } from "../configuration/github-comment-config";
import { getGithubWorkflowRunUrl } from "../helpers/github";
import logger from "../helpers/logger";
import { createStructuredMetadata } from "../helpers/metadata";
import { removeKeyFromObject, typeReplacer } from "../helpers/result-replacer";
import { getErc20TokenSymbol } from "../helpers/web3";
import { IssueActivity } from "../issue-activity";
import { getOctokitInstance } from "../octokit";
import program from "./command-line";
import { GithubCommentScore, Module, Result } from "./processor";
import { GITHUB_COMMENT_PAYLOAD_LIMIT } from "../helpers/constants";
import { generateFeeString } from "../helpers/fee";

interface SortedTasks {
  issues: { specification: GithubCommentScore | null; comments: GithubCommentScore[] };
  reviews: GithubCommentScore[];
}

/**
 * Posts a GitHub comment according to the given results.
 */
export class GithubCommentModule implements Module {
  private readonly _configuration: GithubCommentConfiguration | null = configuration.incentives.githubComment;
  private readonly _debugFilePath = "./output.html";
  /**
   * COMMENT_ID can be set in the environment to reference the id of the last comment created during this workflow.
   * See also compute.yml to understand how it is set.
   */
  private _lastCommentId: number | null = process.env.COMMENT_ID ? Number(process.env.COMMENT_ID) : null;

  /**
   * Ensures that a string containing special characters get HTML encoded.
   */
  _encodeHTML(str: string) {
    const dom = new JSDOM();
    const div = dom.window.document.createElement("div");
    div.appendChild(dom.window.document.createTextNode(str));
    return div.innerHTML;
  }

  async getBodyContent(result: Result, stripContent = false): Promise<string> {
    const keysToRemove: string[] = [];
    const bodyArray: (string | undefined)[] = [];

    if (stripContent) {
      logger.info("Stripping content due to excessive length.");
      bodyArray.push("> [!NOTE]\n");
      bodyArray.push("> This output has been truncated due to the comment length limit.\n\n");
      for (const [key, value] of Object.entries(result)) {
        // Remove result with 0 total from being displayed
        if (result[key].total <= 0) continue;
        result[key].evaluationCommentHtml = await this._generateHtml(key, value, true);
        bodyArray.push(result[key].evaluationCommentHtml);
      }
      bodyArray.push(
        createStructuredMetadata("GithubCommentModule", {
          workflowUrl: this._encodeHTML(getGithubWorkflowRunUrl()),
        })
      );
      return bodyArray.join("");
    }

    for (const [key, value] of Object.entries(result)) {
      // Remove result with 0 total from being displayed
      if (result[key].total <= 0) {
        keysToRemove.push(key);
        continue;
      }
      result[key].evaluationCommentHtml = await this._generateHtml(key, value);
      bodyArray.push(result[key].evaluationCommentHtml);
    }
    // Remove evaluationCommentHtml because it is superfluous
    let metadataResult = removeKeyFromObject(result, "evaluationCommentHtml");
    // Remove user with 0 result from metadataResult
    for (const key of keysToRemove) {
      metadataResult = removeKeyFromObject(metadataResult, key);
    }
    // Add the workflow run url and the metadata in the GitHub's comment
    bodyArray.push(
      createStructuredMetadata("GithubCommentModule", {
        workflowUrl: this._encodeHTML(getGithubWorkflowRunUrl()),
        output: JSON.parse(JSON.stringify(metadataResult, typeReplacer, 2)),
      })
    );

    const body = bodyArray.join("");
    // We check this length because GitHub has a comment length limit
    if (body.length > GITHUB_COMMENT_PAYLOAD_LIMIT) {
      // First, we try to diminish the metadata content to only contain the URL
      bodyArray[bodyArray.length - 1] = `${createStructuredMetadata("GithubCommentModule", {
        workflowUrl: this._encodeHTML(getGithubWorkflowRunUrl()),
      })}`;
      const newBody = bodyArray.join("");
      if (newBody.length <= GITHUB_COMMENT_PAYLOAD_LIMIT) {
        return newBody;
      } else {
        return this.getBodyContent(result, true);
      }
    }
    return body;
  }

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const body = await this.getBodyContent(result);
    if (this._configuration?.debug) {
      fs.writeFileSync(this._debugFilePath, body);
    }
    if (this._configuration?.post) {
      try {
        await this.postComment(body);
      } catch (e) {
        logger.error(`Could not post GitHub comment: ${e}`);
      }
    }
    return result;
  }

  get enabled(): boolean {
    if (!Value.Check(githubCommentConfigurationType, this._configuration)) {
      logger.error("Invalid / missing configuration detected for GithubContentModule, disabling.");
      return false;
    }
    return true;
  }

  async postComment(body: string, updateLastComment = true) {
    const { eventPayload } = program;
    if (!this._configuration?.post) {
      logger.debug("Won't post a comment since posting is disabled.", { body });
      return;
    }
    if (updateLastComment && this._lastCommentId !== null) {
      await getOctokitInstance().issues.updateComment({
        body,
        repo: eventPayload.repository.name,
        owner: eventPayload.repository.owner.login,
        issue_number: eventPayload.issue.number,
        comment_id: this._lastCommentId,
      });
    } else {
      const comment = await getOctokitInstance().issues.createComment({
        body,
        repo: eventPayload.repository.name,
        owner: eventPayload.repository.owner.login,
        issue_number: eventPayload.issue.number,
      });
      this._lastCommentId = comment.data.id;
    }
  }

  _createContributionRows(result: Result[0], sortedTasks: SortedTasks | undefined) {
    const content: string[] = [];

    if (result.task?.reward) {
      content.push(buildContributionRow("Issue", "Task", result.task.multiplier, result.task.reward));
    }

    if (!sortedTasks) {
      return content.join("");
    }

    function buildContributionRow(
      view: string,
      contribution: string,
      count: number,
      reward: number | Decimal | undefined
    ) {
      const fee = generateFeeString(reward, result.feeRate);
      return `
          <tr>
            <td>${view}</td>
            <td>${contribution}</td>
            <td>${count}</td>
            <td>${reward || "-"}</td>
            <td>${fee}</td>
          </tr>`;
    }

    if (sortedTasks.issues.specification) {
      content.push(buildContributionRow("Issue", "Specification", 1, sortedTasks.issues.specification.score?.reward));
    }
    if (sortedTasks.issues.comments.length) {
      content.push(
        buildContributionRow(
          "Issue",
          "Comment",
          sortedTasks.issues.comments.length,
          sortedTasks.issues.comments.reduce((acc, curr) => acc.add(curr.score?.reward ?? 0), new Decimal(0))
        )
      );
    }
    if (sortedTasks.reviews.length) {
      content.push(
        buildContributionRow(
          "Review",
          "Comment",
          sortedTasks.reviews.length,
          sortedTasks.reviews.reduce((acc, curr) => acc.add(curr.score?.reward ?? 0), new Decimal(0))
        )
      );
    }
    return content.join("");
  }

  _createIncentiveRows(sortedTasks: SortedTasks | undefined, feeRate: number | Decimal | undefined = undefined) {
    const content: string[] = [];

    if (!sortedTasks) {
      return content.join("");
    }

    function buildIncentiveRow(commentScore: GithubCommentScore) {
      // Properly escape carriage returns for HTML rendering
      const formatting = stringify({
        content: commentScore.score?.formatting,
        regex: commentScore.score?.words,
      }).replace(/[\n\r]/g, "&#13;");
      // Makes sure any HTML injected in the templated is not rendered itself
      const sanitizedContent = commentScore.content
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("`", "&#96;")
        .replace(/([\s\S]{64}).[\s\S]+/, "$1&hellip;");
      const fee = generateFeeString(commentScore.score?.reward, feeRate);
      return `
          <tr>
            <td>
              <h6>
                <a href="${commentScore.url}" target="_blank" rel="noopener">${sanitizedContent}</a>
              </h6>
            </td>
            <td>
            <details>
              <summary>
                ${new Decimal(commentScore.score?.words?.result ?? 0).add(new Decimal(commentScore.score?.formatting?.result ?? 0))}
              </summary>
              <pre>${formatting}</pre>
             </details>
            </td>
            <td>${commentScore.score?.relevance ?? "-"}</td>
            <td>${commentScore.score?.reward ?? "-"}</td>
            <td>${fee}</td>
          </tr>`;
    }

    if (sortedTasks.issues.specification) {
      content.push(buildIncentiveRow(sortedTasks.issues.specification));
    }
    for (const issueComment of sortedTasks.issues.comments) {
      content.push(buildIncentiveRow(issueComment));
    }
    for (const reviewComment of sortedTasks.reviews) {
      content.push(buildIncentiveRow(reviewComment));
    }
    return content.join("");
  }

  async _generateHtml(username: string, result: Result[0], stripComments = false) {
    const sortedTasks = result.comments?.reduce<SortedTasks>(
      (acc, curr) => {
        if (curr.type & CommentKind.ISSUE) {
          if (curr.type & CommentAssociation.SPECIFICATION) {
            acc.issues.specification = curr;
          } else {
            acc.issues.comments.push(curr);
          }
        } else if (curr.type & CommentKind.PULL) {
          acc.reviews.push(curr);
        }
        return acc;
      },
      { issues: { specification: null, comments: [] }, reviews: [] }
    );

    const tokenSymbol = await getErc20TokenSymbol(configuration.evmNetworkId, configuration.erc20RewardToken);

    return `
    <details>
      <summary>
        <b>
          <h3>
            &nbsp;
            <a href="${result.permitUrl}" target="_blank" rel="noopener">
              [ ${result.total} ${tokenSymbol} ]
            </a>
            &nbsp;
          </h3>
          <h6>
            @${username}
          </h6>
        </b>
      </summary>
      ${result.feeRate !== undefined ? `<h6>⚠️ ${result.feeRate}% fee rate has been applied. Consider using the&nbsp;<a href="https://dao.ubq.fi/dollar" target="_blank" rel="noopener">Ubiquity Dollar</a>&nbsp;for no fees.</h6>` : ""}
      <h6>Contributions Overview</h6>
      <table>
        <thead>
          <tr>
            <th>View</th>
            <th>Contribution</th>
            <th>Count</th>
            <th>Reward</th>
            <th>Fee</th>
          </tr>
        </thead>
        <tbody>
          ${this._createContributionRows(result, sortedTasks)}
        </tbody>
      </table>
      ${
        !stripComments
          ? `<h6>Conversation Incentives</h6>
      <table>
        <thead>
          <tr>
            <th>Comment</th>
            <th>Formatting</th>
            <th>Relevance</th>
            <th>Reward</th>
            <th>Fee</th>
          </tr>
        </thead>
        <tbody>
          ${this._createIncentiveRows(sortedTasks, result.feeRate)}
        </tbody>
      </table>`
          : ""
      }
    </details>
    `
      .replace(/(\r?\n|\r)\s*/g, "") // Remove newlines and leading spaces/tabs after them
      .replace(/\s*(<\/?[^>]+>)\s*/g, "$1") // Trim spaces around HTML tags
      .trim();
  }
}
