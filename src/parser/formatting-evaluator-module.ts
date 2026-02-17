import { Value } from "@sinclair/typebox/value";
import Decimal from "decimal.js";
import { JSDOM } from "jsdom";
import { marked } from "marked";
import { CommentAssociation, commentEnum, CommentType } from "../configuration/comment-types";
import {
  FormattingEvaluatorConfiguration,
  formattingEvaluatorConfigurationType,
  urlRegex,
  wordRegex,
} from "../configuration/formatting-evaluator-config";
import { getCharacterContributionPercentages } from "../helpers/diff-count";
import { commentTypeReplacer } from "../helpers/result-replacer";
import { areBaseUrlsEqual } from "../helpers/urls";
import { IssueActivity } from "../issue-activity";
import { parseGitHubUrl } from "../start";
import { IssueEdits, QUERY_ISSUE_EDITS } from "../types/comment-edits";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { GithubCommentScore, ReadabilityScore, Result, WordResult } from "../types/results";

interface Multiplier {
  multiplier: number;
  html: FormattingEvaluatorConfiguration["multipliers"][0]["rewards"]["html"];
  wordValue: number;
}

type IssueEditNode = IssueEdits["repository"]["issue"]["userContentEdits"]["nodes"][number];

export class FormattingEvaluatorModule extends BaseModule {
  private readonly _configuration: FormattingEvaluatorConfiguration | null =
    this.context.config.incentives.formattingEvaluator;
  private readonly _multipliers: { [k: number]: Multiplier } = {};
  private readonly _wordCountExponent: number;
  private readonly _readabilityConfig: FormattingEvaluatorConfiguration["readabilityScoring"];

  _getEnumValue(key: CommentType) {
    let res = 0;

    key.split("_").forEach((value) => {
      res |= Number(commentEnum[value as keyof typeof commentEnum]);
    });
    return res;
  }

  constructor(context: ContextPlugin) {
    super(context);
    this._readabilityConfig = this._configuration?.readabilityScoring ?? {
      enabled: true,
      weight: 0.3,
      targetReadabilityScore: 60,
    };
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

  private _countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
    word = word.replace(/^y/, "");
    const syllables = word.match(/[aeiouy]{1,2}/g);
    return syllables ? syllables.length : 1;
  }

  private _calculateFleschKincaid(text: string): ReadabilityScore {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length ?? 1;
    const wordMatches = [];
    const wordRegexObj = new RegExp(wordRegex, "g");
    let match;

    while ((match = wordRegexObj.exec(text)) !== null) {
      wordMatches.push(match[0]);
    }

    const words = wordMatches.length > 0 ? wordMatches : [];
    const wordCount = words.length ?? 1;
    const syllableCount = words.reduce((count, word) => count + this._countSyllables(word), 0);
    const wordsPerSentence = wordCount / Math.max(1, sentences);
    const syllablesPerWord = syllableCount / Math.max(1, wordCount);
    const rawFleschKincaid = sentences && wordCount ? 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord : 0;
    const fleschKincaid = Math.max(0, Math.min(100, rawFleschKincaid));

    // Normalize score between 0 and 1
    let normalizedScore: number;
    if (rawFleschKincaid > 100) {
      normalizedScore = 1.0;
    } else if (rawFleschKincaid <= 0) {
      normalizedScore = 0.0;
    } else {
      const distance = Math.abs(rawFleschKincaid - (this._readabilityConfig?.targetReadabilityScore ?? 60));
      normalizedScore = Math.max(0, Math.min(1, (100 - distance) / 100));
    }

    return {
      fleschKincaid,
      syllables: syllableCount,
      sentences,
      score: normalizedScore,
    };
  }

