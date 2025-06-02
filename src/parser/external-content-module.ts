import { GithubCommentScore, Result } from "../types/results";
import MarkdownIt from "markdown-it";
import { JSDOM } from "jsdom";
import OpenAI from "openai";
import { BaseModule } from "../types/module";
import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";
import { ExternalContentConfig } from "../configuration/external-content-config";

export class ExternalContentProcessor extends BaseModule {
  private readonly _md = new MarkdownIt();
  readonly _configuration: ExternalContentConfig | null = this.context.config.incentives.externalContent;
  readonly _openAi = new OpenAI({
    apiKey: this.context.env.OPENROUTER_API_KEY,
    ...(this._configuration?.llmWebsiteModel.endpoint && { baseURL: this._configuration?.llmWebsiteModel.endpoint }),
  });

  constructor(context: ContextPlugin) {
    super(context);
  }

  public async evaluateExternalElements(comment: GithubCommentScore) {
    const html = this._md.render(comment.content.replaceAll("\r", "\n"));
    const jsDom = new JSDOM(html);

    if (jsDom.window.document.body) {
      const htmlElement = jsDom.window.document.body;
      await this._handleAnchorElements(htmlElement);
      await this._handleImageElements(htmlElement);
    } else {
      throw new Error(`Could not create DOM for comment [${JSON.stringify(comment)}]`);
    }
  }

  private async _handleAnchorElements(htmlElement: HTMLElement) {
    const anchors = htmlElement.getElementsByTagName("a");
    for (const anchor of anchors) {
      const href = anchor.getAttribute("href");
      if (!href) continue;
      const linkResponse = await fetch(href);
      const contentType = linkResponse.headers.get("content-type");
      if (!contentType || !contentType.startsWith("text/")) continue;
      const linkContent = await linkResponse.text();
      const llmResponse = await this._openAi.chat.completions.create({
        model: this._llmModel,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that evaluates external content and summerizes it.",
          },
          {
            role: "user",
            content: `Summarize the following external content in one paragraph, written in a single line: ${linkContent}`,
          },
        ],
      });
      const altContent = llmResponse.choices[0]?.message?.content;
      if (!altContent) continue;
      // Should replace the content in the comment
      console.log(altContent);
    }
  }

  private async _handleImageElements(htmlElement: HTMLElement) {
    const images = htmlElement.getElementsByTagName("img");
    for (const image of images) {
      const href = image.getAttribute("href");
      if (!href) continue;
      const linkResponse = await fetch(href);
      const contentType = linkResponse.headers.get("content-type");
      if (!contentType || !contentType.startsWith("image/")) continue;
      const imageData = await linkResponse.arrayBuffer();
      const base64Image = Buffer.from(imageData).toString("base64");
      const llmResponse = await this._openAi.chat.completions.create({
        model: this._llmModel,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that evaluates external images and summerizes it.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this image concisely in one paragraph, written in a single line." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
      });
      const imageContent = llmResponse.choices[0]?.message?.content;
      if (!imageContent) continue;
      // Should replace the content in the image
      console.log(imageContent);
    }
  }

  get enabled(): boolean {
    if (!this._configuration) {
      this.context.logger.warn(
        "The configuration for the module ExternalContentModule is invalid or missing, disabling."
      );
      return false;
    }
    return true;
  }

  transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    return Promise.resolve(result);
  }
}
