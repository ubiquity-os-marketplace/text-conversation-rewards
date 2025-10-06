import Decimal from "decimal.js";
import * as fs from "fs";
import { GitHubIssue } from "../github-types";
import { getTaskReward } from "../helpers/label-price-extractor";
import { commentTypeReplacer } from "../helpers/result-replacer";
import { IssueActivity } from "../issue-activity";
import { Module } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result } from "../types/results";
import { ContentEvaluatorModule } from "./content-evaluator-module";
import { DataPurgeModule } from "./data-purge-module";
import { EventIncentivesModule } from "./event-incentives-module";
import { FormattingEvaluatorModule } from "./formatting-evaluator-module";
import { GithubCommentModule } from "./github-comment-module";
import { PaymentModule } from "./payment-module";
import { ReviewIncentivizerModule } from "./review-incentivizer-module";
import { SimplificationIncentivizerModule } from "./simplification-incentivizer-module";
import { UserExtractorModule } from "./user-extractor-module";
import { ExternalContentProcessor } from "./external-content-module";

export class Processor {
  private readonly _transformers: Module[] = [];
  private _result: Result = {};
  private readonly _context: ContextPlugin;
  private readonly _configuration;

  constructor(
    context: ContextPlugin,
    modulesToAdd: Module[] = [
      new UserExtractorModule(context),
      new DataPurgeModule(context),
      new ExternalContentProcessor(context),
      new FormattingEvaluatorModule(context),
      new ContentEvaluatorModule(context),
      new ReviewIncentivizerModule(context),
      new EventIncentivesModule(context),
      new SimplificationIncentivizerModule(context),
      new PaymentModule(context),
      new GithubCommentModule(context),
    ]
  ) {
    for (const module of modulesToAdd) {
      this.add(module);
    }
    this._context = context;
    this._configuration = this._context.config.incentives;
  }

  add(transformer: Module) {
    this._transformers.push(transformer);
    return this;
  }

  async _getRewardsLimit(issue: GitHubIssue | null) {
    if (!this._configuration.limitRewards) {
      return Infinity;
    }
    const priceTagReward = await getTaskReward(this._context, issue);
    return priceTagReward ?? Infinity;
  }

  async run(data: Readonly<IssueActivity>) {
    const rewardLimit = await this._getRewardsLimit(data.self);

    for (const transformer of this._transformers) {
      if (transformer.enabled) {
        this._result = await transformer.transform(data, this._result);
      }
      // Aggregate total result
      for (const username of Object.keys(this._result)) {
        if (data.self?.assignees?.map((v) => v.login).includes(username)) {
          this._result[username].total = this._sumRewards(this._result[username], rewardLimit);
        } else {
          this._result[username].total = Math.min(this._sumRewards(this._result[username], rewardLimit), rewardLimit);
        }
      }
    }
    return this._result;
  }

  dump() {
    const { file } = this._configuration;
    const result = JSON.stringify(this._result, commentTypeReplacer, 2);
    if (!file) {
      this._context.logger.verbose(result);
    } else {
      fs.writeFileSync(file, result);
    }
    return result;
  }

  _sumRewards(obj: Record<string, unknown>, taskRewardLimit = Infinity) {
    let totalReward = new Decimal(0);
    if (!obj) {
      return 0;
    }
    for (const [key, value] of Object.entries(obj)) {
      if (key === "reward" && typeof value === "number") {
        totalReward = totalReward.add(Math.min(value, taskRewardLimit));
      } else if (typeof value === "object") {
        totalReward = totalReward.add(
          Math.min(this._sumRewards(value as Record<string, unknown>, taskRewardLimit), taskRewardLimit)
        );
      }
    }

    return totalReward.toNumber();
  }
}
