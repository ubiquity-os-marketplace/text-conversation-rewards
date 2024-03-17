import { GetActivity } from "../get-activity";

export class Processor {
  private _transformers: Array<Transformer> = [];
  private _result: Result = {};

  add(transformer: Transformer, enabled = true) {
    console.log("Adding elem");
    if (enabled) {
      this._transformers.push(transformer);
    }
    return this;
  }
  run(data: GetActivity) {
    for (const transformer of this._transformers) {
      transformer.transform(data, this._result);
    }
    return this._result;
  }
}

export interface Transformer {
  transform(data: GetActivity, result: Result): Result;
}

export interface Result {
  [k: string]: {
    comment: string;
  };
}
