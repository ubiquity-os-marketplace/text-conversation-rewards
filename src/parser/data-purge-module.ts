import configuration from "../configuration/config-reader";
import { GetActivity } from "../get-activity";
import { Module, Result } from "./processor";

/**
 * Removes the data in the comments that we do not want to be processed.
 */
export class DataPurgeModule implements Module {
  readonly configuration = configuration.dataPurge;

  get enabled(): boolean {
    return this.configuration.enabled;
  }

  transform(data: Readonly<GetActivity>, result: Result) {
    for (const comment of data.allComments) {
      if (comment.body && comment.user?.login && result[comment.user.login]) {
        const newContent = comment.body
          .replace(/^>.*$/gm, "")
          .replace(/[\r\n]+/g, " ")
          .replace(/\[.*?\]\(.*?\)/g, "")
          .replace(/^\/\S+/g, "")
          .trim();
        if (newContent.length) {
          result[comment.user.login].comments = [
            ...(result[comment.user.login].comments ?? []),
            {
              content: newContent,
              url: comment.html_url,
              type: comment.type,
            },
          ];
        }
      }
    }
    return Promise.resolve(result);
  }
}
