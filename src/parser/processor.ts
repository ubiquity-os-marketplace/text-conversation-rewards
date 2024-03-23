import Decimal from "decimal.js";
import * as fs from "fs";
import configuration from "../configuration/config-reader";
import { CommentType, GetActivity } from "../get-activity";
import program from "./command-line";
import { ContentEvaluatorModule } from "./content-evaluator-module";
import { DataPurgeModule } from "./data-purge-module";
import { FormattingEvaluatorModule } from "./formatting-evaluator-module";
import { UserExtractorModule } from "./user-extractor-module";

export class Processor {
  private _transformers: Module[] = [];
  private _result: Result = {};
  private readonly _configuration = configuration;

  constructor() {
    this.add(new UserExtractorModule())
      .add(new DataPurgeModule())
      .add(new FormattingEvaluatorModule())
      .add(new ContentEvaluatorModule());
  }

  add(transformer: Module) {
    this._transformers.push(transformer);
    return this;
  }

  async run(data: Readonly<GetActivity>) {
    if (this._configuration.disabled) {
      console.log("Module is disabled. Skipping...");
      return;
    }
    for (const transformer of this._transformers) {
      if (transformer.enabled) {
        this._result = await transformer.transform(data, this._result);
      }
    }
    // Aggregate total result
    for (const item of Object.keys(this._result)) {
      this._result[item].total = this._sumRewards(this._result[item]);
    }
    return this._result;
  }

  dump() {
    const { file } = program.opts();
    const result = JSON.stringify(
      this._result,
      (key: string, value: string | number) => {
        // Changes "type" to be human-readable
        if (key === "type" && typeof value === "number") {
          const typeNames: string[] = [];
          const types = Object.values(CommentType) as number[];
          types.forEach((typeValue) => {
            if (value & typeValue) {
              typeNames.push(CommentType[typeValue]);
            }
          });
          return typeNames.join("|");
        }
        return value;
      },
      2
    );
    if (!file) {
      console.log(result);
    } else {
      fs.writeFileSync(file, result);
    }
  }

  _sumRewards(obj: Record<string, unknown>) {
    let totalReward = new Decimal(0);

    for (const [key, value] of Object.entries(obj)) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key === "reward" && typeof value === "number") {
          totalReward = totalReward.add(value);
        } else if (typeof value === "object") {
          totalReward = totalReward.add(this._sumRewards(value as Record<string, unknown>));
        }
      }
    }

    return totalReward.toNumber();
  }
}

export interface Module {
  transform(data: Readonly<GetActivity>, result: Result): Promise<Result>;
  get enabled(): boolean;
}

export interface Result {
  [k: string]: {
    comments?: GithubComment[];
    total: number;
    task?: {
      reward: number;
    };
  };
}

export interface GithubComment {
  content: string;
  url: string;
  type: CommentType;
  score?: {
    formatting?: {
      content: Record<string, { count: number; score: number }>;
      formattingMultiplier: number;
      wordValue: number;
    };
    relevance?: number;
    clarity?: number;
    reward: number;
  };
}
