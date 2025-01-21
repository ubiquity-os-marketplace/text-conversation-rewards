import { DataPurgeConfiguration } from "../configuration/data-purge-config";
import { GitHubPullRequestReviewComment } from "../github-types";
import { getAssignmentPeriods, isCommentDuringAssignment, UserAssignments } from "../helpers/user-assigned-timespan";
import { IssueActivity } from "../issue-activity";
import { parseGitHubUrl } from "../start";
import { BaseModule } from "../types/module";
import { Result } from "../types/results";
import OpenAI from "openai";

/**
 * Removes the data in the comments that we do not want to be processed.
 */
export class DataPurgeModule extends BaseModule {
  readonly _configuration: DataPurgeConfiguration | null = this.context.config.incentives.dataPurge;
  _assignmentPeriods: UserAssignments = {};

  readonly _openAi = new OpenAI({
    baseURL: this._configuration?.openAi?.endpoint ?? "https://openrouter.ai/api/v1",
    apiKey: this.context.env.OPENROUTER_API_KEY,
  });

  get enabled(): boolean {
    if (!this._configuration) {
      this.context.logger.error("Invalid / missing configuration detected for DataPurgeModule, disabling.");
      return false;
    }
    return true;
  }

  async _shouldSkipComment(comment: IssueActivity["allComments"][0]) {
    if ("isMinimized" in comment && comment.isMinimized) {
      this.context.logger.debug("Skipping hidden comment", { comment });
      return true;
    }
    if (
      this._configuration?.skipCommentsWhileAssigned &&
      this._configuration.skipCommentsWhileAssigned !== "none" &&
      comment.user?.login &&
      isCommentDuringAssignment(
        comment,
        this._assignmentPeriods[comment.user?.login],
        this._configuration.skipCommentsWhileAssigned === "exact"
      )
    ) {
      this.context.logger.debug("Skipping comment during assignment", {
        comment,
      });
      return true;
    }
    return false;
  }

  async _generateImageDescription(imageUrl: string): Promise<string | null> {
    try {
      const imageResponse = await fetch(imageUrl);
      const imageData = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageData).toString("base64");
      const response = await this._openAi.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this image concisely in one paragraph." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
        max_tokens: 200,
      });

      return response.choices[0]?.message?.content ?? null;
    } catch (error) {
      this.context.logger.error(`Failed to generate image description: ${error}`);
      return null;
    }
  }

  async _generateLinkDescription(linkUrl: string): Promise<string | null> {
    try {
      const linkResponse = await fetch(linkUrl);
      const contentType = linkResponse.headers.get("content-type");

      if (!contentType || (!contentType.includes("text/html") && !contentType.includes("text/plain"))) {
        this.context.logger.info(`Skipping non-HTML content: ${contentType}, ${linkUrl}`);
        return null;
      }

      const linkData = await linkResponse.text();
      const cleanText = linkData
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .replace(/{\s*"props".*$/s, "")
        .trim();

      const response = await this._openAi.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: `Summarize the following webpage code into a concise and easy-to-understand text explanation of one paragraph with no bullet points. Focus on describing the purpose, structure, and functionality of the code, including key elements such as layout, styles, scripts, and any interactive features. Avoid technical jargon unless necessary: ${cleanText}`,
          },
        ],
        max_tokens: 200,
      });

      return response.choices[0]?.message?.content ?? null;
    } catch (error) {
      this.context.logger.error(`Failed to generate link description: ${error}`);
      return null;
    }
  }

  private async _processCommentBody(commentBody: string): Promise<string> {
    // Extract image URL from Markdown or HTML image tags
    const imageMatch = commentBody.match(/!\[.*?\]\((.*?)\)/) || commentBody.match(/src="([^"]*)"/);
    const imageUrl = imageMatch ? imageMatch[1] : null;

    if (imageUrl) {
      const description = await this._generateImageDescription(imageUrl);
      if (description) {
        this.context.logger.info(`Generated description: ${description}`);

        // Update the commentBody by replacing alt with description
        const updatedContent = commentBody
          // Replace Markdown-style images with HTML <img> tags and set description attribute
          .replace(/!\[(.*?)\]\((.*?)\)/g, `<img src="$2" alt="${description}">`)
          // Replace the alt attribute with the description variable's value
          .replace(/alt="[^"]*"/, `alt="${description}"`);

        return updatedContent;
      }
    }

    return commentBody;
  }

  private async _processCommentBodyLink(commentBody: string): Promise<string> {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)|<a[^>]*href="([^"]+)"|https?:\/\/\S+/g;
    const links = [...commentBody.matchAll(linkRegex)]
      .map((match) => match[2] || match[3] || match[0])
      .map((url) => url.replace(/[？"]/g, "")); // Clean up URLs by removing ？ and " characters

    let updatedContent = commentBody;

    for (const link of links) {
      const description = await this._generateLinkDescription(link);
      if (description) {
        const linkResponse = await fetch(link);
        const contentType = linkResponse.headers.get("content-type");

        if (contentType && (contentType.includes("text/html") || contentType.includes("text/plain"))) {
          updatedContent = commentBody.replace(
            new RegExp(link, "g"),
            `<a href="${link}" title="${description}">${link}</a>`
          );
        }
      }
    }
    return updatedContent;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    this._assignmentPeriods = await getAssignmentPeriods(
      this.context.octokit,
      parseGitHubUrl(this.context.payload.issue.html_url)
    );
    for (const comment of data.allComments) {
      if (await this._shouldSkipComment(comment)) {
        continue;
      }
      if (comment.body && comment.user?.login && result[comment.user.login]) {
        const processedCommentBody = await this._processCommentBody(comment.body);
        const processedCommentBodyLink = await this._processCommentBodyLink(processedCommentBody);
        const newContent = processedCommentBodyLink
          // Remove quoted text
          .replace(/^>.*$/gm, "")
          // Remove commands such as /start
          .replace(/^\/.+/g, "")
          // Remove HTML comments
          .replace(/<!--[\s\S]*?-->/g, "")
          // Remove the footnotes
          .replace(/^###### .*?\[\^\d+\^][\s\S]*$/gm, "")
          // Keep only one new line needed by markdown-it package to convert to html
          .replace(/\n\s*\n/g, "\n")
          .trim();

        const reviewComment = comment as GitHubPullRequestReviewComment;

        if (newContent.length) {
          result[comment.user.login].comments = [
            ...(result[comment.user.login].comments ?? []),
            {
              id: comment.id,
              content: newContent,
              url: comment.html_url,
              type: comment.type,
              diffHunk: reviewComment?.pull_request_review_id ? reviewComment?.diff_hunk : undefined,
            },
          ];
        }
      }
    }
    return result;
  }
}
