import * as fs from "fs";
import { GetActivity } from "../get-activity";
import program from "./command-line";

export class Processor {
  private _transformers: Array<Transformer> = [];
  private _result: Result = {};

  add(transformer: Transformer, enabled = true) {
    if (enabled) {
      this._transformers.push(transformer);
    }
    return this;
  }
  run(data: Readonly<GetActivity>) {
    for (const transformer of this._transformers) {
      this._result = transformer.transform(data, this._result);
    }
    return this._result;
  }
  dump() {
    const { file } = program.opts();
    const data = JSON.stringify(this._result, undefined, 2);
    if (!file) {
      console.log(data);
    } else {
      fs.writeFileSync(file, data);
    }
  }
}

export interface Transformer {
  transform(data: Readonly<GetActivity>, result: Result): Result;
}

export interface Result {
  [k: string]: {
    comments: Array<Comment>;
    totalReward: number;
  };
}

export interface Comment {
  content: string;
  formatting: number;
  relevance: number;
  reward: number;
}
