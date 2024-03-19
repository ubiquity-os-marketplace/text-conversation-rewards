import configuration from "../configuration/config-reader";
import { GetActivity } from "../get-activity";
import { Module, Result } from "./processor";

/**
 * Removes the data in the comments that we do not want to be processed.
 */
export class DataPurgeModule implements Module {
  readonly configuration = configuration["data-purge"];

  get enabled(): boolean {
    return this.configuration.enabled;
  }

  transform(data: Readonly<GetActivity>, result: Result) {
    for (const value of data.allComments) {
      if (value.body && value.user?.login && result[value.user.login]) {
        const newContent = value.body
          .replace(/^>.*$/gm, "")
          .replace(/[\r\n]+/g, " ")
          .replace(/\[.*?\]\(.*?\)/g, "")
          .replace(/^\/\S+/g, "")
          .trim();
        if (newContent.length) {
          result[value.user.login].comments = [
            ...(result[value.user.login].comments ?? []),
            {
              content: newContent,
              url: value.html_url,
              contentHtml: value.body_html,
            },
          ];
        }
      }
    }
    return Promise.resolve(result);
  }
}
