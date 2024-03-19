import * as fs from "fs";
import configuration from "../configuration/config-reader";
import { GetActivity } from "../get-activity";
import program from "./command-line";

export class Processor {
  private _transformers: Array<Transformer> = [];
  private _result: Result = {};
  private readonly _configuration = configuration;

  add(transformer: Transformer) {
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
    const result = JSON.stringify(this._result, undefined, 2);
    if (!file) {
      console.log(result);
    } else {
      fs.writeFileSync(file, result);
    }
  }
  _sumRewards(obj: Record<string, object | number>) {
    let totalReward = 0;

    for (const [key, value] of Object.entries(obj)) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key === "reward" && typeof value === "number") {
          totalReward += value;
        } else if (typeof value === "object") {
          totalReward += this._sumRewards(value as Record<string, object>);
        }
      }
    }

    return totalReward;
  }
}

export interface Transformer {
  transform(data: Readonly<GetActivity>, result: Result): Result | Promise<Result>;
  get enabled(): boolean;
}

export interface Result {
  [k: string]: {
    comments?: Array<Comment>;
    total: number;
    bounty?: {
      reward: number;
    };
  };
}

export interface Comment {
  content: string;
  contentHtml?: string;
  url: string;
  score?: {
    formatting?: number;
    relevance?: number;
    reward: number;
  };
}