  async _getOriginalAuthorshipPercentage(username: string, comment: GithubCommentScore) {
    if (!(comment.commentType & CommentAssociation.SPECIFICATION)) {
      return 1;
    }
    if (!("issue" in this.context.payload) || this.context.payload.issue.pull_request) {
      return 1;
    }
    const htmlUrl = this.context.payload.issue.html_url;
    const { owner, repo, issue_number } = parseGitHubUrl(htmlUrl);
    const data = await this.context.octokit.graphql.paginate<IssueEdits>(QUERY_ISSUE_EDITS, {
      owner,
      repo,
      issue_number,
    });

    const userEdits = data.repository.issue.userContentEdits.nodes.sort((a: IssueEditNode, b: IssueEditNode) => {
      return new Date(a.editedAt).getTime() - new Date(b.editedAt).getTime();
    });

    if (!userEdits.length) {
      this.context.logger.debug("No edits detected on the issue body, skipping.");
      return 1;
    }

    const result = getCharacterContributionPercentages(userEdits);

    return result[username] || 1;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments ?? [];
      for (const comment of comments) {
        const { formatting, words, readability } = await this._getFormattingScore(comment);
        const multiplierFactor = this._multipliers?.[comment.commentType] ?? { multiplier: 0 };
        const formattingTotal = this._calculateFormattingTotal(
          formatting,
          words,
          multiplierFactor,
          readability
        ).toDecimalPlaces(2);
        const priority = await this.computePriority(data);
        const authorship = await this._getOriginalAuthorshipPercentage(key, comment);
        const reward = (comment.score?.reward ? formattingTotal.add(comment.score.reward) : formattingTotal)
          .mul(authorship)
          .toNumber();
        comment.score = {
          ...comment.score,
          reward,
          formatting: {
            content: formatting,
            result: this._calculateFormattingResult(formatting),
          },
          priority: priority,
          words,
          readability,
          multiplier: multiplierFactor.multiplier,
          authorship,
        };
      }
    }
    return result;
  }

  private _calculateFormattingResult(formatting: Awaited<ReturnType<typeof this._getFormattingScore>>["formatting"]) {
    return Object.values(formatting)
      .reduce((acc, curr) => acc.add(new Decimal(curr.score).mul(new Decimal(curr.elementCount))), new Decimal(0))
      .toDecimalPlaces(3)
      .toNumber();
  }

  private _calculateFormattingTotal(
    formatting: Awaited<ReturnType<typeof this._getFormattingScore>>["formatting"],
    regex: WordResult,
    multiplierFactor: Multiplier,
    readability?: ReadabilityScore
  ): Decimal {
    if (!formatting) return new Decimal(0);

    let sum = new Decimal(0);
    Object.values(formatting).forEach((formattingElement) => {
      const score = new Decimal(formattingElement.score);
      const elementTotalValue = score.mul(formattingElement.elementCount);
      sum = sum.add(elementTotalValue);
    });

    sum = sum.add(new Decimal(regex.result));

    if (this._readabilityConfig.enabled && readability) {
      const readabilityScore = new Decimal(readability.score).mul(this._readabilityConfig.weight).mul(sum);
      sum = sum.add(readabilityScore);
    }

    return sum.mul(multiplierFactor.multiplier);
  }

  get enabled(): boolean {
    if (!Value.Check(formattingEvaluatorConfigurationType, this._configuration)) {
      this.context.logger.warn(
        "The configuration for the module FormattingEvaluatorModule is invalid or missing, disabling."
      );
      return false;
    }
    return true;
  }

  async _getFormattingScore(comment: GithubCommentScore) {
    const html = await marked(comment.content);
    this.context.logger.debug("Will analyze formatting for the current content:", { comment: comment.content, html });
    const temp = new JSDOM(html);
    if (temp.window.document.body) {
      const res = this._classifyTagsWithWordCount(temp.window.document.body, comment);
      const readability = this._calculateFleschKincaid(temp.window.document.body.textContent ?? "");
      return { formatting: res.formatting, words: res.words, readability };
    } else {
      throw new Error(`Could not create DOM for comment [${JSON.stringify(comment)}]`);
    }
  }

  _countWordsFromRegex(text: string, wordValue = 0): WordResult {
    const match = text.trim().match(new RegExp(wordRegex, "g"));
    const wordCount = match?.length ?? 0;
    const result = new Decimal(wordCount)
      .pow(this._wordCountExponent)
      .mul(Decimal.exp(new Decimal(wordCount).div(100).neg()))
      .mul(wordValue)
      .toDecimalPlaces(2)
      .toNumber();
    return {
      wordCount,
      wordValue,
      result,
    };
  }

  _updateTagCount(tagCount: Record<string, { score: number; elementCount: number }>, tagName: string, score: number) {
    if (Object.keys(tagCount).includes(tagName)) {
      tagCount[tagName].elementCount += 1;
    } else {
      tagCount[tagName] = {
        score,
        elementCount: 1,
      };
    }
  }

  _createUniqueEntryForAnchor(element: Element, commentScore: GithubCommentScore) {
    const url = element.getAttribute("href");
    if (url) {
      if (!areBaseUrlsEqual(url, commentScore.url)) {
        return url.split(/[#?]/)[0];
      }
    }
    return null;
  }

  _classifyTagsWithWordCount(htmlElement: HTMLElement, commentScore: GithubCommentScore) {
    const formatting: Record<string, { score: number; elementCount: number }> = {};
    const elements = htmlElement.getElementsByTagName("*");
    const urlSet = new Set<string>();
    const commentType = commentScore.commentType;

    for (const element of elements) {
      this._processElement(element, commentType, commentScore, formatting, urlSet);
    }

    this._addUrlsToFormatting(urlSet, formatting, commentType);
    const words = this._countWordsFromRegex(
      htmlElement.textContent?.replace(urlRegex, "") ?? "",
      this._multipliers[commentType]?.wordValue
    );

    return { formatting, words };
  }

  private _processElement(
    element: Element,
    commentType: number,
    commentScore: GithubCommentScore,
    formatting: Record<string, { score: number; elementCount: number }>,
    urlSet: Set<string>
  ) {
    const tagName = element.tagName.toLowerCase();
    const score = this._getElementScore(element, tagName, commentType);

    if (score === null) return;

    if (tagName === "a") {
      this._handleAnchorElement(element, commentScore, urlSet);
    } else {
      this._handleRegularElement(element, tagName, score, formatting, urlSet);
    }
  }

  private _getElementScore(element: Element, tagName: string, commentType: number): number | null {
    const multiplier = this._multipliers[commentType]?.html[tagName];

    if (multiplier === undefined) {
      this.context.logger.error(
        `Could not find multiplier for element <${tagName}> with association <${commentTypeReplacer("type", commentType)}> in comment [${element.outerHTML}]`
      );
      element.remove();
      return null;
    }

    if (!multiplier.countWords) {
      element.textContent = "";
      // img tags are expected to be empty most of the time
      if (tagName !== "img") {
        return null;
      }
    }

    return multiplier.score;
  }

  private _handleAnchorElement(element: Element, commentScore: GithubCommentScore, urlSet: Set<string>) {
    const newUrl = this._createUniqueEntryForAnchor(element, commentScore);
    if (newUrl) {
      urlSet.add(newUrl);
    }
  }

  private _handleRegularElement(
    element: Element,
    tagName: string,
    score: number,
    formatting: Record<string, { score: number; elementCount: number }>,
    urlSet: Set<string>
  ) {
    this._extractUrlsFromElement(element, urlSet);
    this._updateTagCount(formatting, tagName, score);
  }

  private _extractUrlsFromElement(element: Element, urlSet: Set<string>) {
    const bodyContent = element.textContent;
    if (!bodyContent) return;
    urlRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(bodyContent)) !== null) {
      const url = match[0].split(/[#?]/)[0];
      urlSet.add(url);
    }
  }

  private _addUrlsToFormatting(
    urlSet: Set<string>,
    formatting: Record<string, { score: number; elementCount: number }>,
    commentType: number
  ) {
    urlSet.forEach(() => {
      this._updateTagCount(formatting, "a", this._multipliers[commentType].html["a"].score ?? 0);
    });
  }
}
