import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";
import he from "he";
import { JSDOM } from "jsdom";
import { marked } from "marked";
import OpenAI from "openai";
import { ExternalContentConfig } from "../configuration/external-content-config";
import { checkLlmRetryableState, retry } from "../helpers/retry";
import { IssueActivity } from "../issue-activity";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { GithubCommentScore, Result } from "../types/results";
import { CommentKind } from "../configuration/comment-types";
import ChatCompletionCreateParamsNonStreaming = OpenAI.ChatCompletionCreateParamsNonStreaming;

export class ExternalContentProcessor extends BaseModule {
  private readonly _isEnabled: boolean;
  readonly _configuration: ExternalContentConfig;
  readonly _llmImage: OpenAI;
  readonly _llmWebsite: OpenAI;

  constructor(context: ContextPlugin) {
    super(context);
    const config = this.context.config.incentives.externalContent;
    this._isEnabled = !!config;

    if (config) {
      this._configuration = config;
      this._llmImage = new OpenAI({
        apiKey: this.context.env.OPENROUTER_API_KEY,
        ...(config.llmImageModel.endpoint && { baseURL: config.llmImageModel.endpoint }),
      });
      this._llmWebsite = new OpenAI({
        apiKey: this.context.env.OPENROUTER_API_KEY,
        ...(config.llmWebsiteModel.endpoint && { baseURL: config.llmWebsiteModel.endpoint }),
      });
    } else {
      this._configuration = {} as ExternalContentConfig;
      this._llmImage = {} as OpenAI;
      this._llmWebsite = {} as OpenAI;
    }
  }

  public async evaluateExternalElements(comment: GithubCommentScore) {
    const html = await marked(comment.content);
    const jsDom = new JSDOM(html);

    if (jsDom.window.document.body) {
      const htmlElement = jsDom.window.document.body;
      await this._handleExternalElements(htmlElement, comment);
    } else {
      throw new Error(`Could not create DOM for comment [${JSON.stringify(comment)}]`);
    }
  }

  private async _buildUserPrompt(linkResponse: Response): Promise<ChatCompletionCreateParamsNonStreaming | null> {
    const contentType = linkResponse.headers.get("content-type");
    if (!contentType || (!contentType.startsWith("text/") && !contentType.startsWith("image/"))) return null;

    if (contentType?.startsWith("image/")) {
      const imageData = await linkResponse.arrayBuffer();
      const linkContent = Buffer.from(imageData).toString("base64");
      this.context.logger.debug("Analyzing image", {
        href: linkResponse.url,
        model: this._configuration.llmImageModel.model,
      });
      return {
        model: this._configuration.llmImageModel.model,
        max_tokens: 1000,
        messages: [
          {
            role: "system",
            content: "You are an assistant that analyzes external images and provides factual descriptions.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Provide a direct factual description in one paragraph, written in a single line. Start immediately with what you observe without introductory phrases. Focus on factual content and avoid subjective adjectives or emotional language. Do not use bullet points or numbering, only plain sentences.",
              },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${linkContent}` } },
            ],
          },
        ],
        // @ts-expect-error Supported by OpenRouter: https://openrouter.ai/docs/features/message-transforms
        transforms: ["middle-out"],
      };
    }
    const linkContent = await linkResponse.text();
    this.context.logger.debug("Evaluating anchor content", {
      href: linkResponse.url,
      contentType,
      model: this._configuration.llmWebsiteModel.model,
    });
    return {
      model: this._configuration.llmWebsiteModel.model,
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: "You are an assistant that analyzes external content and provides factual summaries.",
        },
        {
          role: "user",
          content: `Provide a direct factual summary in one paragraph, written in a single line. Start immediately with the key information without introductory phrases. Focus on factual information and avoid subjective language or emotional adjectives. Do not use bullet points or numbering, only plain sentences. The content is provided as "${contentType}" content.\n\n${linkContent}`,
        },
      ],
      // @ts-expect-error Supported by OpenRouter: https://openrouter.ai/docs/features/message-transforms
      transforms: ["middle-out"],
    };
  }

  private async _handleExternalElements(htmlElement: HTMLElement, comment: GithubCommentScore) {
    const anchors = htmlElement.getElementsByTagName("a");
    const images = htmlElement.getElementsByTagName("img");

    const processElement = async (element: HTMLAnchorElement | HTMLImageElement, isImage: boolean) => {
      const url = isImage
        ? (element as HTMLImageElement).getAttribute("src")
        : (element as HTMLAnchorElement).getAttribute("href");
      if (!url) return;

      const altContent = await retry(
        async () => {
          let linkResponse: Response;
          try {
            linkResponse = await fetch(url);
            if (!linkResponse.ok) {
              this.context.logger.warn("Failed to fetch the content of an external element.", {
                url,
                status: linkResponse.status,
              });
              return null;
            }
          } catch (e) {
            this.context.logger.warn(`The URL [${url}] could not be processed.`, { e });
            return null;
          }
          const contentType = linkResponse.headers.get("content-type");
          if (!contentType || (!contentType.startsWith("text/") && !contentType.startsWith("image/"))) return null;
          if (isImage && !contentType.startsWith("image/")) return null;

          const prompt = await this._buildUserPrompt(linkResponse);
          if (!prompt) return null;
          const llmResponse =
            await this[contentType.startsWith("image/") ? "_llmImage" : "_llmWebsite"].chat.completions.create(prompt);
          if (!llmResponse.choices?.length || !llmResponse.choices[0]?.message?.content) {
            throw this.context.logger.error("Failed to generate a description for the given external element.", {
              url,
              contentType,
              llmResponse,
            });
          }
          return llmResponse.choices[0].message.content;
        },
        {
          maxRetries: this._configuration[isImage ? "llmImageModel" : "llmWebsiteModel"].maxRetries,
          isErrorRetryable: (error) => {
            const llmRetryable = checkLlmRetryableState(error);
            return llmRetryable || error instanceof LogReturn;
          },
          onError: (e) => {
            this.context.logger.warn("Failed to run the LLM.", { url, e });
          },
        }
      );

      if (!altContent) return;

      const escapedSrc = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const imageHtmlRegex = new RegExp(`<img([^>]*?)src="${escapedSrc}"([^>]*?)\\s*/?>`, "g");
      comment.content = comment.content.replace(imageHtmlRegex, (match, beforeSrc, afterSrc) => {
        if (match.includes("alt=")) {
          return match.replace(/alt="[^"]*"/, `alt="${he.encode(altContent)}"`);
        } else {
          return `<img${beforeSrc}alt="${he.encode(altContent)}" src="${url}"${afterSrc} />`;
        }
      });
      // Image elements can be either contained in <img> elements or in Markdown format
      const linkRegex = new RegExp(`\\[([^\\]]+)\\]\\(${escapedSrc}\\)`, "g");
      comment.content = comment.content.replace(linkRegex, `[$1](${url} "${he.encode(altContent)}")`);
    };

    for (const anchor of anchors) {
      await processElement(anchor, false);
    }

    for (const image of images) {
      await processElement(image, true);
    }
  }

  get enabled(): boolean {
    if (!this._isEnabled) {
      this.context.logger.warn(
        "The configuration for the module ExternalContentProcessor is invalid or missing, disabling."
      );
    }
    return this._isEnabled;
  }

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    for (const data of Object.values(result)) {
      if (data.comments?.length) {
        for (const comment of data.comments.filter((comment) => comment.commentType & CommentKind.ISSUE)) {
          await this.evaluateExternalElements(comment);
        }
      }
    }
    return result;
  }
}
