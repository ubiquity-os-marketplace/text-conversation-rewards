import { Value } from "@sinclair/typebox/value";
import Decimal from "decimal.js";
import { JSDOM } from "jsdom";
import MarkdownIt from "markdown-it";
import { commentEnum, CommentType } from "../configuration/comment-types";
import {
  FormattingEvaluatorConfiguration,
  formattingEvaluatorConfigurationType,
  urlRegex,
  wordRegex,
} from "../configuration/formatting-evaluator-config";
import { IssueActivity } from "../issue-activity";
import { BaseModule } from "../types/module";
import { GithubCommentScore, Result, WordResult } from "../types/results";
import { typeReplacer } from "../helpers/result-replacer";
import { ContextPlugin } from "../types/plugin-input";
import { GitHubIssue } from "../github-types";

interface Multiplier {
  multiplier: number;
  html: FormattingEvaluatorConfiguration["multipliers"][0]["rewards"]["html"];
  wordValue: number;
}

export class FormattingEvaluatorModule extends BaseModule {
  private readonly _configuration: FormattingEvaluatorConfiguration | null =
    this.context.config.incentives.formattingEvaluator;
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

  constructor(context: ContextPlugin) {
    super(context);
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
    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments || [];
      for (const comment of comments) {
        const { formatting, words } = this._getFormattingScore(comment);
        const multiplierFactor = this._multipliers?.[comment.type] ?? { multiplier: 0 };
        const formattingTotal = this._calculateFormattingTotal(formatting, words, multiplierFactor).toDecimalPlaces(2);
        const priority = this._parsePriorityLabel(data.self?.labels);
        const reward = (comment.score?.reward ? formattingTotal.add(comment.score.reward) : formattingTotal).toNumber();
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
      this.context.logger.error("Invalid / missing configuration detected for FormattingEvaluatorModule, disabling.");
      return false;
    }
    return true;
  }

  _getFormattingScore(comment: GithubCommentScore) {
    // Change the \r to \n to fix markup interpretation
    const html = this._md.render(comment.content.replaceAll("\r", "\n"));
    this.context.logger.debug("Will analyze formatting for the current content:", { comment: comment.content, html });
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
    const urlSet = new Set<string>();

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
        this.context.logger.error(
          `Could not find multiplier for element <${tagName}> with association <${typeReplacer("type", commentType)}> in comment [${element.outerHTML}]`
        );
        element.remove();
        continue;
      }
      if (tagName === "a") {
        const url = element.getAttribute("href");
        if (url) {
          urlSet.add(url.split(/[#?]/)[0]);
        }
      } else {
        const bodyContent = element.textContent;
        const matches = bodyContent?.match(urlRegex);
        matches?.map((url) => url.split(/[#?]/)[0]).forEach((url) => urlSet.add(url));
        this._updateTagCount(formatting, tagName, score);
      }
    }
    urlSet.forEach(() => {
      this._updateTagCount(formatting, "a", this._multipliers[commentType].html["a"].score ?? 0);
    });
    const words = this._countWordsFromRegex(
      htmlElement.textContent?.replace(urlRegex, "") ?? "",
      this._multipliers[commentType]?.wordValue
    );

    return { formatting, words };
  }

  _parsePriorityLabel(labels: GitHubIssue["labels"] | undefined) {
    if (!labels) return 1;

    for (const label of labels) {
      const priorityLabel = typeof label === "string" ? label : (label.name ?? "");
      const matched = priorityLabel.match(/^Priority:\s*(\d+)/i);

      if (matched) {
        const urgency = Number(matched[1]);
        if (urgency) return urgency;
      }
    }

    return 1;
  }
}
