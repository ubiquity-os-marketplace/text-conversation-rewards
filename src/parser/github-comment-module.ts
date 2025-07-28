import { Value } from "@sinclair/typebox/value";
import { decodePermits } from "@ubiquity-os/permit-generation";
import { createHash } from "crypto";
import Decimal from "decimal.js";
import * as fs from "fs";
import { JSDOM } from "jsdom";
import { stringify } from "yaml";
import { CommentAssociation, CommentKind } from "../configuration/comment-types";
import { GithubCommentConfiguration, githubCommentConfigurationType } from "../configuration/github-comment-config";
import { isAdmin, isCollaborative } from "../helpers/checkers";
import { GITHUB_COMMENT_PAYLOAD_LIMIT } from "../helpers/constants";
import { getGithubWorkflowRunUrl } from "../helpers/github";
import { getTaskReward } from "../helpers/label-price-extractor";
import { createStructuredMetadata } from "../helpers/metadata";
import { commentTypeReplacer, removeKeyFromObject } from "../helpers/result-replacer";
import { ERC20_ABI, Erc20Wrapper, getContract, PERMIT2_ABI, Permit2Wrapper } from "../helpers/web3";
import { IssueActivity } from "../issue-activity";
import { BaseModule } from "../types/module";
import { PERMIT2_ADDRESS } from "../types/permit2";
import { GithubCommentScore, Result, ReviewScore } from "../types/results";

interface SortedTasks {
  issues: { specification: GithubCommentScore | null; comments: GithubCommentScore[] };
  reviews: GithubCommentScore[];
}

/**
 * Posts a GitHub comment according to the given results.
 */
export class GithubCommentModule extends BaseModule {
  private readonly _configuration: GithubCommentConfiguration | null = this.context.config.incentives.githubComment;
  private readonly _debugFilePath = "./output.html";

  /**
   * Ensures that a string containing special characters get HTML encoded.
   */
  _encodeHTML(str: string) {
    const dom = new JSDOM();
    const div = dom.window.document.createElement("div");
    div.appendChild(dom.window.document.createTextNode(str));
    return div.innerHTML;
  }

  _getPayoutMode(result: Result): string | undefined {
    const someReward = Object.values(result)[0];
    return someReward?.payoutMode;
  }

  /**
   * Generates content when it needs to be stripped due to length limits
   */
  private async _getStrippedContent(result: Result, taskReward: number): Promise<string> {
    const bodyArray: (string | undefined)[] = [];

    this.context.logger.info("Stripping content due to excessive length.");
    bodyArray.push("> [!NOTE]\n");
    bodyArray.push("> This output has been truncated due to the comment length limit.\n\n");

    for (const [key, value] of Object.entries(result)) {
      // Remove result with 0 total from being displayed
      if (result[key].total <= 0 || (await this.isRewardClaimed(value))) continue;
      result[key].evaluationCommentHtml = await this._generateHtml(key, value, taskReward, true);
      bodyArray.push(result[key].evaluationCommentHtml);
    }

    bodyArray.push(
      createStructuredMetadata("GithubCommentModule", {
        workflowUrl: this._encodeHTML(getGithubWorkflowRunUrl()),
        payoutMode: this._getPayoutMode(result),
      })
    );

    return bodyArray.join("");
  }

  async isRewardClaimed(reward: Result[0]) {
    if (!reward.permitUrl) {
      return false;
    }
    const permitBase64 = new URL(reward.permitUrl).searchParams.get("claim");
    if (!permitBase64) {
      return false;
    }
    const permits = decodePermits(permitBase64);
    if (!permits.length) {
      return false;
    }
    for (const permit of permits) {
      const { owner, nonce, networkId } = permit;
      const permit2Contract = await getContract(networkId, PERMIT2_ADDRESS, PERMIT2_ABI);
      const permit2Wrapper = new Permit2Wrapper(permit2Contract);
      if (!(await permit2Wrapper.isNonceClaimed(owner, nonce))) {
        return false;
      }
    }
    return true;
  }

