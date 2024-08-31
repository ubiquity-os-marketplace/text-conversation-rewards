import { Value } from "@sinclair/typebox/value";
import Decimal from "decimal.js";
import { JSDOM } from "jsdom";
import MarkdownIt from "markdown-it";
import { commentEnum, CommentType } from "../configuration/comment-types";
import configuration from "../configuration/config-reader";
import {
  FormattingEvaluatorConfiguration,
  formattingEvaluatorConfigurationType,
} from "../configuration/formatting-evaluator-config";
import logger from "../helpers/logger";
import { IssueActivity } from "../issue-activity";
import { GithubCommentScore, Module, Result } from "./processor";

interface Multiplier {
  multiplier: number;
  html: FormattingEvaluatorConfiguration["multipliers"][0]["rewards"]["html"];
  regex: FormattingEvaluatorConfiguration["multipliers"][0]["rewards"]["regex"];
}

export class FormattingEvaluatorModule implements Module {
  private readonly _configuration: FormattingEvaluatorConfiguration | null =
    configuration.incentives.formattingEvaluator;
  private readonly _md = new MarkdownIt();
  private readonly _multipliers: { [k: number]: Multiplier } = {};
  private readonly _wordCountExponent: number;

  _getEnumValue(key: CommentType) {
    let res = 0;

    key.split("_").forEach((value) => {
      res |= Number(commentEnum[value as keyof typeof commentEnum]);
    });
    return res;
  }

  constructor() {
    if (this._configuration?.multipliers) {
      this._multipliers = this._configuration.multipliers.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.role.reduce((a, b) => this._getEnumValue(b) | a, 0)]: {
            html: curr.rewards.html,
            multiplier: curr.multiplier,
            regex: curr.rewards.regex,
          },
        };
      }, {});
    }
    this._wordCountExponent = this._configuration?.wordCountExponent ?? 0.85;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments || [];
      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        const { formatting } = this._getFormattingScore(comment);
        const multiplierFactor = this._multipliers?.[comment.type] ?? { multiplier: 0 };
        const formattingTotal = this._calculateFormattingTotal(formatting, multiplierFactor);
        comment.score = {
          ...comment.score,
          formatting: {
            content: formatting,
            multiplier: multiplierFactor.multiplier,
          },
          reward: (comment.score?.reward ? formattingTotal.add(comment.score.reward) : formattingTotal).toNumber(),
        };
      }
    }
    return result;
  }

  private _calculateFormattingTotal(
    formatting: ReturnType<typeof this._getFormattingScore>["formatting"],
    multiplierFactor: Multiplier
  ): Decimal {
    if (!formatting) return new Decimal(0);

    return Object.values(formatting).reduce((acc, curr) => {
      let sum = new Decimal(0);

      for (const symbol of Object.keys(curr.symbols)) {
        const count = new Decimal(curr.symbols[symbol].count);
        const symbolMultiplier = new Decimal(curr.symbols[symbol].multiplier);
        const formattingElementScore = new Decimal(curr.score);
        const exponent = this._wordCountExponent;

        sum = sum.add(
          count
            .pow(exponent) // (count^exponent)
            .mul(symbolMultiplier) // symbol multiplier
            .mul(formattingElementScore) // comment type multiplier
            .mul(multiplierFactor.multiplier) // formatting element score
        );
      }
      return acc.add(sum);
    }, new Decimal(0));
  }

  get enabled(): boolean {
    if (!Value.Check(formattingEvaluatorConfigurationType, this._configuration)) {
      console.warn("Invalid / missing configuration detected for FormattingEvaluatorModule, disabling.");
      return false;
    }
    return true;
  }

  _getFormattingScore(comment: GithubCommentScore) {
    const html = this._md.render(comment.content);
    const temp = new JSDOM(html);
    if (temp.window.document.body) {
      const res = this.classifyTagsWithWordCount(temp.window.document.body, comment.type);
      return { formatting: res };
    } else {
      throw new Error(`Could not create DOM for comment [${comment}]`);
    }
  }

  _countWords(regexes: FormattingEvaluatorConfiguration["multipliers"][0]["rewards"]["regex"], text: string) {
    const counts: { [p: string]: { count: number; multiplier: number } } = {};
    for (const [regex, multiplier] of Object.entries(regexes)) {
      const match = text.trim().match(new RegExp(regex, "g"));
      counts[regex] = {
        count: match?.length || 1,
        multiplier,
      };
    }
    return counts;
  }

  classifyTagsWithWordCount(htmlElement: HTMLElement, commentType: GithubCommentScore["type"]) {
    const tagWordCount: Record<
      string,
      { symbols: { [p: string]: { count: number; multiplier: number } }; score: number }
    > = {};
    const elements = htmlElement.getElementsByTagName("*");

    for (const element of elements) {
      const tagName = element.tagName.toLowerCase();
      const wordCount = this._countWords(this._multipliers[commentType].regex, element.textContent || "");
      let score = 0;
      if (this._multipliers[commentType]?.html[tagName] !== undefined) {
        score = this._multipliers[commentType].html[tagName];
      } else {
        logger.error(`Could not find multiplier for comment [${commentType}], <${tagName}>`);
      }
      tagWordCount[tagName] = {
        symbols: wordCount,
        score,
      };
    }

    return tagWordCount;
  }
}
