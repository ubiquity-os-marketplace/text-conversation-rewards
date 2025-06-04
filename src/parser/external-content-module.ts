import { GithubCommentScore, Result } from "../types/results";
import { JSDOM } from "jsdom";
import OpenAI from "openai";
import { BaseModule } from "../types/module";
import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";
import { ExternalContentConfig } from "../configuration/external-content-config";
import { marked } from "marked";
import { encode } from "he";
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
      await this._handleAnchorElements(htmlElement, comment);
      await this._handleImageElements(htmlElement, comment);
    } else {
      throw new Error(`Could not create DOM for comment [${JSON.stringify(comment)}]`);
    }
  }

  private async _buildUserPrompt(href: string): Promise<ChatCompletionCreateParamsNonStreaming | null> {
    const linkResponse = await fetch(href);
    const contentType = linkResponse.headers.get("content-type");
    if (!contentType || (!contentType.startsWith("text/") && !contentType.startsWith("image/"))) return null;

    if (contentType?.startsWith("image/")) {
      const imageData = await linkResponse.arrayBuffer();
      const linkContent = Buffer.from(imageData).toString("base64");
      this.context.logger.debug("Analyzing image", { href, model: this._configuration.llmImageModel.model });
      return {
        model: this._configuration.llmImageModel.model,
        max_tokens: 1000,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that evaluates external images and summarise them.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this image concisely in one paragraph, written in a single line. Do not use bullet points, numbering, only plain sentences",
              },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${linkContent}` } },
            ],
          },
        ],
      };
    }
    const linkContent = await linkResponse.text();
    this.context.logger.debug("Evaluating anchor content", {
      href,
      contentType,
      model: this._configuration.llmWebsiteModel.model,
    });
    return {
      model: this._configuration.llmWebsiteModel.model,
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that evaluates external content and summarise it.",
        },
        {
          role: "user",
          content: `Summarise the following external content in one paragraph, written in a single line. Do not use bullet points, numbering, only plain sentences. The content is given to you as a "${contentType}" content.\n\n${linkContent}`,
        },
      ],
    };
  }

  private async _handleAnchorElements(htmlElement: HTMLElement, comment: GithubCommentScore) {
    const anchors = htmlElement.getElementsByTagName("a");
    for (const anchor of anchors) {
      const href = anchor.getAttribute("href");
      if (!href) continue;

      const linkResponse = await fetch(href);
      const contentType = linkResponse.headers.get("content-type");
      if (!contentType || (!contentType.startsWith("text/") && !contentType.startsWith("image/"))) continue;
      const prompt = await this._buildUserPrompt(href);
      if (!prompt) continue;
      const llmResponse = await this._llmWebsite.chat.completions.create(prompt);
      const altContent = llmResponse.choices[0]?.message?.content;
      if (!altContent) continue;

      const linkRegex = new RegExp(`\\[([^\\]]+)\\]\\(${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "g");
      comment.content = comment.content.replace(linkRegex, `[$1](${href} "${encode(altContent)}")`);
    }
  }

  private async _handleImageElements(htmlElement: HTMLElement, comment: GithubCommentScore) {
    const images = htmlElement.getElementsByTagName("img");
    for (const image of images) {
      const src = image.getAttribute("src");
      if (!src) continue;

      const linkResponse = await fetch(src);
      const contentType = linkResponse.headers.get("content-type");
      if (!contentType || !contentType.startsWith("image/")) continue;

      const prompt = await this._buildUserPrompt(src);
      if (!prompt) continue;
      const llmResponse = await this._llmImage.chat.completions.create(prompt);
      const imageContent = llmResponse.choices[0]?.message?.content;
      if (!imageContent) continue;

      const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const imageRegex = new RegExp(`<img([^>]*?)alt="[^"]*"([^>]*?)src="${escapedSrc}"([^>]*?)\\s*/?>`, "g");
      comment.content = comment.content.replace(imageRegex, `<img$1alt="${encode(imageContent)}"$2src="${src}"$3 />`);
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
        for (const comment of data.comments) {
          await this.evaluateExternalElements(comment);
        }
      }
    }
    return result;
  }
}
