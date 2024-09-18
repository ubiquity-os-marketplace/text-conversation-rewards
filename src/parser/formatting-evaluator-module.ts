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
import { GithubCommentScore, Module, RegexCount, Result } from "./processor";

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
        const formattingTotal = this._calculateFormattingTotal(formatting, multiplierFactor).toDecimalPlaces(2);
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

      for (const symbol of Object.keys(curr.regex)) {
        const wordCount = new Decimal(curr.regex[symbol].wordCount);
        const wordValue = new Decimal(curr.regex[symbol].wordValue);
        const score = new Decimal(curr.score);
        const exponent = this._wordCountExponent;

        const wordTotalValue = wordCount
          .pow(exponent) // (count^exponent)
          .mul(wordValue); // symbol multiplier
        const elementTotalValue = score.mul(curr.elementCount); // comment type multiplier

        sum = sum.add(wordTotalValue.add(elementTotalValue));
      }
      return acc.add(sum.mul(multiplierFactor.multiplier)); // formatting element score
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
    // Change the \r to \n to fix markup interpretation
    const html = this._md.render(comment.content.replaceAll("\r", "\n"));
    logger.debug("Will analyze formatting for the current content", { comment: comment.content, html });
    const temp = new JSDOM(html);
    if (temp.window.document.body) {
      const res = this._classifyTagsWithWordCount(temp.window.document.body, comment.type);
      return { formatting: res };
    } else {
      throw new Error(`Could not create DOM for comment [${comment}]`);
    }
  }

  _countSymbolsFromRegex(
    regexes: FormattingEvaluatorConfiguration["multipliers"][0]["rewards"]["regex"],
    text: string
  ) {
    const counts: RegexCount = {};
    for (const [regex, wordValue] of Object.entries(regexes)) {
      const match = text.trim().match(new RegExp(regex, "g"));
      counts[regex] = {
        wordCount: match?.length || 0,
        wordValue: wordValue,
      };
    }
    return counts;
  }

  _updateTagCount(
    tagCount: Record<string, { regex: RegexCount; score: number; elementCount: number }>,
    tagName: string,
    regexCount: RegexCount,
    score: number
  ) {
    // If we already had that tag included in the result, merge them and update total count
    if (Object.keys(tagCount).includes(tagName)) {
      for (const [k, v] of Object.entries(regexCount)) {
        if (Object.keys(tagCount[tagName].regex).includes(k)) {
          tagCount[tagName].regex[k] = {
            ...tagCount[tagName].regex[k],
            wordCount: tagCount[tagName].regex[k].wordCount + v.wordCount,
          };
          tagCount[tagName].elementCount += 1;
        }
      }
    } else {
      tagCount[tagName] = {
        regex: regexCount,
        score,
        elementCount: 1,
      };
    }
  }

  _classifyTagsWithWordCount(htmlElement: HTMLElement, commentType: GithubCommentScore["type"]) {
    const tagCount: Record<string, { regex: RegexCount; score: number; elementCount: number }> = {};
    const elements = htmlElement.getElementsByTagName("*");

    for (const element of elements) {
      const tagName = element.tagName.toLowerCase();
      let score = 0;
      if (this._multipliers[commentType]?.html[tagName] !== undefined) {
        score = this._multipliers[commentType].html[tagName];
        if (score === 0) {
          element.remove();
          continue;
        }
      } else {
        logger.error(`Could not find multiplier for element <${tagName}> in comment [${element.outerHTML}]`);
        element.remove();
        continue;
      }

      // We cannot use textContent otherwise we would duplicate counts, so instead we extract text nodes
      const textNodes = Array.from(element?.childNodes || []).filter((node) => node.nodeType === 3);
      const innerText = textNodes
        .map((node) => node.nodeValue?.trim())
        .join(" ")
        .trim();
      const regexCount = this._countSymbolsFromRegex(this._multipliers[commentType].regex, innerText);

      this._updateTagCount(tagCount, tagName, regexCount, score);
    }
    return tagCount;
  }
}
