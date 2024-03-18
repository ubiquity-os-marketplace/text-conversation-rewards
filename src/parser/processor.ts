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
}

export interface Transformer {
  transform(data: Readonly<GetActivity>, result: Result): Result | Promise<Result>;
  get enabled(): boolean;
}

export interface Result {
  [k: string]: {
    comments?: Array<Comment>;
    totalReward: number;
  };
}

export interface Comment {
  content: string;
  contentHtml?: string;
  url: string;
  score?: {
    formatting?: number;
    relevance: number;
    reward: number;
  };
}
