import ms from "ms";
import { GitHubIssue } from "../github-types";
import { IssueActivity } from "../issue-activity";
import { GithubCommentModule } from "../parser/github-comment-module";
import { PaymentModule } from "../parser/payment-module";
import { Processor } from "../parser/processor";
import { UserExtractorModule } from "../parser/user-extractor-module";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result } from "../types/results";
import { getTaskReward } from "./label-price-extractor";

class CloseRewardModule extends BaseModule {
  get enabled(): boolean {
    return true;
  }

  transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const closingUser = this.context.payload.sender?.login;

    if (closingUser) {
      result = {
        [closingUser]: {
          task: {
            reward: this.context.config.incentives.closeTaskReward.rewardAmount,
            multiplier: 1,
            timestamp: new Date().toISOString(),
            url: `${data.self?.html_url}`,
          },
          total: 0,
          userId: this.context.payload.sender?.id ?? 0,
        },
      };
    }
    return Promise.resolve(result);
  }
}

export async function tryCreatingClosingReward(context: ContextPlugin<"issues.closed">, activity: IssueActivity) {
  const { logger, config } = context;

  const taskReward = await getTaskReward(context, context.payload.issue as GitHubIssue);
  const closingDate = context.payload.issue.closed_at;
  const creationDate = context.payload.issue.created_at;
  if (!closingDate || !creationDate) {
    return logger.warn("The issue was closed but the closing date or creation date is missing, no reward can be sent.")
      .logMessage.raw;
  }
  const dateDiff = new Date(closingDate).getTime() - new Date(creationDate).getTime();
  if (taskReward > 0 && dateDiff >= ms(config.incentives.closeTaskReward.durationThreshold as ms.StringValue)) {
    const processor = new Processor(context, [
      new UserExtractorModule(context),
      new CloseRewardModule(context),
      new PaymentModule(context),
      new GithubCommentModule(context),
    ]);
    await activity.init();
    const result = await processor.run(activity);
    return JSON.stringify(result);
  }
  return logger.info("Issue was not closed as completed. Skipping.", {
    durationThreshold: config.incentives.closeTaskReward.durationThreshold,
    dateDiff: `${new Date(dateDiff).getHours() / 3600} days`,
    taskReward,
  }).logMessage.raw;
}
