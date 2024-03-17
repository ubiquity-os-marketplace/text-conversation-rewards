import { GetActivity } from "../get-activity";

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
    console.log(JSON.stringify(this._result, undefined, 2));
  }
}

export interface Transformer {
  transform(data: Readonly<GetActivity>, result: Result): Result;
}

export interface Result {
  [k: string]: {
    comments: Array<string>;
    amount: number;
  };
}