  async getBodyContent(data: Readonly<IssueActivity>, result: Result, stripContent = false): Promise<string> {
    const taskReward = getTaskReward(data.self);

    if (stripContent) {
      return this._getStrippedContent(result, taskReward);
    }

    const keysToRemove: string[] = [];
    const bodyArray: (string | undefined)[] = [];

    for (const [key, value] of Object.entries(result)) {
      // Remove result with 0 total from being displayed
      if (result[key].total <= 0 || (await this.isRewardClaimed(value))) {
        keysToRemove.push(key);
        continue;
      }
      result[key].evaluationCommentHtml = await this._generateHtml(key, value, taskReward);
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
        output: JSON.parse(JSON.stringify(metadataResult, commentTypeReplacer, 2)),
      })
    );

    const body = bodyArray.join("");
    // We check this length because GitHub has a comment length limit
    if (body.length > GITHUB_COMMENT_PAYLOAD_LIMIT) {
      // First, we try to diminish the metadata content to only contain the URL
      bodyArray[bodyArray.length - 1] = `${createStructuredMetadata("GithubCommentModule", {
        workflowUrl: this._encodeHTML(getGithubWorkflowRunUrl()),
        payoutMode: this._getPayoutMode(result),
      })}`;
      const newBody = bodyArray.join("");
      if (newBody.length <= GITHUB_COMMENT_PAYLOAD_LIMIT) {
        return newBody;
      } else {
        return this.getBodyContent(data, result, true);
      }
    }
    return body;
  }

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const isIssueCollaborative = isCollaborative(data);
    const isUserAdmin = data.self?.user ? await isAdmin(data.self.user.login, this.context) : false;
    const body = await this.getBodyContent(data, result);
    if (this._configuration?.debug) {
      fs.writeFileSync(this._debugFilePath, body);
    }
    if (this._configuration?.post) {
      try {
        if (Object.values(result).some((v) => v.permitUrl ?? v.explorerUrl) || isIssueCollaborative || isUserAdmin) {
          const comment = await this.context.commentHandler.postComment(this.context, this.context.logger.info(body), {
            raw: true,
            updateComment: true,
          });
          if (comment) {
            await this.context.adapters.supabase.location.upsert({
              issue_id: this.context.payload.issue.id,
              node_url: `${this.context.payload.issue.html_url}#issuecomment-${comment.id}`,
              repository_id: this.context.payload.repository.id,
              comment_id: comment.id,
              node_type: "Issue",
            });
          }
        } else {
          const errorLog = this.context.logger.error("Issue is non-collaborative. Skipping permit generation.");
          await this.context.commentHandler.postComment(this.context, errorLog);
        }
      } catch (e) {
        this.context.logger.error(`Could not post GitHub comment: ${e}`);
      }
    }
    return result;
  }

  get enabled(): boolean {
    if (!Value.Check(githubCommentConfigurationType, this._configuration)) {
      this.context.logger.warn(
        "The configuration for the module GithubCommentModule is invalid or missing, disabling."
      );
      return false;
    }
    return true;
  }

  _createContributionRows(result: Result[0], sortedTasks: SortedTasks | undefined) {
    const content: string[] = [];
    function buildContributionRow(
      view: string,
      contribution: string,
      count: number,
      reward: number | Decimal | undefined
    ) {
      return `
          <tr>
            <td>${view}</td>
            <td>${contribution}</td>
            <td>${count}</td>
            <td>${reward || "-"}</td>
          </tr>`;
    }

    if (result.task?.reward) {
      content.push(buildContributionRow("Issue", "Task", result.task.multiplier, result.task.reward));
    }

    if (result.simplificationReward && Object.keys(result.simplificationReward.files).length !== 0) {
      content.push(
        buildContributionRow(
          "Issue",
          "Task Simplification",
          1,
          Object.values(result.simplificationReward.files).reduce((sum, { reward }) => sum + reward, 0)
        )
      );
    }

    if (result.reviewRewards) {
      const reviewCount = result.reviewRewards.reduce(
        (total, reviewReward) => total + (reviewReward.reviews?.length ?? 0),
        0
      );

      const totalReviewReward = result.reviewRewards.reduce(
        (sum, reviewReward) =>
          sum.add(
            reviewReward.reviews?.reduce((subSum, review) => subSum.add(review.reward), new Decimal(0)) ??
              new Decimal(0)
          ),
        new Decimal(0)
      );

      if (reviewCount > 0) {
        content.push(buildContributionRow("Review", "Code Review", reviewCount, totalReviewReward.toNumber()));
      }
    }

    if (!sortedTasks) {
      return content.join("");
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

  _createIncentiveRows(sortedTasks: SortedTasks | undefined) {
    const content: string[] = [];
    if (!sortedTasks) {
      return content.join("");
    }

    function buildIncentiveRow(commentScore: GithubCommentScore) {
      // Properly escape carriage returns for HTML rendering
      const formatting = stringify({
        content: commentScore.score?.formatting,
        regex: commentScore.score?.words,
        ...(commentScore.score?.weight !== undefined && { weight: commentScore.score.weight }),
        authorship: commentScore.score?.authorship,
      }).replace(/[\n\r]/g, "&#13;");
      // Makes sure any HTML injected in the templated is not rendered itself
      const sanitizedContent = commentScore.content
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("`", "&#96;")
        .replace(/([\s\S]{64}).[\s\S]+/, "$1&hellip;");
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
                ${new Decimal(commentScore.score?.words?.result ?? 0).add(new Decimal(commentScore.score?.formatting?.result ?? 0)).toDecimalPlaces(3)}
              </summary>
              <pre>${formatting}</pre>
             </details>
            </td>
            <td>
              Relevance: ${commentScore.score?.relevance === undefined ? "-" : commentScore.score.relevance}<br/>
              <span title="Flesch-Kincaid readability score. Higher scores indicate easier to read text (0-30: very difficult, 30-50: difficult, 50-60: fairly difficult, 60-70: standard, 70-80: fairly easy, 80-90: easy, 90-100: very easy)" style="cursor: help;">Readability</span>: ${commentScore.score?.readability?.fleschKincaid === undefined ? "-" : commentScore.score.readability.fleschKincaid.toFixed(1)}
            </td>
            <td>${commentScore.score?.priority === undefined ? "-" : commentScore.score.priority}</td>
            <td>${commentScore.score?.reward === undefined ? "-" : commentScore.score.reward}</td>
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

  _createSimplificationRows(result: Result[0]) {
    if (!result.simplificationReward || Object.keys(result.simplificationReward.files).length === 0) return "";
    const rows: string[] = [];
    for (const file of result.simplificationReward.files) {
      rows.push(`
        <tr>
          <td><a href="${result.simplificationReward.url}/files#diff-${createHash("sha256").update(file.fileName).digest("hex")}" target="_blank" rel="noopener">${file.fileName}</a></td>
          <td>${file.reward}</td>
          <td>${file.deletions}</td>
        </tr>`);
    }

    return `
    <h6>Simplification Details for&nbsp;<a href="${result.simplificationReward.url}" target="_blank" rel="noopener">#${result.simplificationReward.url.split("/").slice(-1)[0]}</a></h6>
    <table>
      <thead>
        <tr>
          <th>Filename</th>
          <th>Reward</th>
          <th>Deletions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join("")}
      </tbody>
    </table>`;
  }

  _createReviewRows(result: Result[0]) {
    if (result.reviewRewards?.every((reviewReward) => reviewReward.reviews?.length === 0) || !result.reviewRewards) {
      return "";
    }

    function buildReviewRow(review: ReviewScore) {
      return `
        <tr>
          <td>+${review.effect.addition} -${review.effect.deletion}</td>
          <td>${review.priority ?? "-"}</td>
          <td>${review.reward}</td>
        </tr>`;
    }

    const reviewTables = result.reviewRewards
      .filter((reviewReward) => reviewReward.reviews && reviewReward.reviews.length > 0)
      .map((reviewReward) => {
        const rows = reviewReward.reviews?.map(buildReviewRow).join("") ?? "";
        return `
          <h6>Review Details for&nbsp;<a href="${reviewReward.url}" target="_blank" rel="noopener">#${reviewReward.url.split("/").slice(-1)[0]}</a></h6>
          <table>
            <thead>
              <tr>
                <th>Changes</th>
                <th>Priority</th>
                <th>Reward</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>`;
      })
      .join("");

    return reviewTables;
  }

  _createWalletWarning(walletAddress: string | null | undefined) {
    // When using XP mode, this warning is not relevant, as it doesn't require a wallet
    if (!this.context.config.rewards) {
      return "";
    }
    if (walletAddress === null) {
      return `<h6>⚠️ Wallet address is not set</h6>`;
    } else if (walletAddress === undefined) {
      return `<h6>⚠️ Error fetching wallet</h6>`;
    }
    return "";
  }

  _createRewardLink(result: Result[0], tokenSymbol: string) {
    if (result.permitUrl || result.explorerUrl) {
      return `<a href="${result.permitUrl || result.explorerUrl}" target="_blank" rel="noopener">[ ${result.total} ${tokenSymbol} ]</a>`;
    }
    return `[ ${result.total} ${tokenSymbol} ]`;
  }

  async _generateHtml(username: string, result: Result[0], taskReward: number, stripComments = false) {
    const sortedTasks = result.comments?.reduce<SortedTasks>(
      (acc, curr) => {
        if (curr.commentType & CommentKind.ISSUE) {
          if (curr.commentType & CommentAssociation.SPECIFICATION) {
            acc.issues.specification = curr;
          } else {
            acc.issues.comments.push(curr);
          }
        } else if (curr.commentType & CommentKind.PULL) {
          acc.reviews.push(curr);
        }
        return acc;
      },
      { issues: { specification: null, comments: [] }, reviews: [] }
    );
    let tokenSymbol = "XP";
    if (this.context.config.rewards) {
      const tokenContract = await getContract(
        this.context.config.rewards.evmNetworkId,
        this.context.config.rewards.erc20RewardToken,
        ERC20_ABI
      );
      tokenSymbol = await new Erc20Wrapper(tokenContract).getSymbol();
    }

    const rewardsSum =
      result.comments?.reduce<Decimal>((acc, curr) => acc.add(curr.score?.reward ?? 0), new Decimal(0)) ??
      new Decimal(0);
    const isCapped = taskReward > 0 && rewardsSum.gt(taskReward);

    return `
    <details>
      <summary>
        <b>
          <h3>
            &nbsp;
            ${this._createRewardLink(result, tokenSymbol)}
            &nbsp;
          </h3>
          <h6>
            @${username}
          </h6>
        </b>
      </summary>
      ${this._createWalletWarning(result.walletAddress)}
      ${result.feeRate !== undefined ? `<h6>⚠️ ${new Decimal(result.feeRate).mul(100)}% fee rate has been applied. Consider using the&nbsp;<a href="https://dao.ubq.fi/dollar" target="_blank" rel="noopener">Ubiquity Dollar</a>&nbsp;for no fees.</h6>` : ""}
      ${isCapped ? `<h6>⚠️ Your rewards have been limited to the task price of ${taskReward} ${tokenSymbol}.</h6>` : ""}
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
          ${this._createContributionRows(result, sortedTasks)}
        </tbody>
      </table>
      ${!stripComments ? this._createSimplificationRows(result) : ""}
      ${!stripComments ? this._createReviewRows(result) : ""}
      ${
        !stripComments &&
        sortedTasks &&
        (sortedTasks.issues.comments.length || sortedTasks.reviews.length || sortedTasks.issues.specification)
          ? `<h6>Conversation Incentives</h6>
      <table>
        <thead>
          <tr>
            <th>Comment</th>
            <th>Formatting</th>
            <th>Clarity</th>
            <th>Priority</th>
            <th>Reward</th>
          </tr>
        </thead>
        <tbody>
          ${this._createIncentiveRows(sortedTasks)}
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
