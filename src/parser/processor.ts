import Decimal from "decimal.js";
import * as fs from "fs";
import { typeReplacer } from "../helpers/result-replacer";
import { IssueActivity } from "../issue-activity";
import { Module } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result } from "../types/results";
import { ContentEvaluatorModule } from "./content-evaluator-module";
import { DataPurgeModule } from "./data-purge-module";
import { FormattingEvaluatorModule } from "./formatting-evaluator-module";
import { GithubCommentModule } from "./github-comment-module";
import { PermitGenerationModule } from "./permit-generation-module";
import { UserExtractorModule } from "./user-extractor-module";

export class Processor {
  private _transformers: Module[] = [];
  private _result: Result = {};
  private _context: ContextPlugin;
  private readonly _configuration;

  constructor(context: ContextPlugin) {
    this.add(new UserExtractorModule(context))
      .add(new DataPurgeModule(context))
      .add(new FormattingEvaluatorModule(context))
      .add(new ContentEvaluatorModule(context))
      .add(new PermitGenerationModule(context))
      .add(new GithubCommentModule(context));
    this._context = context;
    this._configuration = this._context.config.incentives;
  }

  add(transformer: Module) {
    this._transformers.push(transformer);
    return this;
  }

  _getRewardsLimit() {
    let taskReward = Infinity;
    if (!this._configuration.limitRewards) {
      return taskReward;
    }
    for (const item of Object.keys(this._result)) {
      if (this._result[item].task) {
        taskReward = this._result[item].task.reward * this._result[item].task.multiplier;
        return taskReward;
      }
    }
    return taskReward;
  }

  async run(data: Readonly<IssueActivity>) {
    for (const transformer of this._transformers) {
      if (transformer.enabled) {
        this._result = await transformer.transform(data, this._result);
      }
      // Aggregate total result
      for (const item of Object.keys(this._result)) {
        this._result[item].total = this._sumRewards(this._result[item], this._getRewardsLimit());
      }
    }
    return this._result;
  }

  dump() {
    const { file } = this._configuration;
    const result = JSON.stringify(this._result, typeReplacer, 2);
    if (!file) {
      this._context.logger.verbose(result);
    } else {
      fs.writeFileSync(file, result);
    }
    return result;
  }

  _sumRewards(obj: Record<string, unknown>, taskRewardLimit = Infinity) {
    let totalReward = new Decimal(0);

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
