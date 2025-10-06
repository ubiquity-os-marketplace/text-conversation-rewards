import ms from "ms";
import { GitHubIssue } from "../github-types";
import { IssueActivity } from "../issue-activity";
import { GithubCommentModule } from "../parser/github-comment-module";
import { PaymentModule } from "../parser/payment-module";
import { Processor } from "../parser/processor";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result } from "../types/results";
import { getTaskReward } from "./label-price-extractor";

class CloseRewardModule extends BaseModule {
  get enabled(): boolean {
    return true;
  }

  transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    return Promise.resolve(result);
  }
}

export async function tryCreatingClosingReward(context: ContextPlugin<"issues.closed">, activity: IssueActivity) {
  const { logger, config } = context;

  const taskReward = await getTaskReward(context, context.payload.issue as GitHubIssue);
  const closingDate = context.payload.issue.closed_at;
  if (!closingDate) {
    return logger.warn("The issue was closed but the closing date is missing, no reward can be sent.").logMessage.raw;
  }
  const dateDiff = new Date().getTime() - new Date(closingDate).getTime();
  if (taskReward > 0 && dateDiff >= ms(config.incentives.closeTaskReward.durationThreshold as ms.StringValue)) {
    const processor = new Processor(context, [
      new CloseRewardModule(context),
      new PaymentModule(context),
      new GithubCommentModule(context),
    ]);
    await activity.init();
    const result = await processor.run(activity);
    console.log(result);
  }
  return logger.info("Issue was not closed as completed. Skipping.", {
    durationThreshold: config.incentives.closeTaskReward.durationThreshold,
    dateDiff: `${new Date(dateDiff).getHours() / 3600} days`,
    taskReward,
  }).logMessage.raw;
}
