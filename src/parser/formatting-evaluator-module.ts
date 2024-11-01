import { Value } from "@sinclair/typebox/value";
import Decimal from "decimal.js";
import { JSDOM } from "jsdom";
import MarkdownIt from "markdown-it";
import { commentEnum, CommentType } from "../configuration/comment-types";
import configuration from "../configuration/config-reader";
import {
  FormattingEvaluatorConfiguration,
  formattingEvaluatorConfigurationType,
  wordRegex,
} from "../configuration/formatting-evaluator-config";
import logger from "../helpers/logger";
import { IssueActivity } from "../issue-activity";
import { GithubCommentScore, Module, WordResult, Result } from "./processor";
import { typeReplacer } from "../helpers/result-replacer";
import { parsePriorityLabel } from "../helpers/label-price-extractor";

interface Multiplier {
  multiplier: number;
  html: FormattingEvaluatorConfiguration["multipliers"][0]["rewards"]["html"];
  wordValue: number;
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
          ...curr.role.reduce(
            (acc, a) => {
              acc[this._getEnumValue(a)] = {
                html: curr.rewards.html,
                multiplier: curr.multiplier,
                wordValue: curr.rewards.wordValue,
              };
              return acc;
            },
            {} as typeof this._multipliers
          ),
        };
      }, {});
    }
    this._wordCountExponent = this._configuration?.wordCountExponent ?? 0.85;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    logger.debug(JSON.stringify(data.self?.labels));
    logger.debug(String(parsePriorityLabel(data.self?.labels)));
    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments || [];
      for (const comment of comments) {
        const { formatting, words } = this._getFormattingScore(comment);
        const multiplierFactor = this._multipliers?.[comment.type] ?? { multiplier: 0 };
        const formattingTotal = this._calculateFormattingTotal(formatting, words, multiplierFactor).toDecimalPlaces(2);
        const priority = parsePriorityLabel(data.self?.labels);
        const reward =
          (comment.score?.reward ? formattingTotal.add(comment.score.reward) : formattingTotal).toNumber() * priority;
        comment.score = {
          ...comment.score,
          reward,
          formatting: {
            content: formatting,
            result: Object.values(formatting).reduce((acc, curr) => acc + curr.score * curr.elementCount, 0),
          },
          priority: priority,
          words,
          multiplier: multiplierFactor.multiplier,
        };
      }
    }
    return result;
  }

  private _calculateFormattingTotal(
    formatting: ReturnType<typeof this._getFormattingScore>["formatting"],
    regex: WordResult,
    multiplierFactor: Multiplier
  ): Decimal {
    if (!formatting) return new Decimal(0);

    let sum = new Decimal(0);
    Object.values(formatting).forEach((formattingElement) => {
      const score = new Decimal(formattingElement.score);
      const elementTotalValue = score.mul(formattingElement.elementCount);
      sum = sum.add(elementTotalValue);
    });

    sum = sum.add(new Decimal(regex.result));
    return sum.mul(multiplierFactor.multiplier);
  }

  get enabled(): boolean {
    if (!Value.Check(formattingEvaluatorConfigurationType, this._configuration)) {
      console.warn("Invalid / missing configuration detected for FormattingEvaluatorModule, disabling.");
      return false;
    }
    return true;
  }

  _getFormattingScore(comment: GithubCommentScore) {
    // Change the \r to \n to fix markup interpretation
    const html = this._md.render(comment.content.replaceAll("\r", "\n"));
    logger.debug("Will analyze formatting for the current content:", { comment: comment.content, html });
    const temp = new JSDOM(html);
    if (temp.window.document.body) {
      const res = this._classifyTagsWithWordCount(temp.window.document.body, comment.type);
      return { formatting: res.formatting, words: res.words };
    } else {
      throw new Error(`Could not create DOM for comment [${JSON.stringify(comment)}]`);
    }
  }

  _countWordsFromRegex(text: string, wordValue = 0): WordResult {
    const match = text.trim().match(new RegExp(wordRegex, "g"));
    const wordCount = match?.length ?? 0;
    const result = new Decimal(wordCount).pow(this._wordCountExponent).mul(wordValue).toDecimalPlaces(2).toNumber();
    return {
      wordCount,
      wordValue,
      result,
    };
  }

  _updateTagCount(tagCount: Record<string, { score: number; elementCount: number }>, tagName: string, score: number) {
    // If we already had that tag included in the result, merge them and update total count
    if (Object.keys(tagCount).includes(tagName)) {
      tagCount[tagName].elementCount += 1;
    } else {
      tagCount[tagName] = {
        score,
        elementCount: 1,
      };
    }
  }

  _classifyTagsWithWordCount(htmlElement: HTMLElement, commentType: GithubCommentScore["type"]) {
    const formatting: Record<string, { score: number; elementCount: number }> = {};
    const elements = htmlElement.getElementsByTagName("*");

    for (const element of elements) {
      const tagName = element.tagName.toLowerCase();
      let score = 0;
      if (this._multipliers[commentType]?.html[tagName] !== undefined) {
        score = this._multipliers[commentType].html[tagName].score;
        if (!this._multipliers[commentType].html[tagName].countWords) {
          element.textContent = "";
          continue;
        }
      } else {
        logger.error(
          `Could not find multiplier for element <${tagName}> with association <${typeReplacer("type", commentType)}> in comment [${element.outerHTML}]`
        );
        element.remove();
        continue;
      }
      this._updateTagCount(formatting, tagName, score);
    }
    const words = this._countWordsFromRegex(htmlElement.textContent ?? "", this._multipliers[commentType]?.wordValue);
    return { formatting, words };
  }
}
